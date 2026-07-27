import { createSupabaseClient } from '@/lib/supabase'
import type { MaterialPurchaseOrderLineAggregateRecord } from './types'
import { aggregatePendingInboundByMaterialId } from './utils'

export type FetchPendingInboundByMaterialIdResult =
  | { ok: true; pendingByMaterialId: Map<string, number> }
  | { ok: false; detail: string }

/** 발주 라인 기준 미입고 잔량 합산 (자재별) */
export async function fetchPendingInboundByMaterialId(): Promise<FetchPendingInboundByMaterialIdResult> {
  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('material_purchase_order_lines')
      .select('material_id, quantity, inbound_quantity')
      .not('material_id', 'is', null)

    if (error) {
      return { ok: false, detail: error.message }
    }

    return {
      ok: true,
      pendingByMaterialId: aggregatePendingInboundByMaterialId(
        (data || []) as MaterialPurchaseOrderLineAggregateRecord[],
      ),
    }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
