import type { BomEdge } from '@/lib/materials/outbound/types'
import { computeIssuableProductQuantity, explodeBomToMaterials } from '@/lib/materials/outbound/utils'

/** 주문/계획 카드용 자재 입고 상태 */
export type MaterialInboundStatus = 'ready' | 'scheduled' | 'missing' | 'no_bom'

export const MATERIAL_INBOUND_STATUS_LABELS: Record<MaterialInboundStatus, string> = {
  ready: '입고완료',
  scheduled: '입고예정',
  missing: '미입고',
  no_bom: 'BOM없음',
}

export function buildBomEdgesByParent(bomEdges: BomEdge[]) {
  const edgesByParent = new Map<string, BomEdge[]>()
  for (const edge of bomEdges) {
    if (!edge.parentProductId) continue
    const list = edgesByParent.get(edge.parentProductId) || []
    list.push(edge)
    edgesByParent.set(edge.parentProductId, list)
  }
  return edgesByParent
}

function mergeStockWithPending(
  onHandByMaterialId: Map<string, number>,
  pendingInboundByMaterialId: Map<string, number>,
) {
  const combined = new Map(onHandByMaterialId)
  for (const [materialId, pending] of pendingInboundByMaterialId) {
    if (pending <= 0) continue
    combined.set(materialId, (combined.get(materialId) ?? 0) + pending)
  }
  return combined
}

/**
 * BOM 소요(잔여 생산수량) vs 현재고 / 발주 미입고 잔량.
 * - 입고완료: 현재고만으로 충족
 * - 입고예정: 현재고+입고예정으로 충족
 * - 미입고: 그래도 부족
 * - BOM없음: 전개 자재 없음
 */
export function resolveMaterialInboundStatus(
  productId: string,
  remainingQty: number,
  edgesByParent: Map<string, BomEdge[]>,
  onHandByMaterialId: Map<string, number>,
  pendingInboundByMaterialId: Map<string, number>,
): MaterialInboundStatus {
  const id = productId.trim()
  const qty = Math.max(0, Math.floor(remainingQty))
  if (!id) return 'no_bom'

  const materialsPerOne = explodeBomToMaterials(id, 1, edgesByParent)
  if (!materialsPerOne.size) return 'no_bom'

  if (qty <= 0) return 'ready'

  const onHandReady = computeIssuableProductQuantity(id, qty, edgesByParent, onHandByMaterialId)
  if (onHandReady >= qty) return 'ready'

  const combined = mergeStockWithPending(onHandByMaterialId, pendingInboundByMaterialId)
  const withPending = computeIssuableProductQuantity(id, qty, edgesByParent, combined)
  if (withPending >= qty) return 'scheduled'

  return 'missing'
}
