import { createSupabaseClient } from '@/lib/supabase'
import { fetchOrders } from './repository'
import { buildOrderProgressRows, type OrderProgressRow } from './progress'

export type FetchOrderProgressResult =
  | { ok: true; rows: OrderProgressRow[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

function missingEnvResult(): FetchOrderProgressResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

function isMissingProgressTable(detail: string) {
  return (
    detail.includes('order_assembly_groups') ||
    detail.includes('delivery_totals') ||
    detail.includes('delivery_records') ||
    detail.includes('schema cache')
  )
}

async function fetchShippedQuantityByOrderId(): Promise<
  | { ok: true; shippedByOrderId: Record<string, number> }
  | { ok: false; reason: 'query'; detail: string }
> {
  const supabase = createSupabaseClient()

  const { data: groups, error: groupsError } = await supabase
    .from('order_assembly_groups')
    .select('id, order_id')

  if (groupsError) {
    if (isMissingProgressTable(groupsError.message)) {
      return { ok: true, shippedByOrderId: {} }
    }
    return { ok: false, reason: 'query', detail: groupsError.message }
  }

  const orderIdByGroupId = new Map<string, string>()
  for (const row of groups || []) {
    const groupId = String(row.id || '').trim()
    const orderId = String(row.order_id || '').trim()
    if (!groupId || !orderId) continue
    orderIdByGroupId.set(groupId, orderId)
  }

  if (!orderIdByGroupId.size) {
    return { ok: true, shippedByOrderId: {} }
  }

  const { data: totals, error: totalsError } = await supabase
    .from('delivery_totals')
    .select('assembly_group_id, total_quantity')

  if (totalsError) {
    if (isMissingProgressTable(totalsError.message)) {
      return { ok: true, shippedByOrderId: {} }
    }
    return { ok: false, reason: 'query', detail: totalsError.message }
  }

  const shippedByOrderId: Record<string, number> = {}
  for (const row of totals || []) {
    const groupId = String(row.assembly_group_id || '').trim()
    const orderId = orderIdByGroupId.get(groupId)
    if (!orderId) continue
    const qty = Math.max(0, Math.floor(Number(row.total_quantity) || 0))
    if (qty <= 0) continue
    shippedByOrderId[orderId] = (shippedByOrderId[orderId] || 0) + qty
  }

  return { ok: true, shippedByOrderId }
}

/** 발주서 단위 발주현황 — 발주수량 대비 출하누적 */
export async function fetchOrderProgressPageData(): Promise<FetchOrderProgressResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const [ordersResult, shippedResult] = await Promise.all([
      fetchOrders(),
      fetchShippedQuantityByOrderId(),
    ])

    if (!ordersResult.ok) return ordersResult
    if (!shippedResult.ok) return shippedResult

    return {
      ok: true,
      rows: buildOrderProgressRows(ordersResult.orders, shippedResult.shippedByOrderId),
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
