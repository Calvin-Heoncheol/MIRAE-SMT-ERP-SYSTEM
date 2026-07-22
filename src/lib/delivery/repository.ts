import {
  ensureAssemblyGroupsForOrders,
  fetchAssemblyGroups,
  repairChildrenOnlyAssemblyGroups,
} from '@/lib/assembly/repository'
import { fetchOrders } from '@/lib/orders/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { fetchPostProcessCumulativeCounts } from '@/lib/post-process/repository'
import { fetchProducts } from '@/lib/products/repository'
import { fetchSmtCumulativeCounts } from '@/lib/smt/repository'
import { createSupabaseClient } from '@/lib/supabase'
import type {
  CreateDeliveryRecordInput,
  DeliveryHistoryRow,
  DeliveryRecord,
  DeliverySource,
  UpdateDeliveryRecordInput,
} from './types'
import type { DeliveryInputPageData } from './utils'
import {
  buildDeliveryAvailabilityMap,
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
  | { ok: true; record: DeliveryRecord; cumulative: number }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export type UpdateDeliveryRecordResult =
  | { ok: true; record: DeliveryRecord; cumulative: number }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export type DeleteDeliveryRecordResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export type FetchOrderLineUnitPriceResult =
  | { ok: true; unitPrice: number }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type FetchDeliveryHistoryResult =
  | { ok: true; rows: DeliveryHistoryRow[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export function isMissingDeliveryTable(detail: string) {
  return (
    detail.includes('delivery_records') ||
    detail.includes('delivery_totals') ||
    detail.includes('schema cache')
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
  id: string
  record_date: string
  assembly_group_id: string
  quantity: number
  source: string
  note: string
  created_at: string
}): DeliveryRecord {
  return {
    id: row.id,
    recordDate: String(row.record_date || '').slice(0, 10),
    assemblyGroupId: row.assembly_group_id,
    quantity: Math.max(0, Math.floor(Number(row.quantity) || 0)),
    source: row.source === 'manual' ? 'manual' : 'manual',
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function fetchDeliveryInputPageData(): Promise<FetchDeliveryInputPageResult> {
  const ordersResult = await fetchOrders()
  if (!ordersResult.ok) {
    return ordersResult
  }

  const productsResult = await fetchProducts()
  if (!productsResult.ok) {
    return productsResult
  }

  const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
  const orderIds = ordersResult.orders.map((order) => order.orderId)

  await ensureAssemblyGroupsForOrders(orderIds)

  const [assemblyFetchResult, smtCountsResult, postCountsResult, deliveryCountsResult] = await Promise.all([
    fetchAssemblyGroups(productById),
    fetchSmtCumulativeCounts(),
    fetchPostProcessCumulativeCounts(),
    fetchDeliveryCumulativeCounts(),
  ])

  if (!assemblyFetchResult.ok) return assemblyFetchResult
  if (!smtCountsResult.ok) return smtCountsResult
  if (!postCountsResult.ok) return postCountsResult
  if (!deliveryCountsResult.ok) return deliveryCountsResult

  const assemblyResult = await repairChildrenOnlyAssemblyGroups(
    assemblyFetchResult.groups,
    ordersResult.orders,
    productById,
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
      orders: buildDeliveryInputOrders(assemblyResult.groups, ordersResult.orders, productById),
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

    if (shipmentNumber && !/^MRS-[0-9]+$/.test(shipmentNumber)) {
      return {
        ok: false,
        reason: 'validation',
        detail: '출하번호 형식이 올바르지 않습니다. (예: MRS-0001)',
      }
    }

    const insertPayload: {
      id?: string
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
    }

    if (shipmentNumber) {
      insertPayload.id = shipmentNumber
    }

    const { data: inserted, error: insertError } = await supabase
      .from('delivery_records')
      .insert(insertPayload)
      .select('*')
      .single()

    if (insertError || !inserted) {
      return {
        ok: false,
        reason: 'query',
        detail: insertError?.message || '출하 기록 저장에 실패했습니다.',
      }
    }

    return {
      ok: true,
      record: mapDeliveryRecord(inserted),
      cumulative: currentTotal + quantity,
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

export async function fetchOrderLineUnitPrice(
  orderId: string,
  productId: string,
): Promise<FetchOrderLineUnitPriceResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const orderNumber = String(orderId || '').trim()
  const productCode = String(productId || '').trim()
  if (!productCode) {
    return { ok: true, unitPrice: 0 }
  }

  try {
    const supabase = createSupabaseClient()

    if (orderNumber) {
      const { data, error } = await supabase
        .from('order_lines')
        .select('unit_price, product_id, product_code, derived_from_line_id')
        .eq('order_id', orderNumber)

      if (error) {
        return { ok: false, reason: 'query', detail: error.message }
      }

      const lines = data || []
      const match =
        lines.find(
          (line) =>
            !line.derived_from_line_id &&
            (line.product_id === productCode || line.product_code === productCode),
        ) ||
        lines.find((line) => line.product_id === productCode || line.product_code === productCode)

      const fromOrderLine = Math.max(0, Math.round(Number(match?.unit_price) || 0))
      if (fromOrderLine > 0) {
        return { ok: true, unitPrice: fromOrderLine }
      }
    }

    const { data: item, error: itemError } = await supabase
      .from('items')
      .select('unit_price')
      .eq('id', productCode)
      .maybeSingle()

    if (itemError) {
      return { ok: false, reason: 'query', detail: itemError.message }
    }

    return {
      ok: true,
      unitPrice: Math.max(0, Math.round(Number(item?.unit_price) || 0)),
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateDeliveryRecord(
  recordId: string,
  input: UpdateDeliveryRecordInput,
): Promise<UpdateDeliveryRecordResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

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

    return {
      ok: true,
      record: mapDeliveryRecord(updated),
      cumulative: validation.cumulative,
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

type DeliveryHistoryRecordRow = {
  id: string
  record_date: string
  assembly_group_id: string
  quantity: number
  source: string
  note: string
  created_at: string
  order_assembly_groups:
    | {
        target_quantity: number
        parent_product_id: string
        order_id: string
        items:
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null
        orders:
          | { id: string; customer: string }
          | { id: string; customer: string }[]
          | null
      }
    | {
        target_quantity: number
        parent_product_id: string
        order_id: string
        items:
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null
        orders:
          | { id: string; customer: string }
          | { id: string; customer: string }[]
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

  return {
    id: record.id,
    assemblyGroupId: record.assemblyGroupId,
    recordDate: record.recordDate,
    createdAt: record.createdAt,
    orderNumber: order.id || assemblyGroup.order_id || '',
    customer: order.customer || '',
    productName: product?.name || assemblyGroup.parent_product_id || '',
    productCode: product?.id || assemblyGroup.parent_product_id || '',
    targetQuantity: Math.max(0, Math.floor(Number(assemblyGroup.target_quantity) || 0)),
    quantity: record.quantity,
    source: record.source,
    note: record.note,
  }
}

export async function fetchDeliveryHistory(): Promise<FetchDeliveryHistoryResult> {
  return fetchDeliveryRecords()
}

export async function fetchDeliveryTodayRecords(): Promise<FetchDeliveryHistoryResult> {
  return fetchDeliveryRecords({ recordDate: todayYmdSeoul() })
}

async function fetchDeliveryRecords(options?: {
  recordDate?: string
  limit?: number
}): Promise<FetchDeliveryHistoryResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    let query = supabase
      .from('delivery_records')
      .select(
        `
        id,
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
            name
          ),
          orders (
            id,
            customer
          )
        )
      `,
      )
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 1000)

    if (options?.recordDate) {
      query = query.eq('record_date', options.recordDate)
    }

    const { data, error } = await query

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

    return { ok: true, rows }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
