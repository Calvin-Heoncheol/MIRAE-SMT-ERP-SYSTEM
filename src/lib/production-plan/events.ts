import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { resolveCreatedBySnapshot } from '@/lib/auth/created-by'
import { createSupabaseClient } from '@/lib/supabase'
import { PLAN_EVENT_KINDS, type PlanEventKind } from './plan-badges'

export type ProductionPlanEvent = {
  id: string
  kind: PlanEventKind
  orderId: string
  orderLineId: string
  plannedDate: string
  plannedEndDate: string
  plannedQuantity: number | null
  orderNumber: string
  customerPoNumber: string
  customer: string
  productName: string
  note: string
}

export type ProductionPlanEventWriteResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'auth' | 'validation'; detail: string }

export type FetchProductionPlanEventsResult =
  | { ok: true; events: ProductionPlanEvent[]; tableMissing: boolean }
  | { ok: false; detail: string }

const MISSING_TABLE_DETAIL =
  'production_plan_events 테이블이 없습니다. Supabase에서 migrate-production-plan-events.sql 을 실행하세요.'

function isMissingEventsTable(message: string) {
  const lower = message.toLowerCase()
  return lower.includes('production_plan_events')
}

function ymd(value: unknown) {
  return String(value || '').slice(0, 10)
}

export async function fetchProductionPlanEvents(): Promise<FetchProductionPlanEventsResult> {
  const supabase = createSupabaseClient()
  if (!supabase) return { ok: false, detail: 'Supabase 설정이 없습니다.' }

  const { data, error } = await supabase
    .from('production_plan_events')
    .select(
      'id, kind, order_id, order_line_id, planned_date, planned_end_date, planned_quantity, order_number, customer_po_number, customer, product_name, note',
    )
    .order('planned_date', { ascending: true })
    .limit(5000)

  if (error) {
    if (isMissingEventsTable(error.message)) return { ok: true, events: [], tableMissing: true }
    return { ok: false, detail: error.message }
  }

  const events: ProductionPlanEvent[] = []
  for (const row of data || []) {
    const kind = String(row.kind) as PlanEventKind
    if (!PLAN_EVENT_KINDS.includes(kind)) continue
    const plannedDate = ymd(row.planned_date)
    if (!plannedDate) continue
    events.push({
      id: String(row.id),
      kind,
      orderId: String(row.order_id || ''),
      orderLineId: String(row.order_line_id || ''),
      plannedDate,
      plannedEndDate: ymd(row.planned_end_date) || plannedDate,
      plannedQuantity: row.planned_quantity == null ? null : Number(row.planned_quantity),
      orderNumber: String(row.order_number || ''),
      customerPoNumber: String(row.customer_po_number || ''),
      customer: String(row.customer || ''),
      productName: String(row.product_name || ''),
      note: String(row.note || ''),
    })
  }
  return { ok: true, events, tableMissing: false }
}

export type SaveProductionPlanEventInput = {
  id?: string
  kind: PlanEventKind
  orderId: string
  orderLineId: string
  plannedDate: string
  plannedEndDate?: string
  plannedQuantity: number | null
  orderNumber?: string
  customerPoNumber?: string
  customer?: string
  productName?: string
  note?: string
}

export async function saveProductionPlanEvent(
  input: SaveProductionPlanEventInput,
): Promise<ProductionPlanEventWriteResult> {
  const gate = await assertCanWrite({
    module: 'production_plan',
    action: input.id ? 'update' : 'create',
  })
  if (!gate.ok) return gate

  const plannedDate = ymd(input.plannedDate)
  const plannedEndDate = ymd(input.plannedEndDate) || plannedDate
  if (!plannedDate) return { ok: false, reason: 'validation', detail: '날짜를 입력하세요.' }
  if (plannedEndDate < plannedDate) {
    return { ok: false, reason: 'validation', detail: '종료일이 시작일보다 빠릅니다.' }
  }
  if (!input.orderId.trim() || !input.orderLineId.trim()) {
    return { ok: false, reason: 'validation', detail: '발주 품목이 올바르지 않습니다.' }
  }
  const quantity =
    input.plannedQuantity == null ? null : Math.max(1, Math.floor(input.plannedQuantity))

  const supabase = createSupabaseClient()
  if (!supabase) return { ok: false, reason: 'env', detail: 'Supabase 설정이 없습니다.' }

  const schedule = {
    planned_date: plannedDate,
    planned_end_date: plannedEndDate,
    planned_quantity: quantity,
    note: String(input.note || '').trim(),
  }

  const { error } = input.id
    ? await supabase.from('production_plan_events').update(schedule).eq('id', input.id)
    : await (async () => {
        const createdBy = await resolveCreatedBySnapshot()
        return supabase.from('production_plan_events').insert({
          ...schedule,
          kind: input.kind,
          order_id: input.orderId.trim(),
          order_line_id: input.orderLineId.trim(),
          order_number: String(input.orderNumber || ''),
          customer_po_number: String(input.customerPoNumber || ''),
          customer: String(input.customer || ''),
          product_name: String(input.productName || ''),
          created_by: createdBy.createdBy,
          created_by_name: createdBy.createdByName,
        })
      })()

  if (error) {
    return {
      ok: false,
      reason: 'query',
      detail: isMissingEventsTable(error.message) ? MISSING_TABLE_DETAIL : error.message,
    }
  }
  return { ok: true }
}

export async function deleteProductionPlanEvent(id: string): Promise<ProductionPlanEventWriteResult> {
  const gate = await assertCanWrite({ module: 'production_plan', action: 'update' })
  if (!gate.ok) return gate

  const supabase = createSupabaseClient()
  if (!supabase) return { ok: false, reason: 'env', detail: 'Supabase 설정이 없습니다.' }

  const { error } = await supabase.from('production_plan_events').delete().eq('id', id)
  if (error) {
    return {
      ok: false,
      reason: 'query',
      detail: isMissingEventsTable(error.message) ? MISSING_TABLE_DETAIL : error.message,
    }
  }
  return { ok: true }
}
