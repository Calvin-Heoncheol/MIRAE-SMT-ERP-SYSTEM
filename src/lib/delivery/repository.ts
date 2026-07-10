import {
  ensureAssemblyGroupsForOrders,
  fetchAssemblyGroups,
} from '@/lib/assembly/repository'
import { fetchOrders } from '@/lib/orders/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { fetchPostProcessCumulativeCounts } from '@/lib/post-process/repository'
import { fetchProducts } from '@/lib/products/repository'
import { fetchSmtCumulativeCounts } from '@/lib/smt/repository'
import { createSupabaseClient } from '@/lib/supabase'
import type { CreateDeliveryRecordInput, DeliveryHistoryRow, DeliveryRecord, DeliverySource } from './types'
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

  const [assemblyResult, smtCountsResult, postCountsResult, deliveryCountsResult] = await Promise.all([
    fetchAssemblyGroups(productById),
    fetchSmtCumulativeCounts(),
    fetchPostProcessCumulativeCounts(),
    fetchDeliveryCumulativeCounts(),
  ])

  if (!assemblyResult.ok) return assemblyResult
  if (!smtCountsResult.ok) return smtCountsResult
  if (!postCountsResult.ok) return postCountsResult
  if (!deliveryCountsResult.ok) return deliveryCountsResult

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
      orders: buildDeliveryInputOrders(assemblyResult.groups, ordersResult.orders, '완제품'),
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
        products:
          | { id: string; product_name: string }
          | { id: string; product_name: string }[]
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
        products:
          | { id: string; product_name: string }
          | { id: string; product_name: string }[]
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

  const products = assemblyGroup.products
  const product = Array.isArray(products) ? products[0] : products

  const orders = assemblyGroup.orders
  const order = Array.isArray(orders) ? orders[0] : orders
  if (!order) return null

  const record = mapDeliveryRecord(row)

  return {
    id: record.id,
    recordDate: record.recordDate,
    createdAt: record.createdAt,
    orderNumber: order.id || assemblyGroup.order_id || '',
    customer: order.customer || '',
    productName: product?.product_name || assemblyGroup.parent_product_id || '',
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
          products (
            id,
            product_name
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
