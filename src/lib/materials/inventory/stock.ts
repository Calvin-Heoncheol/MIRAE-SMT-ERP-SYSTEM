import { createSupabaseClient } from '@/lib/supabase'
import { aggregateOnHandByMaterialId } from '@/lib/materials/inbound/utils'
import { isMissingMaterialInboundTable } from '@/lib/materials/inbound/repository'
import { aggregateOutboundByMaterialId } from '@/lib/materials/outbound/utils'
import { isMissingMaterialOutboundTable } from '@/lib/materials/outbound/repository'

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

/** 입고·불출 라인을 조회해 현재고 맵을 만듭니다. */
export async function fetchOnHandByMaterialId(): Promise<FetchOnHandByMaterialIdResult> {
  try {
    const supabase = createSupabaseClient()
    const [inboundLinesResult, outboundLinesResult] = await Promise.all([
      supabase.from('material_inbound_lines').select('material_id, quantity'),
      supabase.from('material_outbound_lines').select('material_id, quantity'),
    ])

    if (inboundLinesResult.error && !isMissingMaterialInboundTable(inboundLinesResult.error.message)) {
      return { ok: false, detail: inboundLinesResult.error.message }
    }
    if (
      outboundLinesResult.error &&
      !isMissingMaterialOutboundTable(outboundLinesResult.error.message)
    ) {
      return { ok: false, detail: outboundLinesResult.error.message }
    }

    const inboundByMaterialId = inboundLinesResult.error
      ? new Map<string, number>()
      : aggregateOnHandByMaterialId(
          (inboundLinesResult.data || []) as { material_id: string; quantity: number }[],
        )
    const outboundByMaterialId = outboundLinesResult.error
      ? new Map<string, number>()
      : aggregateOutboundByMaterialId(
          (outboundLinesResult.data || []) as { material_id: string; quantity: number }[],
        )

    return {
      ok: true,
      onHandByMaterialId: computeOnHandByMaterialId(inboundByMaterialId, outboundByMaterialId),
    }
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
