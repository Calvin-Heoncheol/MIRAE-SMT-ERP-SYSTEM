import { createSupabaseClient } from '@/lib/supabase'
import { aggregateOnHandByMaterialId } from '@/lib/materials/inbound/utils'
import { isMissingMaterialInboundTable } from '@/lib/materials/inbound/repository'
import { isMissingMaterialsTable } from '@/lib/materials/repository'
import { mapMaterialRecord } from '@/lib/materials/utils'
import { isMissingMaterialPurchaseOrdersTable } from '@/lib/materials/purchase-orders/repository'
import type { MaterialInventoryRow, MaterialPurchaseOrderLineAggregateRecord } from './types'
import { aggregatePendingInboundByMaterialId, mergeMaterialInventoryRows } from './utils'

export type FetchMaterialInventoryResult =
  | { ok: true; rows: MaterialInventoryRow[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

function missingEnvResult(): Extract<FetchMaterialInventoryResult, { ok: false }> {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

export function isMissingMaterialInventoryTables(detail: string) {
  return (
    isMissingMaterialsTable(detail) ||
    isMissingMaterialPurchaseOrdersTable(detail) ||
    isMissingMaterialInboundTable(detail)
  )
}

export async function fetchMaterialInventoryStatus(): Promise<FetchMaterialInventoryResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()

    const [materialsResult, linesResult, inboundLinesResult] = await Promise.all([
      supabase
        .from('materials')
        .select(
          `
          *,
          material_mpns (
            id,
            material_id,
            mpn,
            sort_order,
            note,
            created_at
          )
        `,
        )
        .order('customer', { ascending: true })
        .order('material_name', { ascending: true }),
      supabase
        .from('material_purchase_order_lines')
        .select('material_id, quantity, inbound_quantity')
        .not('material_id', 'is', null),
      supabase.from('material_inbound_lines').select('material_id, quantity'),
    ])

    if (materialsResult.error) {
      return { ok: false, reason: 'query', detail: materialsResult.error.message }
    }

    if (linesResult.error) {
      return { ok: false, reason: 'query', detail: linesResult.error.message }
    }

    if (inboundLinesResult.error) {
      return { ok: false, reason: 'query', detail: inboundLinesResult.error.message }
    }

    const materials = (materialsResult.data || []).map((row) => mapMaterialRecord(row))
    const pendingByMaterialId = aggregatePendingInboundByMaterialId(
      (linesResult.data || []) as MaterialPurchaseOrderLineAggregateRecord[],
    )
    const onHandByMaterialId = aggregateOnHandByMaterialId(
      (inboundLinesResult.data || []) as { material_id: string; quantity: number }[],
    )
    const rows = mergeMaterialInventoryRows(materials, pendingByMaterialId, onHandByMaterialId)

    return { ok: true, rows }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
