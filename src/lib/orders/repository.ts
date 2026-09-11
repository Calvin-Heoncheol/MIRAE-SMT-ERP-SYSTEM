import { assertCanWrite } from '@/lib/auth/assert-can-write'
import {
  isMissingCreatedByColumn,
  withCreatedByFields,
} from '@/lib/auth/created-by'
import { insertChangeLog, formatChangeLogWarning } from '@/lib/change-logs/repository'
import { buildOrderChangeDetail } from '@/lib/change-logs/utils'
import {
  fetchPaymentTermSnapshotForCustomer,
  firstNonEmptyPaymentTermSnapshot,
  paymentTermSnapshotFromDbRow,
  persistPaymentTermSnapshot,
  resolvePaymentTermSnapshotForUpdate,
  type PaymentTermSnapshot,
} from '@/lib/partners/payment-term-snapshot'
import { fetchQuotePaymentSnapshot } from '@/lib/quotes/repository'
import { createSupabaseClient } from '@/lib/supabase'
import { isMissingRpcFunction } from '@/lib/supabase/rpc'
import { missingRpcMigrationMessage } from '@/lib/supabase/required-migrations'
import { syncAssemblyGroupsForOrder } from '@/lib/assembly/repository'
import { parseOrderRecord, parseOrderRecords } from '@/lib/db/parse-row'
import type { OrderCurrency, OrderListGroup, OrderRecord, OrderRowPayload } from './types'
import {
  groupOrdersFromRecords,
  isBillingOnlyOrderItem,
  normalizeOrderCurrency,
  sumCommercialOrderQuantity,
} from './utils'

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

function isMissingOrdersCurrencyColumn(detail: string) {
  return (
    detail.includes('currency') &&
    (detail.includes('schema cache') ||
      detail.includes('does not exist') ||
      detail.includes('Could not find'))
  )
}

async function persistOrderCurrency(orderId: string, currency: OrderCurrency) {
  const supabase = createSupabaseClient()
  const { error } = await supabase
    .from('orders')
    .update({ currency: normalizeOrderCurrency(currency) })
    .eq('id', orderId)
  if (error) {
    if (isMissingOrdersCurrencyColumn(error.message)) {
      throw new Error(
        '발주서 통화(currency) 컬럼이 없습니다. Supabase에서 supabase/migrate-orders-currency.sql 을 실행해 주세요.',
      )
    }
    throw new Error(error.message)
  }
}

function mapOrderSaveError(detail: string) {
  if (detail.includes('order_lines_product_id_fkey')) {
    return '발주 품목 FK가 품목등록(items)과 맞지 않습니다. Supabase SQL Editor에서 supabase/setup-items.sql 하단 FK 교체 구문을 실행한 뒤, Supabase Dashboard → Settings → API에서 schema cache를 새로고침해 주세요.'
  }
  if (detail.includes('ORDER_CODE_TAKEN')) {
    return `이미 사용 중인 발주코드입니다: ${detail.split(':').slice(1).join(':') || ''}`.trim()
  }
  if (detail.includes('ORDER_NOT_FOUND')) {
    return `발주서를 찾을 수 없습니다: ${detail.split(':').slice(1).join(':') || ''}`.trim()
  }
  if (detail.includes('LINE_HAS_PRODUCTION')) {
    const parts = detail.split(':')
    const code = (parts[1] || '').trim()
    const name = (parts[2] || '').trim()
    const label = [code, name].filter(Boolean).join(' ')
    return label
      ? `생산 실적·계획이 있는 품목(${label})은 발주서에서 삭제할 수 없습니다.`
      : '생산 실적·계획이 있는 품목은 발주서에서 삭제할 수 없습니다.'
  }
  if (detail.includes('AUTH_REQUIRED')) {
    return '로그인이 필요합니다.'
  }
  return detail
}

function orderLinesJson(items: OrderRowPayload['items']) {
  return items.map((item) => ({
    id: item.lineId?.trim() || null,
    product_id: item.productId || null,
    product_code: item.productCode || item.productId || '',
    product_name: item.productName,
    quantity: item.quantity,
    setup_cost: item.setupCost ?? 0,
    smd_unit_price: item.smdUnitPrice ?? 0,
    dip_unit_price: item.dipUnitPrice ?? 0,
    material_cost: item.materialCost ?? 0,
    process_type: item.processType || 'smt_post',
    unit_price: item.unitPrice,
    order_amount: item.orderAmount,
    delivery_date: item.deliveryDate?.trim() || null,
    work_number: String(item.workNumber || '').trim() || null,
  }))
}

function isMissingProcessTypeColumn(message: string) {
  return /process_type/i.test(message) && /column|schema|does not exist/i.test(message)
}

/**
 * RPC가 breakdown/공정 컬럼을 누락해도 라인에 반영한다.
 * process_type 컬럼이 없으면 공정만 건너뛴다.
 */
async function applyOrderLineBreakdownAndProcess(
  orderId: string,
  items: OrderRowPayload['items'],
): Promise<{ ok: true } | { ok: false; reason: 'query'; detail: string }> {
  try {
    const supabase = createSupabaseClient()
    const { data: lines, error } = await supabase
      .from('order_lines')
      .select('id, product_id, derived_from_line_id, line_seq')
      .eq('order_id', orderId)
      .order('line_seq', { ascending: true })

    if (error) return { ok: false, reason: 'query', detail: error.message }

    const uiLines = (lines || []).filter((line) => !line.derived_from_line_id)

    for (let index = 0; index < uiLines.length; index += 1) {
      const line = uiLines[index]!
      const item = items[index]
      if (!item) continue
      const isBillingOnly = !String(line.product_id || '').trim()
      const patchWithProcess = {
        setup_cost: isBillingOnly ? 0 : Math.max(0, Math.round(Number(item.setupCost) || 0)),
        smd_unit_price: Math.max(0, Math.round(Number(item.smdUnitPrice) || 0)),
        dip_unit_price: isBillingOnly ? 0 : Math.max(0, Math.round(Number(item.dipUnitPrice) || 0)),
        material_cost: isBillingOnly ? 0 : Math.max(0, Math.round(Number(item.materialCost) || 0)),
        process_type: isBillingOnly ? 'smt_post' : item.processType || 'smt_post',
      }
      const { error: updateError } = await supabase
        .from('order_lines')
        .update(patchWithProcess)
        .eq('id', line.id)

      if (!updateError) continue

      if (isMissingProcessTypeColumn(updateError.message)) {
        const { process_type: _omit, ...withoutProcess } = patchWithProcess
        const retry = await supabase.from('order_lines').update(withoutProcess).eq('id', line.id)
        if (retry.error) return { ok: false, reason: 'query', detail: retry.error.message }
        continue
      }

      return { ok: false, reason: 'query', detail: updateError.message }
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

/**
 * 작업번호는 화면에서 직접 입력한 값을 저장한다 (자동 채번 없음).
 * 추가작업·파생(BOM) 라인은 부모 제품 라인의 작업번호를 따른다.
 */
async function applyManualOrderWorkNumbers(
  orderId: string,
  items: OrderRowPayload['items'],
): Promise<{ ok: true } | { ok: false; reason: 'query'; detail: string }> {
  try {
    const supabase = createSupabaseClient()
    const { data: lines, error } = await supabase
      .from('order_lines')
      .select('id, product_id, derived_from_line_id, line_seq, work_number')
      .eq('order_id', orderId)
      .order('line_seq', { ascending: true })

    if (error) return { ok: false, reason: 'query', detail: error.message }

    const uiLines = (lines || []).filter((line) => !line.derived_from_line_id)
    const workNumberById = new Map<string, string | null>()

    for (let index = 0; index < uiLines.length; index += 1) {
      const line = uiLines[index]!
      const fromPayload = String(items[index]?.workNumber || '').trim() || null
      const isBillingOnly = !String(line.product_id || '').trim()
      const workNumber = isBillingOnly ? null : fromPayload
      workNumberById.set(String(line.id), workNumber)
      if (workNumber === (line.work_number ?? null)) continue
      const { error: updateError } = await supabase
        .from('order_lines')
        .update({ work_number: workNumber })
        .eq('id', line.id)
      if (updateError) return { ok: false, reason: 'query', detail: updateError.message }
    }

    for (const line of lines || []) {
      const parentId = String(line.derived_from_line_id || '').trim()
      if (!parentId) continue
      const parentWorkNumber = workNumberById.get(parentId) ?? null
      if (parentWorkNumber === (line.work_number ?? null)) continue
      const { error: updateError } = await supabase
        .from('order_lines')
        .update({ work_number: parentWorkNumber })
        .eq('id', line.id)
      if (updateError) return { ok: false, reason: 'query', detail: updateError.message }
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

async function resolveOrderPaymentSnapshot(payload: OrderRowPayload): Promise<PaymentTermSnapshot> {
  const fromPayload = payload.paymentTerms
  const fromQuote = payload.source_quote_id
    ? await fetchQuotePaymentSnapshot(payload.source_quote_id)
    : paymentTermSnapshotFromDbRow(null)
  const fromPartner = await fetchPaymentTermSnapshotForCustomer(payload.customer)
  return firstNonEmptyPaymentTermSnapshot(fromPayload, fromQuote, fromPartner)
}

export async function fetchOrders(options?: {
  includeDerivedLines?: boolean
  /** true면 과거 거래명세서용 발주서도 포함 (기본: 제외) */
  includeLegacyStatements?: boolean
  /** true면 과거 거래명세서 발주서만 */
  legacyOnly?: boolean
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
    const PAGE_SIZE = 1000
    const records: OrderRecord[] = []
    let from = 0

    for (;;) {
      const to = from + PAGE_SIZE - 1
      let query = supabase
        .from('orders')
        .select('*, order_lines(*)')
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (options?.legacyOnly) {
        query = query.eq('source', 'legacy_statement')
      } else if (!options?.includeLegacyStatements) {
        query = query.neq('source', 'legacy_statement')
      }

      const { data, error } = await query

      if (error) {
        return { ok: false, reason: 'query', detail: error.message }
      }

      const rows = parseOrderRecords(data)
      records.push(...rows)
      if (rows.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    const orders = groupOrdersFromRecords(records, {
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
  const record = parseOrderRecord(data)
  if (!record) return null
  return groupOrdersFromRecords([record])[0] ?? null
}

/** 견적에서 이미 전환된 발주서 번호 (있으면) */
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
    const paymentSnapshot = await resolveOrderPaymentSnapshot(payload)

    // 발주ID는 항상 자동 발급 ({고객사접두}-YYMMDD-NN). payload.id 는 무시.
    const currency = normalizeOrderCurrency(payload.currency)
    const header = {
      id: null as string | null,
      order_date: payload.order_date,
      delivery_date: payload.delivery_date || null,
      customer: payload.customer,
      category: payload.category,
      source: payload.source || 'manual',
      source_quote_id: payload.source_quote_id || null,
      note: payload.note?.trim() || '',
      customer_po_number: payload.customer_po_number?.trim() || '',
      currency,
    }
    const lines = orderLinesJson(payload.items)

    const { data: rpcData, error: rpcError } = await supabase.rpc('save_order_create', {
      p_header: header,
      p_lines: lines,
    })

    if (!rpcError) {
      const orderId = String((rpcData as { orderId?: string } | null)?.orderId || '').trim()
      if (!orderId) {
        return { ok: false, reason: 'query', detail: '발주서 저장에 실패했습니다.' }
      }
      // 등록자 컬럼이 있으면 후속 갱신 (RPC는 스키마 호환을 위해 생략)
      const createdBy = await withCreatedByFields({})
      if (createdBy.created_by || createdBy.created_by_name) {
        const patch = await supabase.from('orders').update(createdBy).eq('id', orderId)
        if (patch.error && !isMissingCreatedByColumn(patch.error.message)) {
          console.warn('[orders] created_by patch failed:', patch.error.message)
        }
      }
      await persistPaymentTermSnapshot('orders', orderId, paymentSnapshot)
      await persistOrderCurrency(orderId, currency)
      const assemblySync = await syncAssemblyGroupsForOrder(orderId)
      if (!assemblySync.ok) {
        return { ok: false, reason: assemblySync.reason, detail: assemblySync.detail }
      }
      const workNumbers = await applyManualOrderWorkNumbers(orderId, payload.items)
      if (!workNumbers.ok) {
        return { ok: false, reason: workNumbers.reason, detail: workNumbers.detail }
      }
      const breakdown = await applyOrderLineBreakdownAndProcess(orderId, payload.items)
      if (!breakdown.ok) {
        return { ok: false, reason: breakdown.reason, detail: breakdown.detail }
      }
      return { ok: true, orderId, orderNumber: orderId }
    }

    if (!isMissingRpcFunction(rpcError.message)) {
      return { ok: false, reason: 'query', detail: mapOrderSaveError(rpcError.message) }
    }

    return {
      ok: false,
      reason: 'query',
      detail: missingRpcMigrationMessage('save_order_create'),
    }
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
      return { ok: false, reason: 'query', detail: `발주서를 찾을 수 없습니다: ${orderId}` }
    }

    const existingRecord = parseOrderRecord(existing)
    if (!existingRecord) {
      return { ok: false, reason: 'query', detail: `발주서를 찾을 수 없습니다: ${orderId}` }
    }

    const beforeGroup = groupOrdersFromRecords([existingRecord])[0]
    const paymentSnapshot = resolvePaymentTermSnapshotForUpdate({
      previousCustomer: beforeGroup?.customer || existingRecord.customer,
      nextCustomer: payload.customer,
      previousSnapshot:
        beforeGroup?.paymentTerms || paymentTermSnapshotFromDbRow(existingRecord),
      partnerSnapshot: await fetchPaymentTermSnapshotForCustomer(payload.customer),
    })
    const currency = normalizeOrderCurrency(payload.currency)
    const header = {
      order_date: payload.order_date,
      delivery_date: payload.delivery_date || null,
      customer: payload.customer,
      category: payload.category,
      note: payload.note?.trim() || '',
      customer_po_number: payload.customer_po_number?.trim() || '',
      currency,
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
      return {
        ok: false,
        reason: 'query',
        detail: missingRpcMigrationMessage('save_order_update'),
      }
    }

    await persistPaymentTermSnapshot('orders', existing.id, paymentSnapshot)
    await persistOrderCurrency(existing.id, currency)
    const assemblySync = await syncAssemblyGroupsForOrder(existing.id)
    if (!assemblySync.ok) {
      return { ok: false, reason: assemblySync.reason, detail: assemblySync.detail }
    }
    const workNumbers = await applyManualOrderWorkNumbers(existing.id, payload.items)
    if (!workNumbers.ok) {
      return { ok: false, reason: workNumbers.reason, detail: workNumbers.detail }
    }
    const breakdown = await applyOrderLineBreakdownAndProcess(existing.id, payload.items)
    if (!breakdown.ok) {
      return { ok: false, reason: breakdown.reason, detail: breakdown.detail }
    }

    const afterTotalAmount = payload.items.reduce(
      (sum, item) => sum + Math.max(0, Math.round(Number(item.orderAmount) || 0)),
      0,
    )
    const afterTotalQuantity = sumCommercialOrderQuantity(payload.items)
    const detail = buildOrderChangeDetail({
      before: {
        customer: beforeGroup?.customer || '',
        category: beforeGroup?.category || '',
        note: beforeGroup?.note || '',
        customerPoNumber: beforeGroup?.customerPoNumber || '',
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
        customerPoNumber: payload.customer_po_number?.trim() || '',
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
      title: `발주서 ${existing.id} 수정`,
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
