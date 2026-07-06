import { createSupabaseClient } from '@/lib/supabase'
import type {
  MaterialPurchaseOrderListGroup,
  MaterialPurchaseOrderRecord,
  MaterialPurchaseOrderRowPayload,
} from './types'
import { groupMaterialPurchaseOrdersFromRecords } from './utils'

export type FetchMaterialPurchaseOrdersResult =
  | { ok: true; orders: MaterialPurchaseOrderListGroup[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveMaterialPurchaseOrderResult =
  | { ok: true; orderId: string; orderNumber: string }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type DeleteMaterialPurchaseOrderResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query'; detail: string }

function missingEnvResult(): SaveMaterialPurchaseOrderResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

export function isMissingMaterialPurchaseOrdersTable(detail: string) {
  return (
    detail.includes('material_purchase_orders') ||
    detail.includes('material_purchase_order_lines') ||
    detail.includes('schema cache')
  )
}

async function insertMaterialPurchaseOrderLines(
  orderId: string,
  items: MaterialPurchaseOrderRowPayload['items'],
) {
  const supabase = createSupabaseClient()
  const rows = items.map((item, index) => ({
    order_id: orderId,
    line_seq: index,
    material_id: item.materialId || null,
    cpn: item.cpn,
    material_name: item.materialName,
    specification: item.specification,
    mpn: item.mpn,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    order_amount: item.orderAmount,
    status: item.status,
    inbound_quantity: item.inboundQuantity,
  }))

  const { error } = await supabase.from('material_purchase_order_lines').insert(rows)
  if (error) throw new Error(error.message)
}

async function fetchOrderHasInbound(orderId: string) {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('material_purchase_order_lines')
    .select('inbound_quantity')
    .eq('order_id', orderId)

  if (error) throw new Error(error.message)
  return (data || []).some((line) => Number(line.inbound_quantity) > 0)
}

export async function fetchMaterialPurchaseOrders(): Promise<FetchMaterialPurchaseOrdersResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('material_purchase_orders')
      .select('*, material_purchase_order_lines(*)')
      .order('order_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const orders = groupMaterialPurchaseOrdersFromRecords((data || []) as MaterialPurchaseOrderRecord[])
    return { ok: true, orders }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createMaterialPurchaseOrder(
  payload: MaterialPurchaseOrderRowPayload,
): Promise<SaveMaterialPurchaseOrderResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data: inserted, error } = await supabase
      .from('material_purchase_orders')
      .insert({
        order_date: payload.order_date,
        delivery_date: payload.delivery_date || null,
        supplier: payload.supplier,
      })
      .select('id')
      .single()

    if (error || !inserted?.id) {
      return { ok: false, reason: 'query', detail: error?.message || '자재 발주 저장에 실패했습니다.' }
    }

    await insertMaterialPurchaseOrderLines(inserted.id, payload.items)
    return { ok: true, orderId: inserted.id, orderNumber: inserted.id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateMaterialPurchaseOrder(
  orderId: string,
  payload: MaterialPurchaseOrderRowPayload,
): Promise<SaveMaterialPurchaseOrderResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data: existing, error: fetchError } = await supabase
      .from('material_purchase_orders')
      .select('id')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchError) return { ok: false, reason: 'query', detail: fetchError.message }
    if (!existing?.id) {
      return { ok: false, reason: 'query', detail: `발주를 찾을 수 없습니다: ${orderId}` }
    }

    if (await fetchOrderHasInbound(existing.id)) {
      return {
        ok: false,
        reason: 'query',
        detail: '입고 이력이 있는 발주는 수정할 수 없습니다.',
      }
    }

    const { error: updateError } = await supabase
      .from('material_purchase_orders')
      .update({
        order_date: payload.order_date,
        delivery_date: payload.delivery_date || null,
        supplier: payload.supplier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) return { ok: false, reason: 'query', detail: updateError.message }

    const { error: deleteError } = await supabase
      .from('material_purchase_order_lines')
      .delete()
      .eq('order_id', existing.id)

    if (deleteError) return { ok: false, reason: 'query', detail: deleteError.message }

    await insertMaterialPurchaseOrderLines(existing.id, payload.items)
    return { ok: true, orderId: existing.id, orderNumber: existing.id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteMaterialPurchaseOrder(
  orderId: string,
): Promise<DeleteMaterialPurchaseOrderResult> {
  if (!orderId.trim()) return { ok: true }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    if (await fetchOrderHasInbound(orderId)) {
      return {
        ok: false,
        reason: 'query',
        detail: '입고 이력이 있는 발주는 삭제할 수 없습니다.',
      }
    }

    const supabase = createSupabaseClient()
    const { error } = await supabase.from('material_purchase_orders').delete().eq('id', orderId)

    if (error) {
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
