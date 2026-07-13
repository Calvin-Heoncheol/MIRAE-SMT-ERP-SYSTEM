import { createSupabaseClient } from '@/lib/supabase'
import { fetchMaterials } from '@/lib/materials/repository'
import { fetchOrders } from '@/lib/orders/repository'
import type { Material } from '@/lib/materials/types'
import type { OrderListGroup } from '@/lib/orders/types'
import type {
  BomEdge,
  MaterialOutboundListGroup,
  MaterialOutboundNeedCard,
  MaterialOutboundNeedRow,
  MaterialOutboundRecord,
  MaterialOutboundRowPayload,
} from './types'
import {
  aggregateIssuedByOrderMaterial,
  aggregateOutboundByMaterialId,
  buildOutboundNeedCards,
  buildOutboundNeedRows,
  groupOutboundsFromRecords,
} from './utils'
import { aggregateOnHandByMaterialId } from '@/lib/materials/inbound/utils'
import { isMissingMaterialInboundTable } from '@/lib/materials/inbound/repository'

export type FetchMaterialOutboundsResult =
  | { ok: true; outbounds: MaterialOutboundListGroup[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type FetchMaterialOutboundPageResult =
  | {
      ok: true
      outbounds: MaterialOutboundListGroup[]
      needs: MaterialOutboundNeedRow[]
      needCards: MaterialOutboundNeedCard[]
      bomEdges: BomEdge[]
      materials: Material[]
      orders: OrderListGroup[]
    }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveMaterialOutboundResult =
  | { ok: true; outboundId: string; outboundNumber: string }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export type DeleteMaterialOutboundResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query'; detail: string }

function missingFetchEnvResult(): FetchMaterialOutboundsResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

function missingEnvResult(): SaveMaterialOutboundResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

export function isMissingMaterialOutboundTable(detail: string) {
  return (
    detail.includes('material_outbound_records') ||
    detail.includes('material_outbound_lines') ||
    detail.includes('schema cache') ||
    detail.includes('relationship')
  )
}

async function fetchItemsByIds(ids: string[]) {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (!uniqueIds.length) {
    return new Map<string, { id: string; name: string; specification: string; mpn: string }>()
  }

  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('items')
    .select('id, name, specification, mpn')
    .in('id', uniqueIds)

  if (error) throw new Error(error.message)

  return new Map(
    (data || []).map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name || '',
        specification: row.specification || '',
        mpn: row.mpn || '',
      },
    ]),
  )
}

function attachItemsToOutboundRecords(
  records: MaterialOutboundRecord[],
  itemsById: Map<string, { id: string; name: string; specification: string; mpn: string }>,
): MaterialOutboundRecord[] {
  return records.map((record) => ({
    ...record,
    material_outbound_lines: (record.material_outbound_lines || []).map((line) => ({
      ...line,
      items: itemsById.get(line.material_id) ?? null,
    })),
  }))
}

function validateOutboundPayload(payload: MaterialOutboundRowPayload): string | null {
  if (!payload.outbound_date?.trim()) return '불출일을 입력해 주세요.'
  if (!payload.outbound_type) return '불출 유형을 선택해 주세요.'

  const items = payload.items.filter((item) => Number(item.quantity) > 0)
  if (!items.length) return '불출 수량이 1개 이상인 품목을 입력해 주세요.'

  if (payload.outbound_type === 'production' && !payload.order_id?.trim()) {
    return '생산 불출은 주문을 선택해 주세요.'
  }

  for (const item of items) {
    if (!item.material_id?.trim()) return '자재를 선택해 주세요.'
  }

  return null
}

export async function fetchMaterialOutbounds(): Promise<FetchMaterialOutboundsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingFetchEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('material_outbound_records')
      .select(
        `
        *,
        material_outbound_lines (
          id,
          outbound_id,
          line_seq,
          material_id,
          quantity
        )
      `,
      )
      .order('outbound_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const records = (data || []) as MaterialOutboundRecord[]
    const materialIds = records.flatMap((record) =>
      (record.material_outbound_lines || []).map((line) => line.material_id),
    )
    const orderIds = [...new Set(records.map((record) => record.order_id).filter(Boolean))] as string[]

    const [itemsById, ordersResult] = await Promise.all([
      fetchItemsByIds(materialIds),
      orderIds.length
        ? supabase.from('orders').select('id, customer').in('id', orderIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (ordersResult.error) {
      return { ok: false, reason: 'query', detail: ordersResult.error.message }
    }

    const orderMetaById = new Map(
      (ordersResult.data || []).map((row) => [
        row.id as string,
        { orderNumber: row.id as string, customer: String(row.customer || '') },
      ]),
    )

    const outbounds = groupOutboundsFromRecords(
      attachItemsToOutboundRecords(records, itemsById),
      orderMetaById,
    )
    return { ok: true, outbounds }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

async function fetchBomEdges(): Promise<BomEdge[]> {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('bom_detail')
    .select('parent_product_id, child_product_id, quantity_per, child_item_category')

  if (error) {
    if (isMissingMaterialOutboundTable(error.message) || error.message.includes('bom')) {
      const fallback = await supabase
        .from('bom_items')
        .select('parent_product_id, child_product_id, quantity_per')
      if (fallback.error) throw new Error(fallback.error.message)

      const childIds = [...new Set((fallback.data || []).map((row) => String(row.child_product_id)))]
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, item_category')
        .in('id', childIds.length ? childIds : ['__none__'])
      if (itemsError) throw new Error(itemsError.message)
      const categoryById = new Map(
        (items || []).map((row) => [row.id as string, Number(row.item_category) || 0]),
      )

      return (fallback.data || []).map((row) => ({
        parentProductId: String(row.parent_product_id || '').trim(),
        childProductId: String(row.child_product_id || '').trim(),
        quantityPer: Number(row.quantity_per) || 0,
        childItemCategory: categoryById.get(String(row.child_product_id || '').trim()) || 0,
      }))
    }
    throw new Error(error.message)
  }

  return (data || []).map((row) => ({
    parentProductId: String(row.parent_product_id || '').trim(),
    childProductId: String(row.child_product_id || '').trim(),
    quantityPer: Number(row.quantity_per) || 0,
    childItemCategory: Number(row.child_item_category) || 0,
  }))
}

export { fetchBomEdges }

async function fetchIssuedOrderMaterialRows() {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('material_outbound_records')
    .select(
      `
      order_id,
      material_outbound_lines (
        material_id,
        quantity
      )
    `,
    )
    .not('order_id', 'is', null)

  if (error) throw new Error(error.message)

  const flat: { order_id: string | null; material_id: string; quantity: number }[] = []
  for (const record of data || []) {
    for (const line of record.material_outbound_lines || []) {
      flat.push({
        order_id: record.order_id,
        material_id: line.material_id,
        quantity: Number(line.quantity) || 0,
      })
    }
  }
  return flat
}

export async function fetchMaterialOutboundPageData(): Promise<FetchMaterialOutboundPageResult> {
  const [outboundsResult, materialsResult, ordersResult] = await Promise.all([
    fetchMaterialOutbounds(),
    fetchMaterials(),
    fetchOrders({ includeDerivedLines: true }),
  ])

  if (!outboundsResult.ok) return outboundsResult
  if (!materialsResult.ok) return materialsResult
  if (!ordersResult.ok) return ordersResult

  try {
    const supabase = createSupabaseClient()
    const [bomEdges, issuedRows, inboundLinesResult, outboundLinesResult] = await Promise.all([
      fetchBomEdges(),
      fetchIssuedOrderMaterialRows(),
      supabase.from('material_inbound_lines').select('material_id, quantity'),
      supabase.from('material_outbound_lines').select('material_id, quantity'),
    ])

    if (inboundLinesResult.error && !isMissingMaterialInboundTable(inboundLinesResult.error.message)) {
      return { ok: false, reason: 'query', detail: inboundLinesResult.error.message }
    }
    if (
      outboundLinesResult.error &&
      !isMissingMaterialOutboundTable(outboundLinesResult.error.message)
    ) {
      return { ok: false, reason: 'query', detail: outboundLinesResult.error.message }
    }

    const edgesByParent = new Map<string, BomEdge[]>()
    for (const edge of bomEdges) {
      if (!edge.parentProductId || !edge.childProductId) continue
      const list = edgesByParent.get(edge.parentProductId) || []
      list.push(edge)
      edgesByParent.set(edge.parentProductId, list)
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

    const onHandByMaterialId = new Map<string, number>()
    for (const materialId of new Set([...inboundByMaterialId.keys(), ...outboundByMaterialId.keys()])) {
      onHandByMaterialId.set(
        materialId,
        (inboundByMaterialId.get(materialId) ?? 0) - (outboundByMaterialId.get(materialId) ?? 0),
      )
    }

    const itemNameById = new Map(materialsResult.materials.map((material) => [material.id, material.materialName]))
    const issuedByOrderMaterial = aggregateIssuedByOrderMaterial(issuedRows)
    const needs = buildOutboundNeedRows({
      orders: ordersResult.orders,
      edgesByParent,
      itemNameById,
      issuedByOrderMaterial,
    })
    const needCards = buildOutboundNeedCards({
      rows: needs,
      edgesByParent,
      onHandByMaterialId,
    })

    return {
      ok: true,
      outbounds: outboundsResult.outbounds,
      needs,
      needCards,
      bomEdges,
      materials: materialsResult.materials,
      orders: ordersResult.orders,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

async function fetchOutboundRecordById(outboundId: string) {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('material_outbound_records')
    .select(
      `
      *,
      material_outbound_lines (
        id,
        outbound_id,
        line_seq,
        material_id,
        quantity
      )
    `,
    )
    .eq('id', outboundId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as MaterialOutboundRecord | null
}

export async function createMaterialOutbound(
  payload: MaterialOutboundRowPayload,
): Promise<SaveMaterialOutboundResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const validationError = validateOutboundPayload(payload)
  if (validationError) {
    return { ok: false, reason: 'validation', detail: validationError }
  }

  const items = payload.items
    .filter((item) => Number(item.quantity) > 0)
    .map((item) => ({
      material_id: item.material_id.trim(),
      quantity: Number(item.quantity),
    }))

  try {
    const supabase = createSupabaseClient()
    const { data: inserted, error } = await supabase
      .from('material_outbound_records')
      .insert({
        outbound_date: payload.outbound_date,
        outbound_type: payload.outbound_type,
        order_id: payload.order_id,
        note: payload.note,
      })
      .select('id')
      .single()

    if (error || !inserted?.id) {
      return { ok: false, reason: 'query', detail: error?.message || '불출 저장에 실패했습니다.' }
    }

    const { error: linesError } = await supabase.from('material_outbound_lines').insert(
      items.map((item, index) => ({
        outbound_id: inserted.id,
        line_seq: index,
        material_id: item.material_id,
        quantity: item.quantity,
      })),
    )

    if (linesError) {
      await supabase.from('material_outbound_records').delete().eq('id', inserted.id)
      return { ok: false, reason: 'query', detail: linesError.message }
    }

    return { ok: true, outboundId: inserted.id, outboundNumber: inserted.id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateMaterialOutbound(
  outboundId: string,
  payload: MaterialOutboundRowPayload,
): Promise<SaveMaterialOutboundResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const validationError = validateOutboundPayload(payload)
  if (validationError) {
    return { ok: false, reason: 'validation', detail: validationError }
  }

  const items = payload.items
    .filter((item) => Number(item.quantity) > 0)
    .map((item) => ({
      material_id: item.material_id.trim(),
      quantity: Number(item.quantity),
    }))

  try {
    const existing = await fetchOutboundRecordById(outboundId)
    if (!existing?.id) {
      return { ok: false, reason: 'query', detail: '불출 전표를 찾을 수 없습니다.' }
    }

    if (existing.outbound_type !== payload.outbound_type) {
      return { ok: false, reason: 'validation', detail: '불출 유형은 수정할 수 없습니다.' }
    }

    const supabase = createSupabaseClient()
    const { error: updateError } = await supabase
      .from('material_outbound_records')
      .update({
        outbound_date: payload.outbound_date,
        order_id: payload.order_id,
        note: payload.note,
      })
      .eq('id', outboundId)

    if (updateError) {
      return { ok: false, reason: 'query', detail: updateError.message }
    }

    const { error: deleteError } = await supabase
      .from('material_outbound_lines')
      .delete()
      .eq('outbound_id', outboundId)

    if (deleteError) {
      return { ok: false, reason: 'query', detail: deleteError.message }
    }

    const { error: linesError } = await supabase.from('material_outbound_lines').insert(
      items.map((item, index) => ({
        outbound_id: outboundId,
        line_seq: index,
        material_id: item.material_id,
        quantity: item.quantity,
      })),
    )

    if (linesError) {
      return { ok: false, reason: 'query', detail: linesError.message }
    }

    return { ok: true, outboundId, outboundNumber: outboundId }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteMaterialOutbound(outboundId: string): Promise<DeleteMaterialOutboundResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('material_outbound_records').delete().eq('id', outboundId)
    if (error) return { ok: false, reason: 'query', detail: error.message }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
