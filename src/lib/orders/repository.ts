import { createSupabaseClient } from '@/lib/supabase'
import { syncAssemblyGroupsForOrder } from '@/lib/assembly/repository'
import type { OrderListGroup, OrderRecord, OrderRowPayload } from './types'
import { groupOrdersFromRecords, validateOrderCodeInput } from './utils'

export type FetchOrdersResult =
  | { ok: true; orders: OrderListGroup[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveOrderResult =
  | { ok: true; orderId: string; orderNumber: string }
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

function mapOrderSaveError(detail: string) {
  if (detail.includes('order_lines_product_id_fkey')) {
    return '주문 품목 FK가 품목등록(items)과 맞지 않습니다. Supabase SQL Editor에서 supabase/setup-items.sql 하단 FK 교체 구문을 실행한 뒤, Supabase Dashboard → Settings → API에서 schema cache를 새로고침해 주세요.'
  }
  return detail
}

async function insertOrderLines(orderId: string, items: OrderRowPayload['items']) {
  const supabase = createSupabaseClient()
  const rows = items.map((item, index) => ({
    order_id: orderId,
    line_seq: index,
    product_id: item.productId || null,
    product_code: item.productId || item.productCode,
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    order_amount: item.orderAmount,
  }))

  const { error } = await supabase.from('order_lines').insert(rows)
  if (error) throw new Error(error.message)
}

export async function fetchOrders(options?: {
  includeDerivedLines?: boolean
}): Promise<FetchOrdersResult> {
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
      .order('created_at', { ascending: false })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const orders = groupOrdersFromRecords((data || []) as OrderRecord[], {
      includeDerivedLines: options?.includeDerivedLines,
    })
    return { ok: true, orders }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function fetchOrderById(orderId: string): Promise<OrderListGroup | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null
  }

  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_lines(*)')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !data) return null
  return groupOrdersFromRecords([data as OrderRecord])[0] ?? null
}

/** @deprecated orderNumber는 id(MRO-0001)와 동일 */
export async function fetchOrderByNumber(orderNumber: string): Promise<OrderListGroup | null> {
  return fetchOrderById(orderNumber)
}

export async function createOrder(payload: OrderRowPayload): Promise<SaveOrderResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()

    const rawOrderCode = payload.id?.trim() || ''
    const orderCodeResult = validateOrderCodeInput(rawOrderCode)
    if (!orderCodeResult.ok) {
      return { ok: false, reason: 'query', detail: orderCodeResult.message }
    }
    const orderCode = orderCodeResult.code

    if (orderCode) {
      const codeCheck = await supabase.from('orders').select('id').eq('id', orderCode).maybeSingle()
      if (codeCheck.error) {
        return { ok: false, reason: 'query', detail: codeCheck.error.message }
      }
      if (codeCheck.data?.id) {
        return { ok: false, reason: 'query', detail: `이미 사용 중인 주문코드입니다: ${orderCode}` }
      }
    }

    const insertRow: {
      id?: string
      order_date: string
      delivery_date: string | null
      customer: string
      category: string
      source: string
      source_quote_id: string | null
    } = {
      order_date: payload.order_date,
      delivery_date: payload.delivery_date || null,
      customer: payload.customer,
      category: payload.category,
      source: payload.source || 'manual',
      source_quote_id: payload.source_quote_id || null,
    }

    if (orderCode) {
      insertRow.id = orderCode
    }

    const { data: inserted, error } = await supabase.from('orders').insert(insertRow).select('id').single()

    if (error || !inserted?.id) {
      return { ok: false, reason: 'query', detail: error?.message || '주문서 저장에 실패했습니다.' }
    }

    await insertOrderLines(inserted.id, payload.items)
    await syncAssemblyGroupsForOrder(inserted.id)
    return { ok: true, orderId: inserted.id, orderNumber: inserted.id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: mapOrderSaveError(error instanceof Error ? error.message : String(error)),
    }
  }
}

export async function updateOrder(orderId: string, payload: OrderRowPayload): Promise<SaveOrderResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data: existing, error: fetchError } = await supabase
      .from('orders')
      .select('id')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchError) return { ok: false, reason: 'query', detail: fetchError.message }
    if (!existing?.id) {
      return { ok: false, reason: 'query', detail: `주문서를 찾을 수 없습니다: ${orderId}` }
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
    await syncAssemblyGroupsForOrder(existing.id)
    return { ok: true, orderId: existing.id, orderNumber: existing.id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: mapOrderSaveError(error instanceof Error ? error.message : String(error)),
    }
  }
}

export async function deleteOrder(orderId: string): Promise<DeleteOrderResult> {
  if (!orderId.trim()) return { ok: true }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('orders').delete().eq('id', orderId)

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
