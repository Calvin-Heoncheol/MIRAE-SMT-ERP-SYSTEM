import type { BomEdge } from '@/lib/materials/outbound/types'
import { explodeBomToMaterials } from '@/lib/materials/outbound/utils'
import type { Material } from '@/lib/materials/types'
import type { OrderListGroup } from '@/lib/orders/types'
import type {
  MaterialPurchaseOrderListGroup,
  MaterialPurchaseSuggestionLine,
  OrderPurchaseCard,
  OrderPurchaseMaterialPreview,
  OrderPurchaseProductLine,
  OrderPurchaseStatus,
} from './types'

function buildEdgesByParent(bomEdges: BomEdge[]) {
  const map = new Map<string, BomEdge[]>()
  for (const edge of bomEdges) {
    if (!edge.parentProductId || !edge.childProductId) continue
    const list = map.get(edge.parentProductId) || []
    list.push(edge)
    map.set(edge.parentProductId, list)
  }
  return map
}

function resolvePurchaseStatus(orderQuantity: number, coveredQuantity: number): OrderPurchaseStatus {
  const target = Math.max(0, Math.floor(orderQuantity))
  const covered = Math.max(0, Math.floor(coveredQuantity))
  if (target <= 0) return 'done'
  if (covered <= 0) return 'none'
  if (covered >= target) return 'done'
  return 'partial'
}

function resolveCardStatus(products: OrderPurchaseProductLine[]): OrderPurchaseStatus {
  if (!products.length) return 'done'
  if (products.every((product) => product.purchaseStatus === 'done')) return 'done'
  if (products.every((product) => product.purchaseStatus === 'none')) return 'none'
  return 'partial'
}

/**
 * 자재 기준 발주 제안 (표준 MRP) — 모든 주문의 소요를 자재별로 합산해
 * 발주필요 = 총소요 − 현재고 − 입고예정(전체 발주 미입고 잔량) 을 계산한다.
 * 발주필요가 0보다 큰 자재만 반환한다.
 */
export function buildPurchaseSuggestionLines(input: {
  orders: OrderListGroup[]
  bomEdges: BomEdge[]
  materials: Material[]
  onHandByMaterialId: Map<string, number>
  purchaseOrders?: MaterialPurchaseOrderListGroup[]
}): MaterialPurchaseSuggestionLine[] {
  const edgesByParent = buildEdgesByParent(input.bomEdges)
  const materialById = new Map(input.materials.map((material) => [material.id, material]))

  const totalRequiredByMaterial = new Map<string, number>()
  for (const order of input.orders) {
    for (const item of order.items) {
      if (item.derivedFromLineId) continue
      const productId = (item.productId || item.productCode || '').trim()
      const quantity = Math.max(0, Number(item.quantity) || 0)
      if (!productId || quantity <= 0) continue

      const exploded = explodeBomToMaterials(productId, quantity, edgesByParent)
      for (const [materialId, required] of exploded) {
        totalRequiredByMaterial.set(
          materialId,
          (totalRequiredByMaterial.get(materialId) ?? 0) + required,
        )
      }
    }
  }

  // 입고예정: 모든 발주서의 미입고 잔량(발주수량 − 입고수량) 합산.
  // 입고된 수량은 현재고에 반영되므로 여기서 제외해 이중 차감을 막는다.
  const pendingByMaterial = new Map<string, number>()
  for (const po of input.purchaseOrders ?? []) {
    for (const item of po.items) {
      const materialId = (item.materialId || '').trim()
      if (!materialId) continue
      const pending = Math.max(0, (Number(item.quantity) || 0) - (Number(item.inboundQuantity) || 0))
      if (pending <= 0) continue
      pendingByMaterial.set(materialId, (pendingByMaterial.get(materialId) ?? 0) + pending)
    }
  }

  return [...totalRequiredByMaterial.entries()]
    .map(([materialId, totalRequiredQuantity]) => {
      const material = materialById.get(materialId)
      const onHandQuantity = Math.max(0, input.onHandByMaterialId.get(materialId) ?? 0)
      const pendingInboundQuantity = pendingByMaterial.get(materialId) ?? 0
      const suggestedQuantity = Math.max(
        0,
        totalRequiredQuantity - onHandQuantity - pendingInboundQuantity,
      )
      return {
        materialId,
        materialName: material?.materialName || materialId,
        specification: material?.specification || '',
        mpn: material?.mpn || '',
        supplier: material?.supplier || '',
        unitPrice: material?.unitPrice || 0,
        totalRequiredQuantity,
        onHandQuantity,
        pendingInboundQuantity,
        suggestedQuantity,
      }
    })
    .filter((line) => line.suggestedQuantity > 0)
    .sort((a, b) => {
      const supplierCompare = a.supplier.localeCompare(b.supplier, 'ko')
      if (supplierCompare !== 0) return supplierCompare
      return a.materialName.localeCompare(b.materialName, 'ko')
    })
}

/** 주문서 라인별 이미 커버된 제품 수량 (부분 발주 합산) */
export function buildCoveredQuantityByOrderLine(
  purchaseOrders: MaterialPurchaseOrderListGroup[],
): Map<string, number> {
  const covered = new Map<string, number>()
  for (const po of purchaseOrders) {
    const lineId = (po.coveredOrderLineId || '').trim()
    const qty = Math.max(0, Math.floor(Number(po.coveredProductQuantity) || 0))
    if (!lineId || qty <= 0) continue
    covered.set(lineId, (covered.get(lineId) ?? 0) + qty)
  }
  return covered
}

/**
 * 주문서 단위 발주 카드 — 제품 라인별 주문수량/기발주커버/잔량.
 * BOM 미등록 제품도 카드에 포함해 안내한다.
 */
export function buildOrderPurchaseCards(input: {
  orders: OrderListGroup[]
  bomEdges: BomEdge[]
  purchaseOrders: MaterialPurchaseOrderListGroup[]
}): OrderPurchaseCard[] {
  const edgesByParent = buildEdgesByParent(input.bomEdges)
  const coveredByLine = buildCoveredQuantityByOrderLine(input.purchaseOrders)
  const cards: OrderPurchaseCard[] = []

  for (const order of input.orders) {
    const products: OrderPurchaseProductLine[] = []

    for (const item of order.items) {
      if (item.derivedFromLineId) continue
      const orderLineId = (item.lineId || '').trim()
      const productId = (item.productId || item.productCode || '').trim()
      const orderQuantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
      if (!orderLineId || !productId || orderQuantity <= 0) continue

      const hasBom = (edgesByParent.get(productId)?.length ?? 0) > 0
      const coveredQuantity = Math.min(orderQuantity, coveredByLine.get(orderLineId) ?? 0)
      const remainingQuantity = Math.max(0, orderQuantity - coveredQuantity)
      products.push({
        orderLineId,
        productId,
        productCode: item.productCode || productId,
        productName: item.productName || productId,
        orderQuantity,
        coveredQuantity,
        remainingQuantity,
        purchaseStatus: resolvePurchaseStatus(orderQuantity, coveredQuantity),
        hasBom,
      })
    }

    if (!products.length) continue

    cards.push({
      key: order.orderId,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      customer: order.customer,
      deliveryDate: order.deliveryDate || '',
      orderDate: order.orderDate || '',
      products,
      purchaseStatus: resolveCardStatus(products),
    })
  }

  return cards.sort((a, b) => {
    const statusRank = { none: 0, partial: 1, done: 2 } as const
    const rankDiff = statusRank[a.purchaseStatus] - statusRank[b.purchaseStatus]
    if (rankDiff !== 0) return rankDiff
    const deliveryCompare = (a.deliveryDate || '').localeCompare(b.deliveryDate || '')
    if (deliveryCompare !== 0) return deliveryCompare
    return b.orderNumber.localeCompare(a.orderNumber, 'ko')
  })
}

/** 제품 수량 기준 BOM 전개 미리보기 (부분 발주 수량 입력용) */
export function buildOrderPurchaseMaterialPreview(input: {
  productId: string
  purchaseQuantity: number
  bomEdges: BomEdge[]
  materials: Material[]
  onHandByMaterialId: Map<string, number>
}): OrderPurchaseMaterialPreview[] {
  const edgesByParent = buildEdgesByParent(input.bomEdges)
  const materialById = new Map(input.materials.map((material) => [material.id, material]))
  const qty = Math.max(0, Math.floor(Number(input.purchaseQuantity) || 0))
  if (!input.productId.trim() || qty <= 0) return []

  const exploded = explodeBomToMaterials(input.productId, qty, edgesByParent)
  return [...exploded.entries()]
    .map(([materialId, requiredQuantity]) => {
      const material = materialById.get(materialId)
      const onHandQuantity = Math.max(0, input.onHandByMaterialId.get(materialId) ?? 0)
      const suggestedQuantity = Math.max(0, requiredQuantity - onHandQuantity)
      return {
        materialId,
        materialCode: materialId,
        materialName: material?.materialName || materialId,
        specification: material?.specification || '',
        mpn: material?.mpn || '',
        supplier: material?.supplier || '',
        unitPrice: material?.unitPrice || 0,
        requiredQuantity,
        onHandQuantity,
        suggestedQuantity,
      }
    })
    .sort((a, b) => {
      if (a.suggestedQuantity !== b.suggestedQuantity) {
        return b.suggestedQuantity - a.suggestedQuantity
      }
      return a.materialName.localeCompare(b.materialName, 'ko')
    })
}
