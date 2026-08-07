import { assertCanWrite } from '@/lib/auth/assert-can-write'
import {
  isMissingCreatedByColumn,
  stripCreatedByFields,
  withCreatedByFields,
} from '@/lib/auth/created-by'
import { insertChangeLog, formatChangeLogWarning } from '@/lib/change-logs/repository'
import { buildOrderChangeDetail } from '@/lib/change-logs/utils'
import { createSupabaseClient } from '@/lib/supabase'
import { isMissingRpcFunction } from '@/lib/supabase/rpc'
import { syncAssemblyGroupsForOrder } from '@/lib/assembly/repository'
import type { OrderListGroup, OrderRecord, OrderRowPayload } from './types'
import { groupOrdersFromRecords, validateOrderCodeInput } from './utils'

export type FetchOrdersResult =
  | { ok: true; orders: OrderListGroup[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveOrderResult =
  | { ok: true; orderId: string; orderNumber: string; changeLogWarning?: string }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

export type DeleteOrderResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

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
  if (detail.includes('ORDER_CODE_TAKEN')) {
    return `이미 사용 중인 주문코드입니다: ${detail.split(':').slice(1).join(':') || ''}`.trim()
  }
  if (detail.includes('ORDER_NOT_FOUND')) {
    return `주문서를 찾을 수 없습니다: ${detail.split(':').slice(1).join(':') || ''}`.trim()
  }
  if (detail.includes('AUTH_REQUIRED')) {
    return '로그인이 필요합니다.'
  }
  return detail
}

function orderLinesJson(items: OrderRowPayload['items']) {
  return items.map((item) => ({
    product_id: item.productId || null,
    product_code: item.productCode || item.productId || '',
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    order_amount: item.orderAmount,
    delivery_date: item.deliveryDate?.trim() || null,
  }))
}

async function insertOrderLines(orderId: string, items: OrderRowPayload['items']) {
  const supabase = createSupabaseClient()
  const rows = items.map((item, index) => ({
    order_id: orderId,
    line_seq: index,
    product_id: item.productId || null,
    product_code: item.productCode || item.productId || '',
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    order_amount: item.orderAmount,
    delivery_date: item.deliveryDate?.trim() || null,
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

/** 견적에서 이미 전환된 주문서 번호 (있으면) */
export async function findOrderNumberBySourceQuoteId(
  quoteId: string,
): Promise<{ ok: true; orderNumber: string | null } | { ok: false; detail: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const id = String(quoteId || '').trim()
  if (!id) return { ok: true, orderNumber: null }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('source_quote_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return { ok: false, detail: error.message }
    return { ok: true, orderNumber: data?.id ? String(data.id) : null }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/** @deprecated orderNumber는 id와 동일 */
export async function fetchOrderByNumber(orderNumber: string): Promise<OrderListGroup | null> {
  return fetchOrderById(orderNumber)
}

export async function createOrder(payload: OrderRowPayload): Promise<SaveOrderResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'sales', action: 'create' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()

    const rawOrderCode = payload.id?.trim() || ''
    const orderCodeResult = validateOrderCodeInput(rawOrderCode)
    if (!orderCodeResult.ok) {
      return { ok: false, reason: 'query', detail: orderCodeResult.message }
    }
    const orderCode = orderCodeResult.code

    const header = {
      id: orderCode || null,
      order_date: payload.order_date,
      delivery_date: payload.delivery_date || null,
      customer: payload.customer,
      category: payload.category,
      source: payload.source || 'manual',
      source_quote_id: payload.source_quote_id || null,
      note: payload.note?.trim() || '',
    }
    const lines = orderLinesJson(payload.items)

    const { data: rpcData, error: rpcError } = await supabase.rpc('save_order_create', {
      p_header: header,
      p_lines: lines,
    })

    if (!rpcError) {
      const orderId = String((rpcData as { orderId?: string } | null)?.orderId || '').trim()
      if (!orderId) {
        return { ok: false, reason: 'query', detail: '주문서 저장에 실패했습니다.' }
      }
      // 등록자 컬럼이 있으면 후속 갱신 (RPC는 스키마 호환을 위해 생략)
      const createdBy = await withCreatedByFields({})
      if (createdBy.created_by || createdBy.created_by_name) {
        const patch = await supabase.from('orders').update(createdBy).eq('id', orderId)
        if (patch.error && !isMissingCreatedByColumn(patch.error.message)) {
          console.warn('[orders] created_by patch failed:', patch.error.message)
        }
      }
      await syncAssemblyGroupsForOrder(orderId)
      return { ok: true, orderId, orderNumber: orderId }
    }

    if (!isMissingRpcFunction(rpcError.message)) {
      return { ok: false, reason: 'query', detail: mapOrderSaveError(rpcError.message) }
    }

    // RPC 미적용 환경 — 레거시 비원자 경로
    if (orderCode) {
      const codeCheck = await supabase.from('orders').select('id').eq('id', orderCode).maybeSingle()
      if (codeCheck.error) {
        return { ok: false, reason: 'query', detail: codeCheck.error.message }
      }
      if (codeCheck.data?.id) {
        return { ok: false, reason: 'query', detail: `이미 사용 중인 주문코드입니다: ${orderCode}` }
      }
    }

    const baseRow: {
      id?: string
      order_date: string
      delivery_date: string | null
      customer: string
      category: string
      source: string
      source_quote_id: string | null
      note: string
    } = {
      order_date: payload.order_date,
      delivery_date: payload.delivery_date || null,
      customer: payload.customer,
      category: payload.category,
      source: payload.source || 'manual',
      source_quote_id: payload.source_quote_id || null,
      note: payload.note?.trim() || '',
    }

    if (orderCode) {
      baseRow.id = orderCode
    }

    const insertRow = await withCreatedByFields(baseRow)
    let { data: inserted, error } = await supabase.from('orders').insert(insertRow).select('id').single()

    if (error && isMissingCreatedByColumn(error.message)) {
      ;({ data: inserted, error } = await supabase
        .from('orders')
        .insert(stripCreatedByFields(insertRow))
        .select('id')
        .single())
    }

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

export async function updateOrder(
  orderId: string,
  payload: OrderRowPayload,
  options?: { reason?: string },
): Promise<SaveOrderResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'sales', action: 'update' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    const { data: existing, error: fetchError } = await supabase
      .from('orders')
      .select('*, order_lines(*)')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchError) return { ok: false, reason: 'query', detail: fetchError.message }
    if (!existing?.id) {
      return { ok: false, reason: 'query', detail: `주문서를 찾을 수 없습니다: ${orderId}` }
    }

    const beforeGroup = groupOrdersFromRecords([existing as OrderRecord])[0]
    const header = {
      order_date: payload.order_date,
      delivery_date: payload.delivery_date || null,
      customer: payload.customer,
      category: payload.category,
      note: payload.note?.trim() || '',
    }
    const lines = orderLinesJson(payload.items)

    const { error: rpcError } = await supabase.rpc('save_order_update', {
      p_order_id: existing.id,
      p_header: header,
      p_lines: lines,
    })

    if (rpcError) {
      if (!isMissingRpcFunction(rpcError.message)) {
        return { ok: false, reason: 'query', detail: mapOrderSaveError(rpcError.message) }
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          order_date: payload.order_date,
          delivery_date: payload.delivery_date || null,
          customer: payload.customer,
          category: payload.category,
          note: payload.note?.trim() || '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) return { ok: false, reason: 'query', detail: updateError.message }

      const { error: deleteError } = await supabase.from('order_lines').delete().eq('order_id', existing.id)
      if (deleteError) return { ok: false, reason: 'query', detail: deleteError.message }

      await insertOrderLines(existing.id, payload.items)
    }

    await syncAssemblyGroupsForOrder(existing.id)

    const afterTotalAmount = payload.items.reduce(
      (sum, item) => sum + Math.max(0, Math.round(Number(item.orderAmount) || 0)),
      0,
    )
    const afterTotalQuantity = payload.items.reduce(
      (sum, item) => sum + Math.max(0, Math.floor(Number(item.quantity) || 0)),
      0,
    )
    const detail = buildOrderChangeDetail({
      before: {
        customer: beforeGroup?.customer || '',
        category: beforeGroup?.category || '',
        note: beforeGroup?.note || '',
        orderDate: beforeGroup?.orderDate || '',
        deliveryDate: beforeGroup?.deliveryDate || '',
        lineCount: beforeGroup?.items.length || 0,
        totalAmount: beforeGroup?.totalAmount || 0,
        totalQuantity: beforeGroup?.totalQuantity || 0,
      },
      after: {
        customer: payload.customer,
        category: payload.category,
        note: payload.note?.trim() || '',
        orderDate: payload.order_date,
        deliveryDate: payload.delivery_date || '',
        lineCount: payload.items.length,
        totalAmount: afterTotalAmount,
        totalQuantity: afterTotalQuantity,
      },
    })

    const changeLogResult = await insertChangeLog({
      entityType: 'order',
      entityId: existing.id,
      title: `주문서 ${existing.id} 수정`,
      detail,
      reason: options?.reason,
      beforeData: {
        customer: beforeGroup?.customer,
        totalAmount: beforeGroup?.totalAmount,
        totalQuantity: beforeGroup?.totalQuantity,
      },
      afterData: {
        customer: payload.customer,
        totalAmount: afterTotalAmount,
        totalQuantity: afterTotalQuantity,
      },
    })

    return {
      ok: true,
      orderId: existing.id,
      orderNumber: existing.id,
      changeLogWarning: formatChangeLogWarning(changeLogResult),
    }
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

  const gate = await assertCanWrite({ module: 'sales', action: 'delete' })
  if (!gate.ok) return gate

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
