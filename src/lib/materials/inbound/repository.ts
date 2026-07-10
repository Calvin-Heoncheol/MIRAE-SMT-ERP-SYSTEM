import { createSupabaseClient } from '@/lib/supabase'
import { fetchMaterials } from '@/lib/materials/repository'
import { fetchMaterialPurchaseOrders } from '@/lib/materials/purchase-orders/repository'
import type { Material } from '@/lib/materials/types'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import type { MaterialInboundListGroup, MaterialInboundRecord, MaterialInboundRowPayload } from './types'
import { groupInboundsFromRecords } from './utils'

export type FetchMaterialInboundsResult =
  | { ok: true; inbounds: MaterialInboundListGroup[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type FetchMaterialInboundPageResult =
  | {
      ok: true
      inbounds: MaterialInboundListGroup[]
      materials: Material[]
      purchaseOrders: MaterialPurchaseOrderListGroup[]
    }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveMaterialInboundResult =
  | { ok: true; inboundId: string; inboundNumber: string }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export type DeleteMaterialInboundResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query'; detail: string }

function missingFetchEnvResult(): FetchMaterialInboundsResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

function missingEnvResult(): SaveMaterialInboundResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

export function isMissingMaterialInboundTable(detail: string) {
  return (
    detail.includes('material_inbound_records') ||
    detail.includes('material_inbound_lines') ||
    detail.includes('schema cache') ||
    detail.includes('relationship') ||
    detail.includes('items')
  )
}

async function fetchItemsByIds(ids: string[]) {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (!uniqueIds.length) return new Map<string, { id: string; name: string; specification: string; mpn: string }>()

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

function attachItemsToInboundRecords(
  records: MaterialInboundRecord[],
  itemsById: Map<string, { id: string; name: string; specification: string; mpn: string }>,
): MaterialInboundRecord[] {
  return records.map((record) => ({
    ...record,
    material_inbound_lines: (record.material_inbound_lines || []).map((line) => ({
      ...line,
      items: itemsById.get(line.material_id) ?? null,
    })),
  }))
}

async function fetchPurchaseOrderLinesForValidation(orderId: string) {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('material_purchase_order_lines')
    .select('id, material_id, quantity, inbound_quantity')
    .eq('order_id', orderId)

  if (error) throw new Error(error.message)
  return data || []
}

async function applyPurchaseOrderInboundUpdates(
  items: MaterialInboundRowPayload['items'],
) {
  const supabase = createSupabaseClient()

  for (const item of items) {
    if (!item.purchase_order_line_id) continue

    const { data: line, error: fetchError } = await supabase
      .from('material_purchase_order_lines')
      .select('id, quantity, inbound_quantity')
      .eq('id', item.purchase_order_line_id)
      .maybeSingle()

    if (fetchError) throw new Error(fetchError.message)
    if (!line?.id) throw new Error('발주 라인을 찾을 수 없습니다.')

    const ordered = Number(line.quantity) || 0
    const received = Number(line.inbound_quantity) || 0
    const remaining = Math.max(0, ordered - received)
    const inboundQty = Number(item.quantity) || 0

    if (inboundQty > remaining) {
      throw new Error(`입고 수량이 발주 잔량을 초과합니다. (잔량 ${remaining.toLocaleString('ko-KR')})`)
    }

    const { error: updateError } = await supabase
      .from('material_purchase_order_lines')
      .update({ inbound_quantity: received + inboundQty })
      .eq('id', line.id)

    if (updateError) throw new Error(updateError.message)
  }
}

async function revertPurchaseOrderInboundUpdates(
  items: { purchase_order_line_id: string | null; quantity: number }[],
) {
  const supabase = createSupabaseClient()

  for (const item of items) {
    if (!item.purchase_order_line_id) continue

    const { data: line, error: fetchError } = await supabase
      .from('material_purchase_order_lines')
      .select('id, inbound_quantity')
      .eq('id', item.purchase_order_line_id)
      .maybeSingle()

    if (fetchError) throw new Error(fetchError.message)
    if (!line?.id) throw new Error('발주 라인을 찾을 수 없습니다.')

    const received = Number(line.inbound_quantity) || 0
    const inboundQty = Number(item.quantity) || 0
    const nextReceived = Math.max(0, received - inboundQty)

    const { error: updateError } = await supabase
      .from('material_purchase_order_lines')
      .update({ inbound_quantity: nextReceived })
      .eq('id', line.id)

    if (updateError) throw new Error(updateError.message)
  }
}

async function fetchInboundRecordById(inboundId: string) {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('material_inbound_records')
    .select(
      `
      *,
      material_inbound_lines (
        id,
        inbound_id,
        line_seq,
        material_id,
        purchase_order_line_id,
        quantity
      )
    `,
    )
    .eq('id', inboundId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as MaterialInboundRecord | null
}

async function rollbackInboundRecord(inboundId: string) {
  const supabase = createSupabaseClient()
  await supabase.from('material_inbound_records').delete().eq('id', inboundId)
}

function validateInboundPayload(payload: MaterialInboundRowPayload): string | null {
  const items = payload.items.filter((item) => Number(item.quantity) > 0)
  if (!items.length) return '입고 수량이 1개 이상인 품목을 입력해 주세요.'

  if (payload.inbound_type === 'purchase') {
    if (!payload.purchase_order_id?.trim()) return '발주 입고는 발주를 선택해 주세요.'
    for (const item of items) {
      if (!item.purchase_order_line_id) return '발주 라인 정보가 없습니다.'
      if (!item.material_id?.trim()) return '자재코드가 없는 발주 라인은 입고할 수 없습니다.'
    }
    return null
  }

  if (payload.purchase_order_id) return '기초·사급·반품 입고는 발주를 연결할 수 없습니다.'
  for (const item of items) {
    if (!item.material_id?.trim()) return '자재를 선택해 주세요.'
    if (item.purchase_order_line_id) return '발주 입고가 아닌 경우 발주 라인을 연결할 수 없습니다.'
  }

  return null
}

export async function fetchMaterialInbounds(): Promise<FetchMaterialInboundsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingFetchEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('material_inbound_records')
      .select(
        `
        *,
        material_inbound_lines (
          id,
          inbound_id,
          line_seq,
          material_id,
          purchase_order_line_id,
          quantity
        )
      `,
      )
      .order('inbound_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const records = (data || []) as MaterialInboundRecord[]
    const materialIds = records.flatMap((record) =>
      (record.material_inbound_lines || []).map((line) => line.material_id),
    )
    const itemsById = await fetchItemsByIds(materialIds)
    const inbounds = groupInboundsFromRecords(attachItemsToInboundRecords(records, itemsById))
    return { ok: true, inbounds }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function fetchMaterialInboundPageData(): Promise<FetchMaterialInboundPageResult> {
  const [inboundsResult, materialsResult, purchaseOrdersResult] = await Promise.all([
    fetchMaterialInbounds(),
    fetchMaterials(),
    fetchMaterialPurchaseOrders(),
  ])

  if (!inboundsResult.ok) return inboundsResult
  if (!materialsResult.ok) return materialsResult
  if (!purchaseOrdersResult.ok) return purchaseOrdersResult

  return {
    ok: true,
    inbounds: inboundsResult.inbounds,
    materials: materialsResult.materials,
    purchaseOrders: purchaseOrdersResult.orders,
  }
}

export async function updateMaterialInbound(
  inboundId: string,
  payload: MaterialInboundRowPayload,
): Promise<SaveMaterialInboundResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const validationError = validateInboundPayload(payload)
  if (validationError) {
    return { ok: false, reason: 'validation', detail: validationError }
  }

  const items = payload.items
    .filter((item) => Number(item.quantity) > 0)
    .map((item) => ({
      material_id: item.material_id.trim(),
      purchase_order_line_id: item.purchase_order_line_id,
      quantity: Number(item.quantity),
    }))

  try {
    const existing = await fetchInboundRecordById(inboundId)
    if (!existing?.id) {
      return { ok: false, reason: 'query', detail: '입고 전표를 찾을 수 없습니다.' }
    }

    if (existing.inbound_type !== payload.inbound_type) {
      return { ok: false, reason: 'validation', detail: '입고 유형은 수정할 수 없습니다.' }
    }

    if ((existing.purchase_order_id || null) !== (payload.purchase_order_id || null)) {
      return { ok: false, reason: 'validation', detail: '연결된 발주는 수정할 수 없습니다.' }
    }

    const oldLines = (existing.material_inbound_lines || []).map((line) => ({
      material_id: line.material_id,
      purchase_order_line_id: line.purchase_order_line_id,
      quantity: Number(line.quantity) || 0,
    }))

    if (payload.inbound_type === 'purchase' && payload.purchase_order_id) {
      const poLines = await fetchPurchaseOrderLinesForValidation(payload.purchase_order_id)
      const lineById = new Map(poLines.map((line) => [line.id, line]))
      const oldQtyByLineId = new Map(
        oldLines
          .filter((line) => line.purchase_order_line_id)
          .map((line) => [line.purchase_order_line_id as string, line.quantity]),
      )

      for (const item of items) {
        const lineId = item.purchase_order_line_id
        if (!lineId) continue
        const line = lineById.get(lineId)
        if (!line) return { ok: false, reason: 'validation', detail: '발주 라인을 찾을 수 없습니다.' }

        const ordered = Number(line.quantity) || 0
        const received = Number(line.inbound_quantity) || 0
        const previousQty = oldQtyByLineId.get(lineId) ?? 0
        const remaining = Math.max(0, ordered - received + previousQty)

        if (item.quantity > remaining) {
          return {
            ok: false,
            reason: 'validation',
            detail: `입고 수량이 발주 잔량을 초과합니다. (잔량 ${remaining.toLocaleString('ko-KR')})`,
          }
        }
      }
    }

    if (existing.inbound_type === 'purchase') {
      await revertPurchaseOrderInboundUpdates(oldLines)
    }

    const supabase = createSupabaseClient()
    const { error: updateError } = await supabase
      .from('material_inbound_records')
      .update({
        inbound_date: payload.inbound_date,
        note: payload.note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboundId)

    if (updateError) {
      if (existing.inbound_type === 'purchase') {
        await applyPurchaseOrderInboundUpdates(oldLines).catch(() => undefined)
      }
      return { ok: false, reason: 'query', detail: updateError.message }
    }

    const { error: deleteLinesError } = await supabase
      .from('material_inbound_lines')
      .delete()
      .eq('inbound_id', inboundId)

    if (deleteLinesError) {
      if (existing.inbound_type === 'purchase') {
        await applyPurchaseOrderInboundUpdates(oldLines).catch(() => undefined)
      }
      return { ok: false, reason: 'query', detail: deleteLinesError.message }
    }

    const lineRows = items.map((item, index) => ({
      inbound_id: inboundId,
      line_seq: index,
      material_id: item.material_id,
      purchase_order_line_id: item.purchase_order_line_id,
      quantity: item.quantity,
    }))

    const { error: linesError } = await supabase.from('material_inbound_lines').insert(lineRows)
    if (linesError) {
      if (existing.inbound_type === 'purchase') {
        await applyPurchaseOrderInboundUpdates(oldLines).catch(() => undefined)
      }
      return { ok: false, reason: 'query', detail: linesError.message }
    }

    if (payload.inbound_type === 'purchase') {
      try {
        await applyPurchaseOrderInboundUpdates(items)
      } catch (updateError) {
        await revertPurchaseOrderInboundUpdates(items).catch(() => undefined)
        await supabase.from('material_inbound_lines').delete().eq('inbound_id', inboundId)
        await supabase.from('material_inbound_lines').insert(
          oldLines.map((line, index) => ({
            inbound_id: inboundId,
            line_seq: index,
            material_id: line.material_id,
            purchase_order_line_id: line.purchase_order_line_id,
            quantity: line.quantity,
          })),
        )
        await applyPurchaseOrderInboundUpdates(oldLines).catch(() => undefined)
        return {
          ok: false,
          reason: 'query',
          detail: updateError instanceof Error ? updateError.message : String(updateError),
        }
      }
    }

    return { ok: true, inboundId, inboundNumber: inboundId }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteMaterialInbound(inboundId: string): Promise<DeleteMaterialInboundResult> {
  if (!inboundId.trim()) return { ok: true }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    const existing = await fetchInboundRecordById(inboundId)
    if (!existing?.id) return { ok: true }

    const oldLines = (existing.material_inbound_lines || []).map((line) => ({
      purchase_order_line_id: line.purchase_order_line_id,
      quantity: Number(line.quantity) || 0,
    }))

    if (existing.inbound_type === 'purchase') {
      await revertPurchaseOrderInboundUpdates(oldLines)
    }

    const supabase = createSupabaseClient()
    const { error } = await supabase.from('material_inbound_records').delete().eq('id', inboundId)

    if (error) {
      if (existing.inbound_type === 'purchase') {
        await applyPurchaseOrderInboundUpdates(
          oldLines.map((line) => ({
            material_id: '',
            purchase_order_line_id: line.purchase_order_line_id,
            quantity: line.quantity,
          })),
        ).catch(() => undefined)
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createMaterialInbound(
  payload: MaterialInboundRowPayload,
): Promise<SaveMaterialInboundResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const validationError = validateInboundPayload(payload)
  if (validationError) {
    return { ok: false, reason: 'validation', detail: validationError }
  }

  const items = payload.items
    .filter((item) => Number(item.quantity) > 0)
    .map((item) => ({
      material_id: item.material_id.trim(),
      purchase_order_line_id: item.purchase_order_line_id,
      quantity: Number(item.quantity),
    }))

  try {
    if (payload.inbound_type === 'purchase' && payload.purchase_order_id) {
      const poLines = await fetchPurchaseOrderLinesForValidation(payload.purchase_order_id)
      const lineById = new Map(poLines.map((line) => [line.id, line]))

      for (const item of items) {
        const lineId = item.purchase_order_line_id
        if (!lineId) continue
        const line = lineById.get(lineId)
        if (!line) return { ok: false, reason: 'validation', detail: '발주 라인을 찾을 수 없습니다.' }

        const ordered = Number(line.quantity) || 0
        const received = Number(line.inbound_quantity) || 0
        const remaining = Math.max(0, ordered - received)
        if (item.quantity > remaining) {
          return {
            ok: false,
            reason: 'validation',
            detail: `입고 수량이 발주 잔량을 초과합니다. (잔량 ${remaining.toLocaleString('ko-KR')})`,
          }
        }

        if (!line.material_id) {
          return {
            ok: false,
            reason: 'validation',
            detail: '자재코드가 연결되지 않은 발주 라인은 입고할 수 없습니다.',
          }
        }
      }
    }

    const supabase = createSupabaseClient()
    const { data: inserted, error } = await supabase
      .from('material_inbound_records')
      .insert({
        inbound_date: payload.inbound_date,
        inbound_type: payload.inbound_type,
        purchase_order_id: payload.inbound_type === 'purchase' ? payload.purchase_order_id : null,
        note: payload.note,
      })
      .select('id')
      .single()

    if (error || !inserted?.id) {
      return { ok: false, reason: 'query', detail: error?.message || '입고 저장에 실패했습니다.' }
    }

    const lineRows = items.map((item, index) => ({
      inbound_id: inserted.id,
      line_seq: index,
      material_id: item.material_id,
      purchase_order_line_id: item.purchase_order_line_id,
      quantity: item.quantity,
    }))

    const { error: linesError } = await supabase.from('material_inbound_lines').insert(lineRows)
    if (linesError) {
      await rollbackInboundRecord(inserted.id)
      return { ok: false, reason: 'query', detail: linesError.message }
    }

    if (payload.inbound_type === 'purchase') {
      try {
        await applyPurchaseOrderInboundUpdates(items)
      } catch (updateError) {
        await rollbackInboundRecord(inserted.id)
        return {
          ok: false,
          reason: 'query',
          detail: updateError instanceof Error ? updateError.message : String(updateError),
        }
      }
    }

    return { ok: true, inboundId: inserted.id, inboundNumber: inserted.id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
