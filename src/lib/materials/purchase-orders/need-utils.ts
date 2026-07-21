import type { BomEdge } from '@/lib/materials/outbound/types'
import { explodeBomToMaterials } from '@/lib/materials/outbound/utils'
import type { Material } from '@/lib/materials/types'
import type { OrderListGroup } from '@/lib/orders/types'
import type {
  MaterialPurchaseOrderListGroup,
  MaterialPurchaseSuggestionLine,
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
