import { createSupabaseClient } from '@/lib/supabase'
import { isMissingMaterialInboundTable } from '@/lib/materials/inbound/repository'
import { isMissingMaterialOutboundTable } from '@/lib/materials/outbound/repository'
import { isMissingMaterialsTable } from '@/lib/materials/repository'
import { mapItemRowToMaterial } from '@/lib/materials/utils'
import { isMissingMaterialPurchaseOrdersTable } from '@/lib/materials/purchase-orders/repository'
import type { MaterialInventoryRow, MaterialPurchaseOrderLineAggregateRecord } from './types'
import { aggregatePendingInboundByMaterialId, mergeMaterialInventoryRows } from './utils'
import { fetchOnHandByMaterialId } from './stock'

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
    isMissingMaterialInboundTable(detail) ||
    isMissingMaterialOutboundTable(detail)
  )
}

export async function fetchMaterialInventoryStatus(): Promise<FetchMaterialInventoryResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()

    const [materialsResult, linesResult, onHandResult] = await Promise.all([
      supabase
        .from('items')
        .select('*')
        .in('item_category', [1, 2])
        .order('name', { ascending: true }),
      supabase
        .from('material_purchase_order_lines')
        .select('material_id, quantity, inbound_quantity')
        .not('material_id', 'is', null),
      fetchOnHandByMaterialId(),
    ])

    if (materialsResult.error) {
      return { ok: false, reason: 'query', detail: materialsResult.error.message }
    }

    if (linesResult.error) {
      return { ok: false, reason: 'query', detail: linesResult.error.message }
    }

    if (!onHandResult.ok) {
      return { ok: false, reason: 'query', detail: onHandResult.detail }
    }

    const materials = (materialsResult.data || []).map((row) => mapItemRowToMaterial(row))
    const pendingByMaterialId = aggregatePendingInboundByMaterialId(
      (linesResult.data || []) as MaterialPurchaseOrderLineAggregateRecord[],
    )

    const rows = mergeMaterialInventoryRows(
      materials,
      pendingByMaterialId,
      onHandResult.onHandByMaterialId,
    )

    return { ok: true, rows }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
