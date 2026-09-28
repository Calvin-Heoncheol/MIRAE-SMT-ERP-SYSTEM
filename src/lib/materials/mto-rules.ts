/**
 * MTO 자재 운영 규칙 (Phase 2)
 * - 안전재고: SMD/DIP는 ATP에서 무시, 미분류(소모품)만 버퍼 → safetyStockForAtp
 * - 주문 수량 변경: syncMaterialOrderAllocations / resyncMaterialOrderAllocationsAfterStockChange
 * - 대체 자재: 같은 주문 소요 안에서만 부족분 커버 → coverShortageWithOrderAlternates
 */

export const MTO_RULES = {
  /** 구매 기본 경로 — 발주서(부분) 연동 */
  defaultPurchasePath: 'order' as const,
  /** 자재별(무주문) PO는 예외 */
  allowMaterialOnlyPurchase: true,
  /** 하드 릴 pegging — Phase 3 */
  hardReelPegging: false,
  /** 주문 변경 시 소프트 예약 재계산 */
  resyncAllocationsOnOrderChange: true,
  /** 대체는 동일 주문 내에서만 */
  alternateScope: 'same_order' as const,
} as const

export function mtoPurchaseWarningForMaterialOnlyPo() {
  return (
    '이 구매발주는 고객 발주에 연결되지 않습니다. ' +
    'MTO 기본 경로는 「발주서 구매」(발주서 연동)입니다. 공통/버퍼 자재일 때만 진행하세요.'
  )
}

/** 주문 저장 후 호출 — 실패해도 주문 저장은 유지 */
export async function resyncMtoAllocationsAfterOrderChange() {
  if (!MTO_RULES.resyncAllocationsOnOrderChange) return

  try {
    const { fetchOnHandByMaterialId } = await import('@/lib/materials/inventory/stock')
    const { fetchMaterials } = await import('@/lib/materials/repository')
    const { fetchOrders } = await import('@/lib/orders/repository')
    const { fetchBomEdges, fetchIssuedOrderMaterialRows } = await import(
      '@/lib/materials/outbound/repository'
    )
    const { resyncMaterialOrderAllocationsAfterStockChange } = await import(
      '@/lib/materials/allocations/repository'
    )

    const [onHandResult, materialsResult, ordersResult, bomEdges, issuedRows] = await Promise.all([
      fetchOnHandByMaterialId(),
      fetchMaterials(),
      fetchOrders({ includeDerivedLines: true }),
      fetchBomEdges(),
      fetchIssuedOrderMaterialRows(),
    ])

    if (!onHandResult.ok || !materialsResult.ok || !ordersResult.ok) return

    const issuedNested = new Map<string, Map<string, number>>()
    for (const row of issuedRows) {
      const orderId = String(row.order_id || '').trim()
      const materialId = String(row.material_id || '').trim()
      const quantity = Math.floor(Number(row.quantity) || 0)
      if (!orderId || !materialId || quantity === 0) continue
      let byMaterial = issuedNested.get(orderId)
      if (!byMaterial) {
        byMaterial = new Map()
        issuedNested.set(orderId, byMaterial)
      }
      byMaterial.set(materialId, (byMaterial.get(materialId) ?? 0) + quantity)
    }
    for (const byMaterial of issuedNested.values()) {
      for (const [materialId, total] of byMaterial) {
        byMaterial.set(materialId, Math.max(0, total))
      }
    }

    await resyncMaterialOrderAllocationsAfterStockChange({
      orders: ordersResult.orders,
      bomEdges,
      materials: materialsResult.materials,
      onHandByMaterialId: onHandResult.onHandByMaterialId,
      issuedByOrderMaterial: issuedNested,
    })
  } catch {
    // ignore — 다음 구매/불출 화면 진입 시 sync
  }
}
