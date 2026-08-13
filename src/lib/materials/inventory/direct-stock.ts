import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { createMaterialInbound } from '@/lib/materials/inbound/repository'
import { createMaterialOutbound } from '@/lib/materials/outbound/repository'
import { todayYmdSeoul } from '@/lib/materials/purchase-orders/utils'
import { fetchOnHandByMaterialId } from './stock'

export type SetMaterialDirectStockBatchResult =
  | {
      ok: true
      count: number
      increasedCount: number
      decreasedCount: number
      unchangedCount: number
    }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

const DIRECT_STOCK_NOTE = '직접재고'

export type DirectStockTarget = {
  materialId: string
  targetQuantity: number
}

/**
 * 여러 품목의 현재고를 한 번에 맞춥니다.
 * 증가분은 사급입고 1건, 감소분은 조정불출 1건으로 묶어 저장합니다.
 */
export async function setMaterialDirectStockBatch(
  targets: DirectStockTarget[],
): Promise<SetMaterialDirectStockBatchResult> {
  const gate = await assertCanWrite({ module: 'materials', action: 'adjust' })
  if (!gate.ok) return gate

  if (!targets.length) {
    return { ok: false, reason: 'validation', detail: '적용할 품목이 없습니다.' }
  }

  const normalized: { materialId: string; targetQuantity: number }[] = []
  const seen = new Set<string>()

  for (const target of targets) {
    const materialId = target.materialId.trim()
    if (!materialId) {
      return { ok: false, reason: 'validation', detail: '품목코드를 입력해 주세요.' }
    }
    if (!Number.isFinite(target.targetQuantity) || target.targetQuantity < 0) {
      return {
        ok: false,
        reason: 'validation',
        detail: `${materialId} 수량은 0 이상이어야 합니다.`,
      }
    }
    if (seen.has(materialId)) {
      return {
        ok: false,
        reason: 'validation',
        detail: `품목 ${materialId} 이(가) 중복되었습니다.`,
      }
    }
    seen.add(materialId)
    normalized.push({ materialId, targetQuantity: target.targetQuantity })
  }

  const onHandResult = await fetchOnHandByMaterialId()
  if (!onHandResult.ok) {
    return { ok: false, reason: 'query', detail: onHandResult.detail }
  }

  const increases: { material_id: string; purchase_order_line_id: null; quantity: number }[] = []
  const decreases: { material_id: string; quantity: number }[] = []
  let unchangedCount = 0

  for (const item of normalized) {
    const previous = onHandResult.onHandByMaterialId.get(item.materialId) ?? 0
    const delta = item.targetQuantity - previous
    if (delta > 0) {
      increases.push({
        material_id: item.materialId,
        purchase_order_line_id: null,
        quantity: delta,
      })
    } else if (delta < 0) {
      decreases.push({
        material_id: item.materialId,
        quantity: Math.abs(delta),
      })
    } else {
      unchangedCount += 1
    }
  }

  const today = todayYmdSeoul()

  if (increases.length) {
    const result = await createMaterialInbound({
      inbound_date: today,
      inbound_type: 'supplied',
      purchase_order_id: null,
      note: DIRECT_STOCK_NOTE,
      items: increases,
    })
    if (!result.ok) {
      return { ok: false, reason: result.reason, detail: result.detail }
    }
  }

  if (decreases.length) {
    const result = await createMaterialOutbound({
      outbound_date: today,
      outbound_type: 'adjustment',
      order_id: null,
      note: DIRECT_STOCK_NOTE,
      items: decreases,
    })
    if (!result.ok) {
      return { ok: false, reason: result.reason, detail: result.detail }
    }
  }

  return {
    ok: true,
    count: normalized.length,
    increasedCount: increases.length,
    decreasedCount: decreases.length,
    unchangedCount,
  }
}
