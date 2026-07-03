import { createSupabaseClient } from '@/lib/supabase'
import type { OrderListGroup, OrderRecord, OrderRowPayload } from './types'
import { groupOrdersFromRecords } from './utils'

export type FetchOrdersResult =
  | { ok: true; orders: OrderListGroup[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveOrderResult =
  | { ok: true; orderNumber: string }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type DeleteOrderResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query'; detail: string }

function missingEnvResult(): SaveOrderResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

function isMissingOrdersTable(detail: string) {
  return detail.includes('orders') || detail.includes('order_lines') || detail.includes('schema cache')
}

async function insertOrderLines(orderId: string, items: OrderRowPayload['items']) {
  const supabase = createSupabaseClient()
  const rows = items.map((item, index) => ({
    order_id: orderId,
    line_seq: index,
    product_code: item.productCode,
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    order_amount: item.orderAmount,
  }))

  const { error } = await supabase.from('order_lines').insert(rows)
  if (error) throw new Error(error.message)
}

export async function fetchOrders(): Promise<FetchOrdersResult> {
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
      .from('orders')
      .select('*, order_lines(*)')
      .order('order_date', { ascending: false })
      .order('order_number', { ascending: false })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const orders = groupOrdersFromRecords((data || []) as OrderRecord[])
    return { ok: true, orders }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function fetchOrderByNumber(orderNumber: string): Promise<OrderListGroup | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null
  }

  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_lines(*)')
    .eq('order_number', orderNumber)
    .maybeSingle()

  if (error || !data) return null
  return groupOrdersFromRecords([data as OrderRecord])[0] ?? null
}

export async function createOrder(payload: OrderRowPayload): Promise<SaveOrderResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    let orderNumber = payload.order_number?.trim() || ''

    if (!orderNumber) {
      const { data: generated, error: rpcError } = await supabase.rpc('generate_order_number')
      if (rpcError) return { ok: false, reason: 'query', detail: rpcError.message }
      if (!generated || typeof generated !== 'string') {
        return { ok: false, reason: 'query', detail: '주문서 번호를 생성하지 못했습니다.' }
      }
      orderNumber = generated
    } else {
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', orderNumber)
        .maybeSingle()
      if (existing) {
        return { ok: false, reason: 'query', detail: `이미 존재하는 주문서번호입니다: ${orderNumber}` }
      }
    }

    const { data: inserted, error } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        order_date: payload.order_date,
        delivery_date: payload.delivery_date || null,
        customer: payload.customer,
        category: payload.category,
        source: payload.source || 'manual',
        source_quote_number: payload.source_quote_number || null,
      })
      .select('id')
      .single()

    if (error || !inserted?.id) {
      return { ok: false, reason: 'query', detail: error?.message || '주문서 저장에 실패했습니다.' }
    }

    await insertOrderLines(inserted.id, payload.items)
    return { ok: true, orderNumber }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateOrder(orderNumber: string, payload: OrderRowPayload): Promise<SaveOrderResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data: existing, error: fetchError } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', orderNumber)
      .maybeSingle()

    if (fetchError) return { ok: false, reason: 'query', detail: fetchError.message }
    if (!existing?.id) {
      return { ok: false, reason: 'query', detail: `주문서를 찾을 수 없습니다: ${orderNumber}` }
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        order_date: payload.order_date,
        delivery_date: payload.delivery_date || null,
        customer: payload.customer,
        category: payload.category,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) return { ok: false, reason: 'query', detail: updateError.message }

    const { error: deleteError } = await supabase.from('order_lines').delete().eq('order_id', existing.id)
    if (deleteError) return { ok: false, reason: 'query', detail: deleteError.message }

    await insertOrderLines(existing.id, payload.items)
    return { ok: true, orderNumber }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteOrder(orderNumber: string): Promise<DeleteOrderResult> {
  if (!orderNumber.trim()) return { ok: true }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('orders').delete().eq('order_number', orderNumber)

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

export { isMissingOrdersTable }
