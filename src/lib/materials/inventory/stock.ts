import { createSupabaseClient } from '@/lib/supabase'

/** inbound − outbound → 현재고 */
export function computeOnHandByMaterialId(
  inboundByMaterialId: Map<string, number>,
  outboundByMaterialId: Map<string, number>,
): Map<string, number> {
  const onHand = new Map<string, number>()
  const materialIds = new Set([...inboundByMaterialId.keys(), ...outboundByMaterialId.keys()])
  for (const materialId of materialIds) {
    onHand.set(
      materialId,
      (inboundByMaterialId.get(materialId) ?? 0) - (outboundByMaterialId.get(materialId) ?? 0),
    )
  }
  return onHand
}

export type FetchOnHandByMaterialIdResult =
  | { ok: true; onHandByMaterialId: Map<string, number> }
  | { ok: false; detail: string }

const ON_HAND_PAGE_SIZE = 1000

function isMissingOnHandView(detail: string) {
  const lower = detail.toLowerCase()
  return (
    lower.includes('material_on_hand') ||
    lower.includes('schema cache') ||
    (lower.includes('could not find') && lower.includes('material_on_hand'))
  )
}

/** DB 집계 뷰 material_on_hand 를 페이지 단위로 읽어 현재고 맵을 만듭니다. */
export async function fetchOnHandByMaterialId(): Promise<FetchOnHandByMaterialIdResult> {
  try {
    const supabase = createSupabaseClient()
    const onHandByMaterialId = new Map<string, number>()
    let from = 0

    for (;;) {
      const to = from + ON_HAND_PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('material_on_hand')
        .select('material_id, on_hand')
        .order('material_id', { ascending: true })
        .range(from, to)

      if (error) {
        if (isMissingOnHandView(error.message)) {
          return {
            ok: false,
            detail:
              '현재고 집계 뷰(material_on_hand)가 없습니다. Supabase SQL Editor에서 supabase/migrate-material-on-hand-view.sql 을 실행해 주세요.',
          }
        }
        return { ok: false, detail: error.message }
      }

      const rows = (data || []) as { material_id: string; on_hand: number | string }[]
      for (const row of rows) {
        const materialId = String(row.material_id || '').trim()
        if (!materialId) continue
        onHandByMaterialId.set(materialId, Number(row.on_hand) || 0)
      }

      if (rows.length < ON_HAND_PAGE_SIZE) break
      from += ON_HAND_PAGE_SIZE
    }

    return { ok: true, onHandByMaterialId }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/** 불출 수정 시: 현재고에 기존 전표 수량을 되돌려 가용 재고를 계산 */
export function availableOnHandForOutboundEdit(
  onHandByMaterialId: Map<string, number>,
  previousLines: { material_id: string; quantity: number }[],
  materialId: string,
) {
  const previousQty = previousLines
    .filter((line) => line.material_id === materialId)
    .reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0)
  return (onHandByMaterialId.get(materialId) ?? 0) + previousQty
}
