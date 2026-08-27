import {
  ensureAssemblyGroupsForOrders,
  fetchAssemblyGroups,
  repairChildrenOnlyAssemblyGroups,
  repairMissingSemiFinishedDeliveryGroups,
  repairOrphanAssemblyGroups,
} from '@/lib/assembly/repository'
import { assertCanWrite } from '@/lib/auth/assert-can-write'
import {
  isMissingCreatedByColumn,
  resolveCreatedBySnapshot,
  stripCreatedByFields,
  withCreatedByFields,
} from '@/lib/auth/created-by'
import { parseItemVersionCode } from '@/lib/items/version-code'
import { fetchOrders } from '@/lib/orders/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import {
  fetchPaymentTermSnapshotForCustomer,
  firstNonEmptyPaymentTermSnapshot,
  isMissingPaymentTermSnapshotColumn,
  paymentTermSnapshotFromDbRow,
  persistPaymentTermSnapshot,
  type PaymentTermSnapshot,
} from '@/lib/partners/payment-term-snapshot'
import { fetchPostProcessCumulativeCounts } from '@/lib/post-process/repository'
import { fetchProducts } from '@/lib/products/repository'
import { fetchQuotes } from '@/lib/quotes/repository'
import { fetchSmtCumulativeCounts } from '@/lib/smt/repository'
import {
  fetchLotLabelsByDeliveryIds,
  persistDeliveryRecordLots,
  replaceDeliveryRecordLots,
} from '@/lib/production-lots/repository'
import type { LotAllocation } from '@/lib/production-lots/types'
import { createSupabaseClient } from '@/lib/supabase'
import { isMissingRpcFunction } from '@/lib/supabase/rpc'
import { assignShipmentRounds } from './history-utils'
import type {
  CreateDeliveryRecordInput,
  CreateDeliveryShipmentInput,
  DeliveryHistoryRow,
  DeliveryRecord,
  DeliverySource,
  UpdateDeliveryRecordInput,
} from './types'
import type { DeliveryInputPageData } from './utils'
import {
  buildDeliveryAvailabilityMap,
  buildDeliveryBillingOnlyLines,
  buildDeliveryInputOrders,
  computeDeliveryAvailability,
  describeDeliveryBlockReason,
} from './utils'

export type FetchDeliveryInputPageResult =
  | { ok: true; data: DeliveryInputPageData }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type FetchDeliveryCumulativeCountsResult =
  | { ok: true; counts: Record<string, number> }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type CreateDeliveryRecordResult =
  | { ok: true; record: DeliveryRecord; cumulative: number; usedCatchUp?: boolean }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export type CreateDeliveryShipmentResult =
  | { ok: true; shipmentId: string; records: DeliveryRecord[]; usedCatchUp?: boolean }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export type UpdateDeliveryRecordResult =
  | { ok: true; record: DeliveryRecord; cumulative: number; usedCatchUp?: boolean }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export type DeleteDeliveryRecordResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export type FetchOrderLineUnitPriceResult =
  | { ok: true; unitPrice: number }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type FetchOrderLineUnitPricesResult =
  | { ok: true; prices: number[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

type OrderLineUnitPriceLookup = {
  orderId: string
  productId: string
}

export type FetchDeliveryHistoryResult =
  | { ok: true; rows: DeliveryHistoryRow[] }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export function isMissingDeliveryTable(detail: string) {
  return (
    detail.includes('delivery_records') ||
    detail.includes('delivery_totals') ||
    detail.includes('schema cache')
  )
}

export async function resolveDeliveryPaymentSnapshot(input: {
  assemblyGroupId?: string | null
  orderId?: string | null
  customer?: string | null
}): Promise<PaymentTermSnapshot> {
  const supabase = createSupabaseClient()
  if (!supabase) return paymentTermSnapshotFromDbRow(null)

  let orderId = String(input.orderId || '').trim()
  let customer = String(input.customer || '').trim()
  let orderSnapshot = paymentTermSnapshotFromDbRow(null)

  const assemblyGroupId = String(input.assemblyGroupId || '').trim()
  if (assemblyGroupId) {
    const selectWithTerms =
      'order_id, orders(customer, payment_term_type, payment_deposit_percent, payment_net_days, payment_monthly_day)'
    let { data, error } = await supabase
      .from('order_assembly_groups')
      .select(selectWithTerms)
      .eq('id', assemblyGroupId)
      .maybeSingle()

    if (error && isMissingPaymentTermSnapshotColumn(error.message)) {
      const fallback = await supabase
        .from('order_assembly_groups')
        .select('order_id, orders(customer)')
        .eq('id', assemblyGroupId)
        .maybeSingle()
      data = fallback.data as typeof data
      error = fallback.error
    }

    if (!error && data) {
      orderId = orderId || String(data.order_id || '').trim()
      const orders = data.orders as
        | {
            customer?: string | null
            payment_term_type?: string | null
            payment_deposit_percent?: number | null
            payment_net_days?: number | null
            payment_monthly_day?: number | null
          }
        | {
            customer?: string | null
            payment_term_type?: string | null
            payment_deposit_percent?: number | null
            payment_net_days?: number | null
            payment_monthly_day?: number | null
          }[]
        | null
      const order = Array.isArray(orders) ? orders[0] : orders
      customer = customer || String(order?.customer || '').trim()
      orderSnapshot = paymentTermSnapshotFromDbRow(order)
    }
  }

  if (!orderSnapshot.paymentTermType && orderId) {
    const { data, error } = await supabase
      .from('orders')
      .select('customer, payment_term_type, payment_deposit_percent, payment_net_days, payment_monthly_day')
      .eq('id', orderId)
      .maybeSingle()
    if (error && isMissingPaymentTermSnapshotColumn(error.message)) {
      const fallback = await supabase.from('orders').select('customer').eq('id', orderId).maybeSingle()
      customer = customer || String(fallback.data?.customer || '').trim()
    } else if (!error && data) {
      customer = customer || String(data.customer || '').trim()
      orderSnapshot = paymentTermSnapshotFromDbRow(data)
    }
  }

  return firstNonEmptyPaymentTermSnapshot(
    orderSnapshot,
    await fetchPaymentTermSnapshotForCustomer(customer),
  )
}

function missingEnvResult<T extends { ok: false; reason: 'env'; detail: string }>(): T {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  } as T
}

function mapDeliveryRecord(row: {
  id?: unknown
  shipment_id?: unknown
  record_date?: unknown
  assembly_group_id?: unknown
  quantity?: unknown
  source?: unknown
  note?: unknown
  created_by?: unknown
  created_by_name?: unknown
  created_at?: unknown
}): DeliveryRecord {
  const id = String(row.id || '').trim()
  const shipmentId = String(row.shipment_id || id || '').trim() || id
  return {
    id,
    shipmentId,
    recordDate: String(row.record_date || '').slice(0, 10),
    assemblyGroupId: String(row.assembly_group_id || '').trim(),
    quantity: Math.max(0, Math.floor(Number(row.quantity) || 0)),
    source: row.source === 'manual' ? 'manual' : 'manual',
    note: String(row.note || ''),
    createdBy: row.created_by == null ? null : String(row.created_by),
    createdByName: String(row.created_by_name || '').trim(),
    createdAt: String(row.created_at || ''),
  }
}

function parseInsertDeliveryRpcPayload(value: unknown): {
  record: DeliveryRecord
  cumulative: number
} | null {
  const payload =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  if (!payload?.record || typeof payload.record !== 'object' || Array.isArray(payload.record)) {
    return null
  }
  const record = mapDeliveryRecord(payload.record as Parameters<typeof mapDeliveryRecord>[0])
  if (!record.id) return null
  return {
    record,
    cumulative: Math.max(0, Math.floor(Number(payload.cumulative) || 0)),
  }
}

export async function fetchDeliveryInputPageData(): Promise<FetchDeliveryInputPageResult> {
  const [ordersResult, derivedOrdersResult, productsResult] = await Promise.all([
    fetchOrders(),
    fetchOrders({ includeDerivedLines: true }),
    fetchProducts(),
  ])
  if (!ordersResult.ok) {
    return ordersResult
  }
  if (!derivedOrdersResult.ok) {
    return derivedOrdersResult
  }
  if (!productsResult.ok) {
    return productsResult
  }

  const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
  const orderIds = ordersResult.orders.map((order) => order.orderId)

  await ensureAssemblyGroupsForOrders(orderIds)

  const [assemblyFetchResult, smtCountsResult, postCountsResult, deliveryCountsResult, quotesResult] =
    await Promise.all([
      fetchAssemblyGroups(productById),
      fetchSmtCumulativeCounts(),
      fetchPostProcessCumulativeCounts(),
      fetchDeliveryCumulativeCounts(),
      fetchQuotes(),
    ])

  if (!assemblyFetchResult.ok) return assemblyFetchResult
  if (!smtCountsResult.ok) return smtCountsResult
  if (!postCountsResult.ok) return postCountsResult
  if (!deliveryCountsResult.ok) return deliveryCountsResult
  if (!quotesResult.ok) return quotesResult

  let assemblyResult = await repairChildrenOnlyAssemblyGroups(
    assemblyFetchResult.groups,
    ordersResult.orders,
    productById,
  )
  if (!assemblyResult.ok) return assemblyResult

  assemblyResult = await repairOrphanAssemblyGroups(assemblyResult.groups, productById)
  if (!assemblyResult.ok) return assemblyResult

  assemblyResult = await repairMissingSemiFinishedDeliveryGroups(
    assemblyResult.groups,
    productById,
    derivedOrdersResult.orders,
  )
  if (!assemblyResult.ok) return assemblyResult

  const deliveryCounts = deliveryCountsResult.counts
  const availabilityByGroupId = buildDeliveryAvailabilityMap(
    assemblyResult.groups,
    smtCountsResult.counts,
    postCountsResult.counts,
    deliveryCounts,
    productById,
  )

  return {
    ok: true,
    data: {
      orders: buildDeliveryInputOrders(
        assemblyResult.groups,
        derivedOrdersResult.orders,
        productById,
        quotesResult.quotes,
      ),
      billingOnlyLines: buildDeliveryBillingOnlyLines(ordersResult.orders),
      deliveryCounts,
      availabilityByGroupId,
    },
  }
}

export async function fetchDeliveryCumulativeCounts(): Promise<FetchDeliveryCumulativeCountsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase.from('delivery_totals').select('assembly_group_id, total_quantity')

    if (error) {
      if (isMissingDeliveryTable(error.message)) {
        return { ok: true, counts: {} }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    const counts: Record<string, number> = {}
    for (const row of data || []) {
      const assemblyGroupId = String(row.assembly_group_id || '').trim()
      if (!assemblyGroupId) continue
      counts[assemblyGroupId] = Math.max(0, Math.floor(Number(row.total_quantity) || 0))
    }

    return { ok: true, counts }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createDeliveryRecord(
  input: CreateDeliveryRecordInput,
): Promise<CreateDeliveryRecordResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'sales', action: 'create' })
  if (!gate.ok) return gate

  const assemblyGroupId = String(input.assemblyGroupId || '').trim()
  const quantity = Math.floor(Number(input.quantity) || 0)

  if (!assemblyGroupId) {
    return { ok: false, reason: 'validation', detail: '조립 그룹을 찾을 수 없습니다.' }
  }
  if (quantity < 1) {
    return { ok: false, reason: 'validation', detail: '등록 수량은 1 이상이어야 합니다.' }
  }

  try {
    const supabase = createSupabaseClient()

    const { data: assemblyGroup, error: groupError } = await supabase
      .from('order_assembly_groups')
      .select('id, target_quantity')
      .eq('id', assemblyGroupId)
      .maybeSingle()

    if (groupError) {
      return { ok: false, reason: 'query', detail: groupError.message }
    }
    if (!assemblyGroup?.id) {
      return { ok: false, reason: 'validation', detail: '조립 그룹을 찾을 수 없습니다.' }
    }

    const targetQty = Math.max(0, Math.floor(Number(assemblyGroup.target_quantity) || 0))
    const { data: totals, error: totalsError } = await supabase
      .from('delivery_totals')
      .select('total_quantity')
      .eq('assembly_group_id', assemblyGroupId)
      .maybeSingle()

    if (totalsError) {
      if (isMissingDeliveryTable(totalsError.message)) {
        return {
          ok: false,
          reason: 'query',
          detail: 'delivery_records 테이블이 없습니다. setup-delivery-production.sql 을 실행하세요.',
        }
      }
      return { ok: false, reason: 'query', detail: totalsError.message }
    }

    const currentTotal = Math.max(0, Math.floor(Number(totals?.total_quantity) || 0))

    const [productsResult, smtCountsResult, postCountsResult] = await Promise.all([
      fetchProducts(),
      fetchSmtCumulativeCounts(),
      fetchPostProcessCumulativeCounts(),
    ])

    if (!productsResult.ok) {
      return { ok: false, reason: 'query', detail: productsResult.detail }
    }
    if (!smtCountsResult.ok) {
      return { ok: false, reason: 'query', detail: smtCountsResult.detail }
    }
    if (!postCountsResult.ok) {
      return { ok: false, reason: 'query', detail: postCountsResult.detail }
    }

    const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
    const assemblyGroupsResult = await fetchAssemblyGroups(productById)

    if (!assemblyGroupsResult.ok) {
      return { ok: false, reason: 'query', detail: assemblyGroupsResult.detail }
    }

    const group = assemblyGroupsResult.groups.find((item) => item.id === assemblyGroupId)

    if (!group) {
      return { ok: false, reason: 'validation', detail: '조립 그룹을 찾을 수 없습니다.' }
    }

    const availability = computeDeliveryAvailability(
      group,
      smtCountsResult.counts,
      postCountsResult.counts,
      { [assemblyGroupId]: currentTotal },
      productById,
    )

    if (quantity > availability.shippable) {
      return {
        ok: false,
        reason: 'validation',
        detail:
          availability.shippable > 0
            ? `출하가능 수량(${availability.shippable.toLocaleString('ko-KR')}대)을 초과할 수 없습니다.`
            : describeDeliveryBlockReason(availability),
      }
    }

    if (targetQty > 0 && currentTotal + quantity > targetQty) {
      return {
        ok: false,
        reason: 'validation',
        detail: `주문 수량(${targetQty.toLocaleString('ko-KR')}대)을 초과할 수 없습니다.`,
      }
    }

    const recordDate = input.recordDate?.trim() || todayYmdSeoul()
    const source: DeliverySource = input.source || 'manual'
    const shipmentNumber = input.shipmentNumber?.trim() || ''
    const shipmentGroupId = input.shipmentGroupId?.trim() || ''

    if (shipmentNumber && !/^MRS-([0-9]+|[0-9]{6}-[0-9]{2})$/.test(shipmentNumber)) {
      return {
        ok: false,
        reason: 'validation',
        detail: '출하번호 형식이 올바르지 않습니다. (예: MRS-260811-01)',
      }
    }
    if (shipmentGroupId && !/^MRS-([0-9]+|[0-9]{6}-[0-9]{2})$/.test(shipmentGroupId)) {
      return {
        ok: false,
        reason: 'validation',
        detail: '명세서 묶음번호 형식이 올바르지 않습니다. (예: MRS-260811-01)',
      }
    }

    const createdBy = await resolveCreatedBySnapshot()
    const { data: rpcData, error: rpcError } = await supabase.rpc('insert_delivery_record_atomic', {
      p_assembly_group_id: assemblyGroupId,
      p_quantity: quantity,
      p_max_shippable: availability.shippable,
      p_record_date: recordDate,
      p_source: source,
      p_note: input.note?.trim() || '',
      p_shipment_id: shipmentNumber || null,
      p_created_by: createdBy.createdBy,
      p_created_by_name: createdBy.createdByName,
      p_shipment_group_id: shipmentGroupId || null,
    })

    if (!rpcError) {
      const parsed = parseInsertDeliveryRpcPayload(rpcData)
      if (!parsed) {
        return { ok: false, reason: 'query', detail: '출하 기록 저장에 실패했습니다.' }
      }
      const { record } = parsed
      await persistPaymentTermSnapshot(
        'delivery_records',
        record.id,
        await resolveDeliveryPaymentSnapshot({ assemblyGroupId }),
      )
      const lotsResult = await persistDeliveryRecordLots({
        deliveryRecordId: record.id,
        assemblyGroupId,
        quantity,
        preferDate: recordDate,
        allocations: input.allocations as LotAllocation[] | undefined,
      })
      if (!lotsResult.ok && lotsResult.reason === 'validation') {
        await supabase.from('delivery_records').delete().eq('id', record.id)
        return { ok: false, reason: 'validation', detail: lotsResult.detail }
      }
      return {
        ok: true,
        record,
        cumulative: Math.max(
          0,
          Math.floor(Number(parsed.cumulative) || currentTotal + quantity),
        ),
        usedCatchUp: lotsResult.ok ? lotsResult.usedCatchUp : undefined,
      }
    }

    if (rpcError.message.includes('DELIVERY_EXCEEDED')) {
      const cap = rpcError.message.split(':').slice(1).join(':') || '0'
      return {
        ok: false,
        reason: 'validation',
        detail: `출하가능 수량(${Number(cap).toLocaleString('ko-KR')}대)을 초과할 수 없습니다.`,
      }
    }

    if (!isMissingRpcFunction(rpcError.message)) {
      return { ok: false, reason: 'query', detail: rpcError.message }
    }

    const basePayload: {
      id?: string
      shipment_id: string
      record_date: string
      assembly_group_id: string
      quantity: number
      source: DeliverySource
      note: string
    } = {
      record_date: recordDate,
      assembly_group_id: assemblyGroupId,
      quantity,
      source,
      note: input.note?.trim() || '',
      // DB 트리거가 빈 값이면 id 로 채움. null 삽입 금지(NOT NULL 위반)
      shipment_id: shipmentGroupId || shipmentNumber || '',
    }

    if (shipmentNumber) {
      basePayload.id = shipmentNumber
    }

    const insertPayload = await withCreatedByFields(basePayload)
    let { data: inserted, error: insertError } = await supabase
      .from('delivery_records')
      .insert(insertPayload)
      .select('*')
      .single()

    if (insertError && isMissingCreatedByColumn(insertError.message)) {
      ;({ data: inserted, error: insertError } = await supabase
        .from('delivery_records')
        .insert(stripCreatedByFields(insertPayload))
        .select('*')
        .single())
    }

    if (insertError || !inserted) {
      return {
        ok: false,
        reason: 'query',
        detail: insertError?.message || '출하 기록 저장에 실패했습니다.',
      }
    }

    const record = mapDeliveryRecord(inserted)
    await persistPaymentTermSnapshot(
      'delivery_records',
      record.id,
      await resolveDeliveryPaymentSnapshot({ assemblyGroupId }),
    )
    const lotsResult = await persistDeliveryRecordLots({
      deliveryRecordId: record.id,
      assemblyGroupId,
      quantity,
      preferDate: recordDate,
      allocations: input.allocations as LotAllocation[] | undefined,
    })
    if (!lotsResult.ok && lotsResult.reason === 'validation') {
      await supabase.from('delivery_records').delete().eq('id', record.id)
      return { ok: false, reason: 'validation', detail: lotsResult.detail }
    }
    return {
      ok: true,
      record,
      cumulative: currentTotal + quantity,
      usedCatchUp: lotsResult.ok ? lotsResult.usedCatchUp : undefined,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 같은 고객사 여러 품목을 한 명세서(shipment_id)로 묶어 출하합니다.
 * 라인 id 는 각자 MRS 채번, shipment_id 는 첫 라인 id 로 통일합니다.
 */
export async function createDeliveryShipment(
  input: CreateDeliveryShipmentInput,
): Promise<CreateDeliveryShipmentResult> {
  const customer = String(input.customer || '').trim()
  if (!customer) {
    return { ok: false, reason: 'validation', detail: '고객사가 없습니다.' }
  }

  const merged = new Map<
    string,
    { assemblyGroupId: string; quantity: number; allocations?: LotAllocation[] }
  >()
  for (const line of input.lines || []) {
    const assemblyGroupId = String(line.assemblyGroupId || '').trim()
    const quantity = Math.max(0, Math.floor(Number(line.quantity) || 0))
    if (!assemblyGroupId || quantity < 1) continue
    const allocations = (line.allocations || [])
      .map((allocation) => ({
        lotId: String(allocation.lotId || '').trim(),
        lotDate: String(allocation.lotDate || ''),
        quantity: Math.max(0, Math.floor(Number(allocation.quantity) || 0)),
        remaining: Math.max(0, Math.floor(Number(allocation.remaining) || 0)),
      }))
      .filter((allocation) => allocation.lotId && allocation.quantity > 0)
    const existing = merged.get(assemblyGroupId)
    if (existing) {
      existing.quantity += quantity
      existing.allocations = undefined
      continue
    }
    merged.set(assemblyGroupId, {
      assemblyGroupId,
      quantity,
      allocations: allocations.length ? allocations : undefined,
    })
  }
  const lines = [...merged.values()]

  if (!lines.length) {
    return { ok: false, reason: 'validation', detail: '출하목록에 품목을 추가해 주세요.' }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, reason: 'env', detail: 'Supabase 환경 변수가 설정되지 않았습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data: groupRows, error: groupError } = await supabase
      .from('order_assembly_groups')
      .select('id, orders(customer)')
      .in(
        'id',
        lines.map((line) => line.assemblyGroupId),
      )

    if (groupError) {
      return { ok: false, reason: 'query', detail: groupError.message }
    }

    const customerByGroupId = new Map<string, string>()
    for (const row of groupRows || []) {
      const id = String(row.id || '').trim()
      const orders = row.orders as
        | { customer?: string }
        | { customer?: string }[]
        | null
      const order = Array.isArray(orders) ? orders[0] : orders
      customerByGroupId.set(id, String(order?.customer || '').trim())
    }

    for (const line of lines) {
      const lineCustomer = customerByGroupId.get(line.assemblyGroupId)
      if (!lineCustomer) {
        return {
          ok: false,
          reason: 'validation',
          detail: '조립 그룹을 찾을 수 없습니다.',
        }
      }
      if (lineCustomer !== customer) {
        return {
          ok: false,
          reason: 'validation',
          detail: `같은 고객사만 한 번에 출하할 수 있습니다. (${lineCustomer})`,
        }
      }
    }

    const recordDate = input.recordDate?.trim() || todayYmdSeoul()
    const note = input.note?.trim() || ''
    const records: DeliveryRecord[] = []
    let usedCatchUp = false

    // 1) 첫 라인 등록 → 그 id 를 명세서 묶음번호(shipment_id)로 사용
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!
      const shipmentGroupId = records[0]?.id
      const result = await createDeliveryRecord({
        assemblyGroupId: line.assemblyGroupId,
        quantity: line.quantity,
        recordDate,
        note,
        allocations: line.allocations,
        // 두 번째 라인부터 첫 라인 출하번호로 묶음
        shipmentGroupId: index === 0 ? undefined : shipmentGroupId,
      })

      if (!result.ok) {
        for (const record of records) {
          await deleteDeliveryRecord(record.id)
        }
        return { ok: false, reason: result.reason, detail: result.detail }
      }

      if (result.usedCatchUp) usedCatchUp = true
      records.push(result.record)
    }

    const shipmentId = records[0]!.id

    // 2) 같은 출하 건의 모든 라인 shipment_id 를 강제로 통일
    const { error: updateError } = await supabase
      .from('delivery_records')
      .update({ shipment_id: shipmentId })
      .in(
        'id',
        records.map((record) => record.id),
      )

    if (updateError) {
      for (const record of records) {
        await deleteDeliveryRecord(record.id)
      }
      return { ok: false, reason: 'query', detail: updateError.message }
    }

    return {
      ok: true,
      shipmentId,
      records: records.map((record) => ({ ...record, shipmentId })),
      usedCatchUp: usedCatchUp || undefined,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

async function validateDeliveryQuantityChange(
  assemblyGroupId: string,
  quantity: number,
  options: { excludeRecordId?: string; previousQuantity?: number } = {},
): Promise<
  | { ok: true; targetQty: number; cumulative: number }
  | { ok: false; reason: 'query' | 'validation'; detail: string }
> {
  const supabase = createSupabaseClient()

  const { data: assemblyGroup, error: groupError } = await supabase
    .from('order_assembly_groups')
    .select('id, target_quantity')
    .eq('id', assemblyGroupId)
    .maybeSingle()

  if (groupError) {
    return { ok: false, reason: 'query', detail: groupError.message }
  }
  if (!assemblyGroup?.id) {
    return { ok: false, reason: 'validation', detail: '조립 그룹을 찾을 수 없습니다.' }
  }

  const targetQty = Math.max(0, Math.floor(Number(assemblyGroup.target_quantity) || 0))
  const { data: totals, error: totalsError } = await supabase
    .from('delivery_totals')
    .select('total_quantity')
    .eq('assembly_group_id', assemblyGroupId)
    .maybeSingle()

  if (totalsError) {
    if (isMissingDeliveryTable(totalsError.message)) {
      return {
        ok: false,
        reason: 'query',
        detail: 'delivery_records 테이블이 없습니다. setup-delivery-production.sql 을 실행하세요.',
      }
    }
    return { ok: false, reason: 'query', detail: totalsError.message }
  }

  const currentTotal = Math.max(0, Math.floor(Number(totals?.total_quantity) || 0))
  const previousQuantity = Math.max(0, Math.floor(Number(options.previousQuantity) || 0))
  const adjustedTotal = currentTotal - previousQuantity + quantity

  const [productsResult, smtCountsResult, postCountsResult] = await Promise.all([
    fetchProducts(),
    fetchSmtCumulativeCounts(),
    fetchPostProcessCumulativeCounts(),
  ])

  if (!productsResult.ok) {
    return { ok: false, reason: 'query', detail: productsResult.detail }
  }
  if (!smtCountsResult.ok) {
    return { ok: false, reason: 'query', detail: smtCountsResult.detail }
  }
  if (!postCountsResult.ok) {
    return { ok: false, reason: 'query', detail: postCountsResult.detail }
  }

  const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
  const assemblyGroupsResult = await fetchAssemblyGroups(productById)

  if (!assemblyGroupsResult.ok) {
    return { ok: false, reason: 'query', detail: assemblyGroupsResult.detail }
  }

  const group = assemblyGroupsResult.groups.find((item) => item.id === assemblyGroupId)

  if (!group) {
    return { ok: false, reason: 'validation', detail: '조립 그룹을 찾을 수 없습니다.' }
  }

  const availability = computeDeliveryAvailability(
    group,
    smtCountsResult.counts,
    postCountsResult.counts,
    { [assemblyGroupId]: currentTotal },
    productById,
  )

  const maxAllowed = availability.shippable + previousQuantity

  if (quantity > maxAllowed) {
    return {
      ok: false,
      reason: 'validation',
      detail:
        maxAllowed > 0
          ? `출하가능 수량(${maxAllowed.toLocaleString('ko-KR')}대)을 초과할 수 없습니다.`
          : describeDeliveryBlockReason(availability),
    }
  }

  if (targetQty > 0 && adjustedTotal > targetQty) {
    return {
      ok: false,
      reason: 'validation',
      detail: `주문 수량(${targetQty.toLocaleString('ko-KR')}대)을 초과할 수 없습니다.`,
    }
  }

  void options.excludeRecordId

  return { ok: true, targetQty, cumulative: adjustedTotal }
}

function matchOrderLineUnitPrice(
  lines: Array<{
    unit_price?: number | null
    product_id?: string | null
    product_code?: string | null
    derived_from_line_id?: string | null
  }>,
  productCode: string,
) {
  const usable = lines.filter((line) => !line.derived_from_line_id)
  // 추가작업(product_id 없음)과 같은 코드여도 제품 단가만 우선
  const match =
    usable.find(
      (line) =>
        Boolean(String(line.product_id || '').trim()) &&
        (line.product_id === productCode || line.product_code === productCode),
    ) ||
    usable.find((line) => line.product_id === productCode || line.product_code === productCode)

  return Math.max(0, Math.round(Number(match?.unit_price) || 0))
}

/** 출하·명세서 모달용 — 주문/품목 단가를 1~2회 조회로 배치 해석 */
export async function fetchOrderLineUnitPrices(
  lookups: OrderLineUnitPriceLookup[],
): Promise<FetchOrderLineUnitPricesResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  if (!lookups.length) {
    return { ok: true, prices: [] }
  }

  try {
    const supabase = createSupabaseClient()
    const normalized = lookups.map((entry) => ({
      orderId: String(entry.orderId || '').trim(),
      productId: String(entry.productId || '').trim(),
    }))

    const orderIds = [...new Set(normalized.map((entry) => entry.orderId).filter(Boolean))]
    const linesByOrderId = new Map<
      string,
      Array<{
        unit_price?: number | null
        product_id?: string | null
        product_code?: string | null
        derived_from_line_id?: string | null
      }>
    >()

    if (orderIds.length > 0) {
      const { data, error } = await supabase
        .from('order_lines')
        .select('order_id, unit_price, product_id, product_code, derived_from_line_id')
        .in('order_id', orderIds)

      if (error) {
        return { ok: false, reason: 'query', detail: error.message }
      }

      for (const line of data || []) {
        const orderId = String(line.order_id || '').trim()
        if (!orderId) continue
        const list = linesByOrderId.get(orderId) ?? []
        list.push(line)
        linesByOrderId.set(orderId, list)
      }
    }

    const prices = normalized.map(() => 0)
    const missingProductIds = new Set<string>()

    for (let index = 0; index < normalized.length; index += 1) {
      const { orderId, productId } = normalized[index]!
      if (!productId) continue

      if (orderId) {
        const fromOrderLine = matchOrderLineUnitPrice(linesByOrderId.get(orderId) || [], productId)
        if (fromOrderLine > 0) {
          prices[index] = fromOrderLine
          continue
        }
      }
      missingProductIds.add(productId)
    }

    if (missingProductIds.size > 0) {
      const { data: items, error: itemError } = await supabase
        .from('items')
        .select('id, unit_price')
        .in('id', [...missingProductIds])

      if (itemError) {
        return { ok: false, reason: 'query', detail: itemError.message }
      }

      const priceByItemId = new Map(
        (items || []).map((item) => [
          String(item.id || '').trim(),
          Math.max(0, Math.round(Number(item.unit_price) || 0)),
        ]),
      )

      for (let index = 0; index < normalized.length; index += 1) {
        if ((prices[index] || 0) > 0) continue
        const productId = normalized[index]!.productId
        if (!productId) continue
        prices[index] = priceByItemId.get(productId) || 0
      }
    }

    return { ok: true, prices }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function fetchOrderLineUnitPrice(
  orderId: string,
  productId: string,
): Promise<FetchOrderLineUnitPriceResult> {
  const result = await fetchOrderLineUnitPrices([{ orderId, productId }])
  if (!result.ok) return result
  return { ok: true, unitPrice: result.prices[0] || 0 }
}

export async function updateDeliveryRecord(
  recordId: string,
  input: UpdateDeliveryRecordInput,
): Promise<UpdateDeliveryRecordResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'sales', action: 'update' })
  if (!gate.ok) return gate

  const id = String(recordId || '').trim()
  if (!id) {
    return { ok: false, reason: 'validation', detail: '출하번호를 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data: existing, error: fetchError } = await supabase
      .from('delivery_records')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      return { ok: false, reason: 'query', detail: fetchError.message }
    }
    if (!existing) {
      return { ok: false, reason: 'validation', detail: '출하 기록을 찾을 수 없습니다.' }
    }

    const quantity =
      input.quantity != null ? Math.floor(Number(input.quantity) || 0) : Math.floor(Number(existing.quantity) || 0)
    if (quantity < 1) {
      return { ok: false, reason: 'validation', detail: '출하 수량은 1 이상이어야 합니다.' }
    }

    const validation = await validateDeliveryQuantityChange(existing.assembly_group_id, quantity, {
      excludeRecordId: id,
      previousQuantity: existing.quantity,
    })

    if (!validation.ok) {
      return validation
    }

    const recordDate = input.recordDate?.trim() || String(existing.record_date || '').slice(0, 10)
    const note = input.note != null ? input.note.trim() : existing.note || ''

    const { data: updated, error: updateError } = await supabase
      .from('delivery_records')
      .update({
        record_date: recordDate,
        quantity,
        note,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError || !updated) {
      return {
        ok: false,
        reason: 'query',
        detail: updateError?.message || '출하 기록 수정에 실패했습니다.',
      }
    }

    const assemblyGroupId = String(existing.assembly_group_id || '').trim()
    const lotsResult = await replaceDeliveryRecordLots({
      deliveryRecordId: id,
      assemblyGroupId,
      quantity,
      preferDate: recordDate,
    })
    if (!lotsResult.ok && lotsResult.reason === 'validation') {
      await supabase
        .from('delivery_records')
        .update({
          record_date: existing.record_date,
          quantity: existing.quantity,
          note: existing.note || '',
        })
        .eq('id', id)
      return { ok: false, reason: 'validation', detail: lotsResult.detail }
    }
    if (!lotsResult.ok && lotsResult.reason === 'query') {
      return { ok: false, reason: 'query', detail: lotsResult.detail }
    }

    return {
      ok: true,
      record: mapDeliveryRecord(updated),
      cumulative: validation.cumulative,
      usedCatchUp: lotsResult.ok ? lotsResult.usedCatchUp : undefined,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteDeliveryRecord(recordId: string): Promise<DeleteDeliveryRecordResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'sales', action: 'delete' })
  if (!gate.ok) return gate

  const id = String(recordId || '').trim()
  if (!id) {
    return { ok: false, reason: 'validation', detail: '출하번호를 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('delivery_records').delete().eq('id', id)

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

type DeliveryHistoryItemRow = {
  id: string
  name: string
  base_code?: string | null
  version?: string | null
}

function resolveHistoryProductIdentity(
  item: DeliveryHistoryItemRow | null | undefined,
  parentProductId: string,
) {
  const productId = String(item?.id || parentProductId || '').trim()
  if (!productId) return { productId: '', productCode: '' }
  const baseCode = String(item?.base_code || '').trim()
  const productCode = baseCode || parseItemVersionCode(productId).base || productId
  return { productId, productCode }
}

async function enrichDeliveryHistoryProductCodes(rows: DeliveryHistoryRow[]) {
  if (!rows.length) return
  const productsResult = await fetchProducts(false)
  if (!productsResult.ok) return

  const productById = Object.fromEntries(
    productsResult.products.map((product) => [product.id, product]),
  )

  for (const row of rows) {
    const productId = row.productId.trim()
    if (!productId) continue

    const master = productById[productId]
    if (master?.productCode.trim()) {
      row.productCode = master.productCode.trim()
      continue
    }

    const parsed = parseItemVersionCode(productId)
    if (
      parsed.base &&
      parsed.base !== productId &&
      (!row.productCode.trim() || row.productCode === productId)
    ) {
      row.productCode = parsed.base
    }
  }
}

type DeliveryHistoryRecordRow = {
  id: string
  shipment_id?: string | null
  record_date: string
  assembly_group_id: string
  quantity: number
  source: string
  note: string
  created_by?: string | null
  created_by_name?: string | null
  created_at: string
  order_assembly_groups:
    | {
        target_quantity: number
        parent_product_id: string
        order_id: string
        items: DeliveryHistoryItemRow | DeliveryHistoryItemRow[] | null
        orders:
          | { id: string; customer: string; customer_po_number?: string | null }
          | { id: string; customer: string; customer_po_number?: string | null }[]
          | null
      }
    | {
        target_quantity: number
        parent_product_id: string
        order_id: string
        items: DeliveryHistoryItemRow | DeliveryHistoryItemRow[] | null
        orders:
          | { id: string; customer: string; customer_po_number?: string | null }
          | { id: string; customer: string; customer_po_number?: string | null }[]
          | null
      }[]
    | null
}

function mapDeliveryHistoryRow(row: DeliveryHistoryRecordRow): DeliveryHistoryRow | null {
  const assemblyGroups = row.order_assembly_groups
  if (!assemblyGroups) return null

  const assemblyGroup = Array.isArray(assemblyGroups) ? assemblyGroups[0] : assemblyGroups
  if (!assemblyGroup) return null

  const itemRows = assemblyGroup.items
  const product = Array.isArray(itemRows) ? itemRows[0] : itemRows

  const orders = assemblyGroup.orders
  const order = Array.isArray(orders) ? orders[0] : orders
  if (!order) return null

  const record = mapDeliveryRecord(row)
  const { productId, productCode } = resolveHistoryProductIdentity(
    product,
    assemblyGroup.parent_product_id,
  )

  return {
    id: record.id,
    shipmentId: record.shipmentId,
    assemblyGroupId: record.assemblyGroupId,
    recordDate: record.recordDate,
    createdAt: record.createdAt,
    orderNumber: order.id || assemblyGroup.order_id || '',
    customerPoNumber: String(order.customer_po_number || '').trim(),
    customer: order.customer || '',
    productName: product?.name || assemblyGroup.parent_product_id || '',
    productCode,
    productId,
    targetQuantity: Math.max(0, Math.floor(Number(assemblyGroup.target_quantity) || 0)),
    quantity: record.quantity,
    shipmentRound: 0,
    source: record.source,
    note: record.note,
    createdBy: record.createdBy,
    createdByName: record.createdByName,
    lotLabel: '',
  }
}

export async function fetchDeliveryHistory(): Promise<FetchDeliveryHistoryResult> {
  return fetchDeliveryRecords()
}

export async function fetchDeliveryHistoryByShipmentId(
  shipmentId: string,
): Promise<FetchDeliveryHistoryResult> {
  const id = String(shipmentId || '').trim()
  if (!id) {
    return { ok: false, reason: 'validation', detail: '명세서 번호를 찾을 수 없습니다.' }
  }
  return fetchDeliveryRecords({ shipmentId: id })
}

export async function fetchDeliveryTodayRecords(): Promise<FetchDeliveryHistoryResult> {
  return fetchDeliveryRecords({ recordDate: todayYmdSeoul() })
}

async function fetchDeliveryRecords(options?: {
  recordDate?: string
  shipmentId?: string
  limit?: number
}): Promise<FetchDeliveryHistoryResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const selectWithCreatedBy = `
        id,
        shipment_id,
        record_date,
        assembly_group_id,
        quantity,
        source,
        note,
        created_by,
        created_by_name,
        created_at,
        order_assembly_groups (
          target_quantity,
          parent_product_id,
          order_id,
          items!order_assembly_groups_parent_product_id_fkey (
            id,
            name,
            base_code,
            version
          ),
          orders (
            id,
            customer,
            customer_po_number
          )
        )
      `

  const selectLegacy = `
        id,
        shipment_id,
        record_date,
        assembly_group_id,
        quantity,
        source,
        note,
        created_at,
        order_assembly_groups (
          target_quantity,
          parent_product_id,
          order_id,
          items!order_assembly_groups_parent_product_id_fkey (
            id,
            name,
            base_code,
            version
          ),
          orders (
            id,
            customer,
            customer_po_number
          )
        )
      `

  try {
    const supabase = createSupabaseClient()
    let query = supabase
      .from('delivery_records')
      .select(selectWithCreatedBy)
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 1000)

    if (options?.recordDate) {
      query = query.eq('record_date', options.recordDate)
    }
    if (options?.shipmentId) {
      query = query.eq('shipment_id', options.shipmentId)
    }

    let { data, error } = await query

    if (error && isMissingCreatedByColumn(error.message)) {
      let legacyQuery = supabase
        .from('delivery_records')
        .select(selectLegacy)
        .order('created_at', { ascending: false })
        .limit(options?.limit ?? 1000)
      if (options?.recordDate) {
        legacyQuery = legacyQuery.eq('record_date', options.recordDate)
      }
      if (options?.shipmentId) {
        legacyQuery = legacyQuery.eq('shipment_id', options.shipmentId)
      }
      const legacy = await legacyQuery
      data = (legacy.data || null) as typeof data
      error = legacy.error
    }

    // shipment_id 컬럼 미적용 DB 호환: 단건이면 id 로 조회
    if (error && options?.shipmentId && /shipment_id/i.test(error.message)) {
      let fallbackQuery = supabase
        .from('delivery_records')
        .select(selectWithCreatedBy.replace(/^\s*shipment_id,\s*/m, ''))
        .eq('id', options.shipmentId)
        .order('created_at', { ascending: false })
        .limit(options?.limit ?? 1000)
      if (options?.recordDate) {
        fallbackQuery = fallbackQuery.eq('record_date', options.recordDate)
      }
      const fallback = await fallbackQuery
      if (fallback.error && isMissingCreatedByColumn(fallback.error.message)) {
        let legacyFallback = supabase
          .from('delivery_records')
          .select(selectLegacy.replace(/^\s*shipment_id,\s*/m, ''))
          .eq('id', options.shipmentId)
          .order('created_at', { ascending: false })
          .limit(options?.limit ?? 1000)
        if (options?.recordDate) {
          legacyFallback = legacyFallback.eq('record_date', options.recordDate)
        }
        const legacy = await legacyFallback
        data = (legacy.data || null) as typeof data
        error = legacy.error
      } else {
        data = (fallback.data || null) as typeof data
        error = fallback.error
      }
    }

    if (error) {
      if (isMissingDeliveryTable(error.message)) {
        return { ok: true, rows: [] }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    const rows: DeliveryHistoryRow[] = []
    for (const row of data || []) {
      const mapped = mapDeliveryHistoryRow(row as DeliveryHistoryRecordRow)
      if (mapped) rows.push(mapped)
    }

    const lotLabels = await fetchLotLabelsByDeliveryIds(rows.map((row) => row.id))
    for (const row of rows) {
      row.lotLabel = lotLabels[row.id] || ''
    }

    await enrichDeliveryHistoryProductCodes(rows)

    return { ok: true, rows: assignShipmentRounds(rows) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
