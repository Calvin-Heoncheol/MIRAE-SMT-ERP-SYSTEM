import { assertCanWrite } from '@/lib/auth/assert-can-write'
import {
  isMissingCreatedByColumn,
  stripCreatedByFields,
  withCreatedByFields,
} from '@/lib/auth/created-by'
import { insertChangeLog, formatChangeLogWarning } from '@/lib/change-logs/repository'
import { buildOrderChangeDetail } from '@/lib/change-logs/utils'
import {
  fetchPaymentTermSnapshotForCustomer,
  firstNonEmptyPaymentTermSnapshot,
  isMissingPaymentTermSnapshotColumn,
  omitPaymentTermSnapshotFields,
  paymentTermSnapshotFromDbRow,
  paymentTermSnapshotToDbRow,
  persistPaymentTermSnapshot,
  resolvePaymentTermSnapshotForUpdate,
  type PaymentTermSnapshot,
} from '@/lib/partners/payment-term-snapshot'
import { fetchQuotePaymentSnapshot } from '@/lib/quotes/repository'
import { createSupabaseClient } from '@/lib/supabase'
import { isMissingRpcFunction } from '@/lib/supabase/rpc'
import { syncAssemblyGroupsForOrder } from '@/lib/assembly/repository'
import { parseOrderRecord, parseOrderRecords } from '@/lib/db/parse-row'
import type { OrderCurrency, OrderListGroup, OrderRecord, OrderRowPayload } from './types'
import { formatOrderWorkNumberBase } from './order-code-prefix'
import {
  formatOrderWorkNumber,
  groupOrdersFromRecords,
  isBillingOnlyOrderItem,
  nextOrderWorkSeq,
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
    unit_price: item.unitPrice,
    order_amount: item.orderAmount,
    delivery_date: item.deliveryDate?.trim() || null,
  }))
}

async function resolveOrderWorkNumberBase(
  orderId: string,
  customer?: string | null,
  orderDate?: string | null,
) {
  const supabase = createSupabaseClient()
  let resolvedCustomer = String(customer || '').trim()
  let resolvedOrderDate = String(orderDate || '').trim()
  if (!resolvedCustomer || !resolvedOrderDate) {
    const { data: orderRow } = await supabase
      .from('orders')
      .select('customer, order_date')
      .eq('id', orderId)
      .maybeSingle()
    if (!resolvedCustomer) resolvedCustomer = String(orderRow?.customer || '').trim()
    if (!resolvedOrderDate) resolvedOrderDate = String(orderRow?.order_date || '').trim()
  }
  return formatOrderWorkNumberBase(resolvedCustomer, resolvedOrderDate)
}

async function replaceOrderLinesSafely(
  orderId: string,
  items: OrderRowPayload['items'],
  customer?: string | null,
  orderDate?: string | null,
) {
  const supabase = createSupabaseClient()
  const { data: existingLines, error: fetchError } = await supabase
    .from('order_lines')
    .select('id, product_code, product_name, derived_from_line_id, work_number')
    .eq('order_id', orderId)

  if (fetchError) throw new Error(fetchError.message)

  const workNumberBase = await resolveOrderWorkNumberBase(orderId, customer, orderDate)

  const keepIds = new Set(
    items.map((item) => String(item.lineId || '').trim()).filter(Boolean),
  )
  const uiLines = (existingLines || []).filter((line) => !line.derived_from_line_id)
  const toRemove = uiLines.filter((line) => !keepIds.has(String(line.id)))

  for (const line of toRemove) {
    const lineId = String(line.id)
    const { count: smtCount, error: smtError } = await supabase
      .from('smt_production_records')
      .select('id', { count: 'exact', head: true })
      .eq('order_line_id', lineId)
    if (smtError) throw new Error(smtError.message)
    if ((smtCount || 0) > 0) {
      throw new Error(`LINE_HAS_PRODUCTION:${line.product_code || ''}:${line.product_name || ''}`)
    }

    const { count: planCount, error: planError } = await supabase
      .from('smt_production_plans')
      .select('id', { count: 'exact', head: true })
      .eq('order_line_id', lineId)
    if (planError) throw new Error(planError.message)
    if ((planCount || 0) > 0) {
      throw new Error(`LINE_HAS_PRODUCTION:${line.product_code || ''}:${line.product_name || ''}`)
    }
  }

  if (toRemove.length) {
    const { error: deleteUiError } = await supabase
      .from('order_lines')
      .delete()
      .in(
        'id',
        toRemove.map((line) => String(line.id)),
      )
    if (deleteUiError) throw new Error(deleteUiError.message)
  }

  const { error: deleteDerivedError } = await supabase
    .from('order_lines')
    .delete()
    .eq('order_id', orderId)
    .not('derived_from_line_id', 'is', null)
  if (deleteDerivedError) throw new Error(deleteDerivedError.message)

  const remainingUi = uiLines.filter((line) => keepIds.has(String(line.id)))
  for (let index = 0; index < remainingUi.length; index += 1) {
    const line = remainingUi[index]!
    const { error } = await supabase
      .from('order_lines')
      .update({ line_seq: -1000 - index })
      .eq('id', String(line.id))
      .eq('order_id', orderId)
    if (error) throw new Error(error.message)
  }

  const existingWorkNumbers = remainingUi.map((line) => line.work_number as string | null)
  let nextWorkSeq = nextOrderWorkSeq(existingWorkNumbers)

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]!
    const lineId = String(item.lineId || '').trim()
    const row = {
      line_seq: index,
      product_id: item.productId || null,
      product_code: item.productCode || item.productId || '',
      product_name: item.productName,
      quantity: item.quantity,
      setup_cost: item.setupCost ?? 0,
      smd_unit_price: item.smdUnitPrice ?? 0,
      dip_unit_price: item.dipUnitPrice ?? 0,
      material_cost: item.materialCost ?? 0,
      unit_price: item.unitPrice,
      order_amount: item.orderAmount,
      delivery_date: item.deliveryDate?.trim() || null,
    }

    if (lineId && remainingUi.some((line) => String(line.id) === lineId)) {
      const { error } = await supabase.from('order_lines').update(row).eq('id', lineId).eq('order_id', orderId)
      if (error) throw new Error(error.message)
    } else {
      let workNumber: string | null = null
      if (!isBillingOnlyOrderItem(item)) {
        workNumber = formatOrderWorkNumber(workNumberBase, nextWorkSeq)
        nextWorkSeq += 1
      }
      const { error } = await supabase.from('order_lines').insert({
        order_id: orderId,
        ...row,
        work_number: workNumber,
      })
      if (error) throw new Error(error.message)
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

async function insertOrderLines(
  orderId: string,
  items: OrderRowPayload['items'],
  customer?: string | null,
  orderDate?: string | null,
) {
  const supabase = createSupabaseClient()
  const workNumberBase = await resolveOrderWorkNumberBase(orderId, customer, orderDate)

  let workSeq = 0
  const rows = items.map((item, index) => {
    let workNumber: string | null = null
    if (!isBillingOnlyOrderItem(item)) {
      workSeq += 1
      workNumber = formatOrderWorkNumber(workNumberBase, workSeq)
    }
    return {
      order_id: orderId,
      line_seq: index,
      product_id: item.productId || null,
      product_code: item.productCode || item.productId || '',
      product_name: item.productName,
      quantity: item.quantity,
      setup_cost: item.setupCost ?? 0,
      smd_unit_price: item.smdUnitPrice ?? 0,
      dip_unit_price: item.dipUnitPrice ?? 0,
      material_cost: item.materialCost ?? 0,
      unit_price: item.unitPrice,
      order_amount: item.orderAmount,
      delivery_date: item.deliveryDate?.trim() || null,
      work_number: workNumber,
    }
  })

  const { error } = await supabase.from('order_lines').insert(rows)
  if (error) throw new Error(error.message)
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

    // 발주ID는 항상 자동 발급 (MRO-YYMMDD-NN). payload.id 는 무시.
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
      return { ok: true, orderId, orderNumber: orderId }
    }

    if (!isMissingRpcFunction(rpcError.message)) {
      return { ok: false, reason: 'query', detail: mapOrderSaveError(rpcError.message) }
    }

    // RPC 미적용 환경 — 레거시 비원자 경로 (발주ID 자동 발급)
    const baseRow = {
      order_date: payload.order_date,
      delivery_date: payload.delivery_date || null,
      customer: payload.customer,
      category: payload.category,
      source: payload.source || 'manual',
      source_quote_id: payload.source_quote_id || null,
      note: payload.note?.trim() || '',
      customer_po_number: payload.customer_po_number?.trim() || '',
      currency,
      ...paymentTermSnapshotToDbRow(paymentSnapshot),
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

    if (error && isMissingPaymentTermSnapshotColumn(error.message)) {
      ;({ data: inserted, error } = await supabase
        .from('orders')
        .insert(omitPaymentTermSnapshotFields(insertRow))
        .select('id')
        .single())
    }

    if (error && isMissingOrdersCurrencyColumn(error.message)) {
      return {
        ok: false,
        reason: 'query',
        detail:
          '발주서 통화(currency) 컬럼이 없습니다. Supabase에서 supabase/migrate-orders-currency.sql 을 실행해 주세요.',
      }
    }

    if (error || !inserted?.id) {
      return { ok: false, reason: 'query', detail: error?.message || '발주서 저장에 실패했습니다.' }
    }

    await persistPaymentTermSnapshot('orders', inserted.id, paymentSnapshot)
    await insertOrderLines(inserted.id, payload.items, payload.customer, payload.order_date)
    const assemblySync = await syncAssemblyGroupsForOrder(inserted.id)
    if (!assemblySync.ok) {
      return { ok: false, reason: assemblySync.reason, detail: assemblySync.detail }
    }
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

      const updatePayload: Record<string, unknown> = {
        order_date: payload.order_date,
        delivery_date: payload.delivery_date || null,
        customer: payload.customer,
        category: payload.category,
        note: payload.note?.trim() || '',
        customer_po_number: payload.customer_po_number?.trim() || '',
        currency,
        updated_at: new Date().toISOString(),
      }
      let { error: updateError } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', existing.id)

      if (updateError && isMissingOrdersCurrencyColumn(updateError.message)) {
        return {
          ok: false,
          reason: 'query',
          detail:
            '발주서 통화(currency) 컬럼이 없습니다. Supabase에서 supabase/migrate-orders-currency.sql 을 실행해 주세요.',
        }
      }

      if (updateError) return { ok: false, reason: 'query', detail: updateError.message }

      await replaceOrderLinesSafely(
        existing.id,
        payload.items,
        payload.customer,
        payload.order_date,
      )
    }

    await persistPaymentTermSnapshot('orders', existing.id, paymentSnapshot)
    await persistOrderCurrency(existing.id, currency)
    const assemblySync = await syncAssemblyGroupsForOrder(existing.id)
    if (!assemblySync.ok) {
      return { ok: false, reason: assemblySync.reason, detail: assemblySync.detail }
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
