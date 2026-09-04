import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { resolveCreatedBySnapshot } from '@/lib/auth/created-by'
import { fetchProductionInputPageData } from '@/lib/production-input/repository'
import { formatProductionProductName } from '@/lib/production-input/utils'
import { SMT_PRODUCTION_INPUT_CONFIG } from '@/lib/smt/config'
import { confirmProductionPlanItem, fetchProductionPlanBoard } from '@/lib/production-plan/repository'
import { isProductionPlanScheduleRow } from '@/lib/production-plan/utils'
import { createSupabaseClient } from '@/lib/supabase'
import type {
  FetchMaterialManualHistoryResult,
  FetchMaterialManualPageResult,
  MaterialManualHistoryRow,
  MaterialManualPageData,
  MaterialManualSaveResult,
} from './types'

function missingEnv(): FetchMaterialManualPageResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

export function isMissingMaterialOrderSetOutboundTable(detail: string) {
  const lower = detail.toLowerCase()
  return (
    lower.includes('material_order_set_outbound_logs') ||
    (lower.includes('schema cache') && lower.includes('material_order_set_outbound'))
  )
}

function buildInboundByLineId(rows: Awaited<ReturnType<typeof fetchProductionPlanBoard>>) {
  const map: Record<string, number> = {}
  if (!rows.ok) return map
  for (const row of rows.data.rows) {
    if (row.scope !== 'material' || !isProductionPlanScheduleRow(row)) continue
    const lineId = row.targetId.trim()
    if (!lineId) continue
    map[lineId] = (map[lineId] ?? 0) + Math.max(0, row.plannedQuantity ?? 0)
  }
  return map
}

async function fetchOutboundTotalsByLineId(): Promise<
  | { ok: true; totals: Record<string, number> }
  | { ok: false; reason: 'env' | 'query'; detail: string }
> {
  const supabase = createSupabaseClient()
  if (!supabase) {
    return { ok: false, reason: 'env', detail: 'Supabase 설정이 없습니다.' }
  }

  const { data, error } = await supabase
    .from('material_order_set_outbound_logs')
    .select('order_line_id, quantity')

  if (error) {
    return { ok: false, reason: 'query', detail: error.message }
  }

  const totals: Record<string, number> = {}
  for (const row of data || []) {
    const lineId = String(row.order_line_id || '').trim()
    if (!lineId) continue
    totals[lineId] = (totals[lineId] ?? 0) + Math.max(0, Math.floor(Number(row.quantity) || 0))
  }
  return { ok: true, totals }
}

export async function fetchMaterialManualPageData(): Promise<FetchMaterialManualPageResult> {
  const supabase = createSupabaseClient()
  if (!supabase) return missingEnv()

  const [inputResult, boardResult, outboundResult] = await Promise.all([
    fetchProductionInputPageData(SMT_PRODUCTION_INPUT_CONFIG),
    fetchProductionPlanBoard(),
    fetchOutboundTotalsByLineId(),
  ])

  if (!inputResult.ok) {
    return inputResult
  }
  if (!boardResult.ok) {
    return boardResult
  }
  if (!outboundResult.ok) {
    return outboundResult
  }

  const inboundByLineId = buildInboundByLineId(boardResult)
  const metricsByLineId: MaterialManualPageData['metricsByLineId'] = {}

  for (const order of inputResult.data.orders) {
    metricsByLineId[order.orderLineId] = {
      inboundSets: inboundByLineId[order.orderLineId] ?? 0,
      outboundSets: outboundResult.totals[order.orderLineId] ?? 0,
    }
  }

  return {
    ok: true,
    data: {
      orders: inputResult.data.orders,
      metricsByLineId,
    },
  }
}

export async function saveMaterialManualInbound(input: {
  orderId: string
  orderLineId: string
  recordDate: string
  quantity: number
}): Promise<MaterialManualSaveResult> {
  const orderId = input.orderId.trim()
  const orderLineId = input.orderLineId.trim()
  const recordDate = String(input.recordDate || '').trim().slice(0, 10)
  const quantity = Math.floor(Number(input.quantity) || 0)

  if (!orderId || !orderLineId) {
    return { ok: false, reason: 'validation', detail: '발주 정보가 올바르지 않습니다.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
    return { ok: false, reason: 'validation', detail: '입고일을 선택하세요.' }
  }
  if (quantity < 1) {
    return { ok: false, reason: 'validation', detail: '입고 수량은 1 이상이어야 합니다.' }
  }

  return confirmProductionPlanItem({
    scope: 'material',
    orderId,
    targetId: orderLineId,
    plannedDate: recordDate,
    plannedQuantity: quantity,
  })
}

export async function fetchMaterialManualHistoryByOrderLine(
  orderLineId: string,
): Promise<FetchMaterialManualHistoryResult> {
  const lineId = orderLineId.trim()
  if (!lineId) {
    return { ok: true, rows: [] }
  }

  const supabase = createSupabaseClient()
  if (!supabase) {
    return { ok: false, reason: 'env', detail: 'Supabase 설정이 없습니다.' }
  }

  const [inboundResult, outboundResult] = await Promise.all([
    supabase
      .from('production_plan_board_items')
      .select(
        'id, order_id, order_line_id, planned_date, planned_quantity, confirmed_at, confirmed_by_name',
      )
      .eq('scope', 'material')
      .eq('status', 'confirmed')
      .eq('order_line_id', lineId)
      .order('confirmed_at', { ascending: false }),
    supabase
      .from('material_order_set_outbound_logs')
      .select('id, order_id, order_line_id, record_date, quantity, created_at, created_by_name')
      .eq('order_line_id', lineId)
      .order('created_at', { ascending: false }),
  ])

  if (inboundResult.error) {
    return { ok: false, reason: 'query', detail: inboundResult.error.message }
  }
  if (outboundResult.error) {
    return { ok: false, reason: 'query', detail: outboundResult.error.message }
  }

  const rows: MaterialManualHistoryRow[] = []

  for (const row of inboundResult.data || []) {
    const quantity = Math.max(0, Math.floor(Number(row.planned_quantity) || 0))
    if (quantity < 1) continue
    rows.push({
      id: `in-${row.id}`,
      kind: 'inbound',
      recordDate: String(row.planned_date || '').slice(0, 10),
      quantity,
      createdAt: String(row.confirmed_at || ''),
      createdByName: String(row.confirmed_by_name || '').trim(),
      orderId: String(row.order_id || '').trim(),
      orderLineId: lineId,
      orderNumber: '',
      customerPoNumber: '',
      customer: '',
      productName: '',
      productCode: '',
    })
  }

  for (const row of outboundResult.data || []) {
    const quantity = Math.max(0, Math.floor(Number(row.quantity) || 0))
    if (quantity < 1) continue
    rows.push({
      id: `out-${row.id}`,
      kind: 'outbound',
      recordDate: String(row.record_date || '').slice(0, 10),
      quantity,
      createdAt: String(row.created_at || ''),
      createdByName: String(row.created_by_name || '').trim(),
      orderId: String(row.order_id || '').trim(),
      orderLineId: lineId,
      orderNumber: '',
      customerPoNumber: '',
      customer: '',
      productName: '',
      productCode: '',
    })
  }

  rows.sort((a, b) => {
    const aTime = a.createdAt || a.recordDate
    const bTime = b.createdAt || b.recordDate
    return bTime.localeCompare(aTime)
  })

  return { ok: true, rows }
}

export async function fetchMaterialManualHistory(): Promise<FetchMaterialManualHistoryResult> {
  const supabase = createSupabaseClient()
  if (!supabase) {
    return { ok: false, reason: 'env', detail: 'Supabase 설정이 없습니다.' }
  }

  const [inputResult, inboundResult, outboundResult] = await Promise.all([
    fetchProductionInputPageData(SMT_PRODUCTION_INPUT_CONFIG),
    supabase
      .from('production_plan_board_items')
      .select(
        'id, order_id, order_line_id, planned_date, planned_quantity, confirmed_at, confirmed_by_name',
      )
      .eq('scope', 'material')
      .eq('status', 'confirmed')
      .order('confirmed_at', { ascending: false }),
    supabase
      .from('material_order_set_outbound_logs')
      .select('id, order_id, order_line_id, record_date, quantity, created_at, created_by_name')
      .order('created_at', { ascending: false }),
  ])

  if (!inputResult.ok) {
    return { ok: false, reason: inputResult.reason, detail: inputResult.detail }
  }
  if (inboundResult.error) {
    return { ok: false, reason: 'query', detail: inboundResult.error.message }
  }
  if (outboundResult.error) {
    return { ok: false, reason: 'query', detail: outboundResult.error.message }
  }

  const orderByLineId = new Map(
    inputResult.data.orders.map((order) => [order.orderLineId, order] as const),
  )

  const rows: MaterialManualHistoryRow[] = []

  for (const row of inboundResult.data || []) {
    const quantity = Math.max(0, Math.floor(Number(row.planned_quantity) || 0))
    if (quantity < 1) continue
    const orderLineId = String(row.order_line_id || '').trim()
    const order = orderByLineId.get(orderLineId)
    rows.push({
      id: `in-${row.id}`,
      kind: 'inbound',
      recordDate: String(row.planned_date || '').slice(0, 10),
      quantity,
      createdAt: String(row.confirmed_at || ''),
      createdByName: String(row.confirmed_by_name || '').trim(),
      orderId: String(row.order_id || order?.orderId || '').trim(),
      orderLineId,
      orderNumber: order?.orderNumber || '',
      customerPoNumber: order?.customerPoNumber || '',
      customer: order?.customer || '',
      productName: order ? formatProductionProductName(order) : '',
      productCode: order?.productCode || '',
    })
  }

  for (const row of outboundResult.data || []) {
    const quantity = Math.max(0, Math.floor(Number(row.quantity) || 0))
    if (quantity < 1) continue
    const orderLineId = String(row.order_line_id || '').trim()
    const order = orderByLineId.get(orderLineId)
    rows.push({
      id: `out-${row.id}`,
      kind: 'outbound',
      recordDate: String(row.record_date || '').slice(0, 10),
      quantity,
      createdAt: String(row.created_at || ''),
      createdByName: String(row.created_by_name || '').trim(),
      orderId: String(row.order_id || order?.orderId || '').trim(),
      orderLineId,
      orderNumber: order?.orderNumber || '',
      customerPoNumber: order?.customerPoNumber || '',
      customer: order?.customer || '',
      productName: order ? formatProductionProductName(order) : '',
      productCode: order?.productCode || '',
    })
  }

  rows.sort((a, b) => {
    const aTime = a.createdAt || a.recordDate
    const bTime = b.createdAt || b.recordDate
    return bTime.localeCompare(aTime)
  })

  return { ok: true, rows }
}

export async function saveMaterialManualOutbound(input: {
  orderId: string
  orderLineId: string
  recordDate: string
  quantity: number
}): Promise<MaterialManualSaveResult> {
  const gate = await assertCanWrite({ module: 'materials', action: 'create' })
  if (!gate.ok) return gate

  const orderId = input.orderId.trim()
  const orderLineId = input.orderLineId.trim()
  const recordDate = String(input.recordDate || '').trim().slice(0, 10)
  const quantity = Math.floor(Number(input.quantity) || 0)

  if (!orderId || !orderLineId) {
    return { ok: false, reason: 'validation', detail: '발주 정보가 올바르지 않습니다.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
    return { ok: false, reason: 'validation', detail: '불출일을 선택하세요.' }
  }
  if (quantity < 1) {
    return { ok: false, reason: 'validation', detail: '불출 수량은 1 이상이어야 합니다.' }
  }

  const supabase = createSupabaseClient()
  if (!supabase) {
    return { ok: false, reason: 'env', detail: 'Supabase 설정이 없습니다.' }
  }

  const createdBy = await resolveCreatedBySnapshot()
  const { error } = await supabase.from('material_order_set_outbound_logs').insert({
    order_id: orderId,
    order_line_id: orderLineId,
    record_date: recordDate,
    quantity,
    created_by_name: createdBy.name,
  })

  if (error) {
    return { ok: false, reason: 'query', detail: error.message }
  }

  return { ok: true }
}
