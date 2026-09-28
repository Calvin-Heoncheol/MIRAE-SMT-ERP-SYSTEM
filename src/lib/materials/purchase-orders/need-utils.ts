import type { MaterialAtpLine } from '@/lib/materials/atp'
import { atpShortageByMaterial } from '@/lib/materials/atp'
import type { BomEdge } from '@/lib/materials/outbound/types'
import { explodeBomToMaterials } from '@/lib/materials/outbound/utils'
import type { Material } from '@/lib/materials/types'
import { resolveMaterialById } from '@/lib/materials/utils'
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

function resolveMaterialMeta(materials: Material[], materialId: string) {
  return resolveMaterialById(materials, materialId)
}

function resolvePurchaseStatus(orderQuantity: number, coveredQuantity: number): OrderPurchaseStatus {
  const target = Math.max(0, Math.floor(orderQuantity))
  const covered = Math.max(0, Math.floor(coveredQuantity))
  if (target <= 0) return 'done'
  if (covered <= 0) return 'none'
  if (covered >= target) return 'done'
  return 'partial'
}

/** BOM 있는 제품만 기준으로 카드 상태 판단 — 잔량 남으면 절대 done 아님 */
function resolveCardStatus(products: OrderPurchaseProductLine[]): OrderPurchaseStatus {
  const actionable = products.filter((product) => product.hasBom)
  if (!actionable.length) return 'none'
  const totalCovered = actionable.reduce((sum, product) => sum + product.coveredQuantity, 0)
  const totalRemaining = actionable.reduce((sum, product) => sum + product.remainingQuantity, 0)
  if (totalRemaining <= 0) return 'done'
  if (totalCovered <= 0) return 'none'
  return 'partial'
}

/** 주문 연동 PO 미입고 — key: orderId::materialId */
export function buildPendingInboundByOrderMaterial(
  purchaseOrders: MaterialPurchaseOrderListGroup[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const po of purchaseOrders) {
    const orderId = (po.sourceOrderId || '').trim()
    if (!orderId) continue
    for (const item of po.items) {
      const materialId = (item.materialId || '').trim()
      if (!materialId) continue
      const pending = Math.max(0, (Number(item.quantity) || 0) - (Number(item.inboundQuantity) || 0))
      if (pending <= 0) continue
      const key = `${orderId}::${materialId}`
      map.set(key, (map.get(key) ?? 0) + pending)
    }
  }
  return map
}

/**
 * 구매발주 제안 — MTO: 주문별 ATP 부족분 합산.
 * (구: 전체 소요 − 공용 현재고 − 전체 입고예정)
 */
export function buildPurchaseSuggestionLines(input: {
  orders: OrderListGroup[]
  bomEdges: BomEdge[]
  materials: Material[]
  onHandByMaterialId: Map<string, number>
  purchaseOrders?: MaterialPurchaseOrderListGroup[]
  /** 있으면 주문별 부족 합으로 제안 */
  atpLines?: MaterialAtpLine[]
}): MaterialPurchaseSuggestionLine[] {
  if (input.atpLines?.length) {
    const shortageByMaterial = atpShortageByMaterial(input.atpLines)
    const pendingByMaterial = new Map<string, number>()
    for (const line of input.atpLines) {
      if (line.pendingInboundQty <= 0) continue
      pendingByMaterial.set(
        line.materialId,
        (pendingByMaterial.get(line.materialId) ?? 0) + line.pendingInboundQty,
      )
    }
    const requiredByMaterial = new Map<string, number>()
    for (const line of input.atpLines) {
      requiredByMaterial.set(
        line.materialId,
        (requiredByMaterial.get(line.materialId) ?? 0) + line.remainingNeed,
      )
    }

    return [...shortageByMaterial.entries()]
      .map(([materialId, suggestedQuantity]) => {
        const material = resolveMaterialMeta(input.materials, materialId)
        return {
          materialId: material?.id || materialId,
          materialName: material?.materialName || materialId,
          specification: material?.specification || '',
          mpn: material?.mpn || '',
          supplier: material?.supplier || '',
          unitPrice: material?.unitPrice || 0,
          totalRequiredQuantity: requiredByMaterial.get(materialId) ?? suggestedQuantity,
          onHandQuantity: Math.max(0, input.onHandByMaterialId.get(materialId) ?? 0),
          pendingInboundQuantity: pendingByMaterial.get(materialId) ?? 0,
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

  // 폴백 — allocation 테이블 없을 때 기존 합산
  const edgesByParent = buildEdgesByParent(input.bomEdges)
  const coveredByLine = buildCoveredQuantityByOrderLine(input.purchaseOrders ?? [])

  const totalRequiredByMaterial = new Map<string, number>()
  for (const order of input.orders) {
    for (const item of order.items) {
      if (item.derivedFromLineId) continue
      const orderLineId = (item.lineId || '').trim().toLowerCase()
      const productId = (item.productId || item.productCode || '').trim()
      if (!orderLineId || !productId) continue

      const orderQuantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
      if (orderQuantity <= 0) continue

      const coveredQuantity = Math.min(orderQuantity, coveredByLine.get(orderLineId) ?? 0)
      const uncoveredQuantity = Math.max(0, orderQuantity - coveredQuantity)
      if (uncoveredQuantity <= 0) continue

      const exploded = explodeBomToMaterials(productId, uncoveredQuantity, edgesByParent)
      for (const [materialId, required] of exploded) {
        totalRequiredByMaterial.set(
          materialId,
          (totalRequiredByMaterial.get(materialId) ?? 0) + required,
        )
      }
    }
  }

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
      const material = resolveMaterialMeta(input.materials, materialId)
      const onHandQuantity = Math.max(0, input.onHandByMaterialId.get(materialId) ?? 0)
      const pendingInboundQuantity = pendingByMaterial.get(materialId) ?? 0
      const suggestedQuantity = Math.max(
        0,
        totalRequiredQuantity - onHandQuantity - pendingInboundQuantity,
      )
      return {
        materialId: material?.id || materialId,
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

/** 발주서 라인별 이미 커버된 제품 수량 (부분 구매발주 합산) */
export function buildCoveredQuantityByOrderLine(
  purchaseOrders: MaterialPurchaseOrderListGroup[],
): Map<string, number> {
  const covered = new Map<string, number>()
  for (const po of purchaseOrders) {
    const lineId = (po.coveredOrderLineId || '').trim().toLowerCase()
    const qty = Math.max(0, Math.floor(Number(po.coveredProductQuantity) || 0))
    if (!lineId || qty <= 0) continue
    covered.set(lineId, (covered.get(lineId) ?? 0) + qty)
  }
  return covered
}

/**
 * 발주서 단위 구매발주 카드 — 목표는 주문 제품대수, 잔량 = 주문 − 커버.
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
      const coveredQuantity = Math.min(
        orderQuantity,
        coveredByLine.get(orderLineId.toLowerCase()) ?? 0,
      )
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
    const statusRank = { partial: 0, none: 1, done: 2 } as const
    const rankDiff = statusRank[a.purchaseStatus] - statusRank[b.purchaseStatus]
    if (rankDiff !== 0) return rankDiff
    const deliveryCompare = (a.deliveryDate || '').localeCompare(b.deliveryDate || '')
    if (deliveryCompare !== 0) return deliveryCompare
    return b.orderNumber.localeCompare(a.orderNumber, 'ko')
  })
}

/** 제품 수량 기준 BOM 전개 미리보기 (부분 구매발주 수량 입력용) */
export function buildOrderPurchaseMaterialPreview(input: {
  productId: string
  purchaseQuantity: number
  bomEdges: BomEdge[]
  materials: Material[]
  onHandByMaterialId: Map<string, number>
  /** 이 주문의 ATP 가용 (있으면 제안 수량에 반영) */
  orderAvailableByMaterialId?: Map<string, number>
}): OrderPurchaseMaterialPreview[] {
  const edgesByParent = buildEdgesByParent(input.bomEdges)
  const qty = Math.max(0, Math.floor(Number(input.purchaseQuantity) || 0))
  if (!input.productId.trim() || qty <= 0) return []

  const exploded = explodeBomToMaterials(input.productId, qty, edgesByParent)
  return [...exploded.entries()]
    .map(([materialId, requiredQuantity]) => {
      const material = resolveMaterialMeta(input.materials, materialId)
      const resolvedId = material?.id || materialId
      const onHandQuantity = Math.max(
        0,
        input.onHandByMaterialId.get(resolvedId) ??
          input.onHandByMaterialId.get(materialId) ??
          0,
      )
      const orderAvailable =
        input.orderAvailableByMaterialId?.get(resolvedId) ??
        input.orderAvailableByMaterialId?.get(materialId)
      const coverFromStock =
        orderAvailable != null ? Math.min(requiredQuantity, orderAvailable) : onHandQuantity
      const suggestedQuantity = Math.max(0, requiredQuantity - coverFromStock)
      return {
        materialId: resolvedId,
        materialCode: resolvedId,
        materialName: material?.materialName || materialId,
        specification: material?.specification || '',
        mpn: material?.mpn || '',
        supplier: material?.supplier || '',
        unitPrice: material?.unitPrice || 0,
        requiredQuantity,
        onHandQuantity,
        suggestedQuantity,
        registered: Boolean(material),
      }
    })
    .sort((a, b) => {
      if (a.registered !== b.registered) return a.registered ? 1 : -1
      if (a.suggestedQuantity !== b.suggestedQuantity) {
        return b.suggestedQuantity - a.suggestedQuantity
      }
      return a.materialName.localeCompare(b.materialName, 'ko')
    })
}
