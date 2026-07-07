import { createSupabaseClient } from '@/lib/supabase'
import { fetchMaterials } from '@/lib/materials/repository'
import { fetchMaterialPurchaseOrders } from '@/lib/materials/purchase-orders/repository'
import type { Material } from '@/lib/materials/types'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import type { MaterialInboundListGroup, MaterialInboundRecord, MaterialInboundRowPayload } from './types'
import { filterPurchaseOrdersWithRemaining, groupInboundsFromRecords } from './utils'

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
    detail.includes('schema cache')
  )
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
    return missingEnvResult()
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
          quantity,
          materials (
            cpn,
            material_name,
            specification,
            mpn
          )
        )
      `,
      )
      .order('inbound_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const inbounds = groupInboundsFromRecords((data || []) as MaterialInboundRecord[])
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
    purchaseOrders: filterPurchaseOrdersWithRemaining(purchaseOrdersResult.orders),
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
