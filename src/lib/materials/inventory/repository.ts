import { createSupabaseClient } from '@/lib/supabase'
import { aggregateOnHandByMaterialId } from '@/lib/materials/inbound/utils'
import { isMissingMaterialInboundTable } from '@/lib/materials/inbound/repository'
import { aggregateOutboundByMaterialId } from '@/lib/materials/outbound/utils'
import { isMissingMaterialOutboundTable } from '@/lib/materials/outbound/repository'
import { isMissingMaterialsTable } from '@/lib/materials/repository'
import { mapItemRowToMaterial } from '@/lib/materials/utils'
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

    const [materialsResult, linesResult, inboundLinesResult, outboundLinesResult] = await Promise.all([
      supabase
        .from('items')
        .select('*')
        .in('item_category', [1, 2])
        .order('name', { ascending: true }),
      supabase
        .from('material_purchase_order_lines')
        .select('material_id, quantity, inbound_quantity')
        .not('material_id', 'is', null),
      supabase.from('material_inbound_lines').select('material_id, quantity'),
      supabase.from('material_outbound_lines').select('material_id, quantity'),
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

    // 불출 테이블이 아직 없으면 입고만으로 재고 계산 (마이그레이션 전 호환)
    const outboundMissing =
      outboundLinesResult.error && isMissingMaterialOutboundTable(outboundLinesResult.error.message)
    if (outboundLinesResult.error && !outboundMissing) {
      return { ok: false, reason: 'query', detail: outboundLinesResult.error.message }
    }

    const materials = (materialsResult.data || []).map((row) => mapItemRowToMaterial(row))
    const pendingByMaterialId = aggregatePendingInboundByMaterialId(
      (linesResult.data || []) as MaterialPurchaseOrderLineAggregateRecord[],
    )
    const inboundByMaterialId = aggregateOnHandByMaterialId(
      (inboundLinesResult.data || []) as { material_id: string; quantity: number }[],
    )
    const outboundByMaterialId = outboundMissing
      ? new Map<string, number>()
      : aggregateOutboundByMaterialId(
          (outboundLinesResult.data || []) as { material_id: string; quantity: number }[],
        )

    const onHandByMaterialId = new Map<string, number>()
    const materialIds = new Set([...inboundByMaterialId.keys(), ...outboundByMaterialId.keys()])
    for (const materialId of materialIds) {
      onHandByMaterialId.set(
        materialId,
        (inboundByMaterialId.get(materialId) ?? 0) - (outboundByMaterialId.get(materialId) ?? 0),
      )
    }

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
