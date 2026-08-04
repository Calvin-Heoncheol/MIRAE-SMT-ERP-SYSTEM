import { createSupabaseClient } from '@/lib/supabase'
import type { MaterialPurchaseOrderLineAggregateRecord, PendingInboundAggregate } from './types'
import { aggregatePendingInboundByMaterialId } from './utils'

export type FetchPendingInboundByMaterialIdResult =
  | ({ ok: true } & PendingInboundAggregate)
  | { ok: false; detail: string }

function isMissingDeliveryDateColumn(detail: string) {
  const lower = detail.toLowerCase()
  return lower.includes('delivery_date') && (lower.includes('column') || lower.includes('does not exist'))
}

/** 발주 라인 기준 미입고 잔량·최만기 납기 합산 (자재별) */
export async function fetchPendingInboundByMaterialId(): Promise<FetchPendingInboundByMaterialIdResult> {
  try {
    const supabase = createSupabaseClient()
    const withDate = await supabase
      .from('material_purchase_order_lines')
      .select('material_id, quantity, inbound_quantity, delivery_date')
      .not('material_id', 'is', null)

    let rows: MaterialPurchaseOrderLineAggregateRecord[]

    if (withDate.error) {
      if (!isMissingDeliveryDateColumn(withDate.error.message)) {
        return { ok: false, detail: withDate.error.message }
      }

      const legacy = await supabase
        .from('material_purchase_order_lines')
        .select('material_id, quantity, inbound_quantity')
        .not('material_id', 'is', null)

      if (legacy.error) {
        return { ok: false, detail: legacy.error.message }
      }
      rows = (legacy.data || []) as MaterialPurchaseOrderLineAggregateRecord[]
    } else {
      rows = (withDate.data || []) as MaterialPurchaseOrderLineAggregateRecord[]
    }

    const aggregate = aggregatePendingInboundByMaterialId(rows)
    return { ok: true, ...aggregate }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
