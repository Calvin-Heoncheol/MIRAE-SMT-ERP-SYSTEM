import { fetchAssemblyGroups } from '@/lib/assembly/repository'
import { fetchDeliveryCumulativeCounts } from '@/lib/delivery/repository'
import { excludeDeliveryCompleteProductionOrders } from '@/lib/delivery/utils'
import { fetchOrders } from '@/lib/orders/repository'
import { fetchProducts } from '@/lib/products/repository'
import { buildProductionOrderLines } from '@/lib/production-input/utils'
import { fetchSmtCumulativeCounts, fetchSmtPlanProgressRange } from '@/lib/smt/repository'
import { createSupabaseClient } from '@/lib/supabase'
import { SMT_PLAN_LINE_NOS } from './config'
import type {
  SmtPlanPageData,
  SmtProductionPlan,
  UpsertSmtProductionPlanInput,
} from './types'
import {
  buildSmtPlanBlocks,
  buildSmtPlanOrderCandidates,
  getWeekDates,
  getWeekEndYmd,
  normalizeSmtPlanPcbSide,
} from './utils'

export type FetchSmtPlanPageResult =
  | { ok: true; data: SmtPlanPageData }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type UpsertSmtProductionPlanResult =
  | { ok: true; plan: SmtProductionPlan }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export type DeleteSmtProductionPlanResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query'; detail: string }

function missingEnvResult<T extends { ok: false; reason: 'env'; detail: string }>(): T {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  } as T
}

export function isMissingSmtPlanTable(detail: string) {
  return detail.includes('smt_production_plans') || detail.includes('schema cache')
}

export function isMissingSmtPlanOrderLineColumn(detail: string) {
  return (
    detail.includes('order_line_id') &&
    (detail.includes('column') || detail.includes('schema cache') || detail.includes('Could not find'))
  )
}

export function isMissingSmtPlanPcbSideColumn(detail: string) {
  return (
    detail.includes('pcb_side') &&
    (detail.includes('column') || detail.includes('schema cache') || detail.includes('Could not find'))
  )
}

function planSchemaErrorDetail(message: string): string | null {
  if (isMissingSmtPlanTable(message)) {
    return 'smt_production_plans 테이블이 없습니다. setup-smt-production-plans.sql 을 실행하세요.'
  }
  if (isMissingSmtPlanOrderLineColumn(message)) {
    return 'smt_production_plans.order_line_id 컬럼이 없습니다. migrate-smt-production-plans-order-line.sql 을 실행하세요.'
  }
  if (isMissingSmtPlanPcbSideColumn(message)) {
    return 'smt_production_plans.pcb_side 컬럼이 없습니다. migrate-smt-production-plans-pcb-side.sql 을 실행하세요.'
  }
  return null
}

const SMT_PLAN_SELECT =
  'id, order_id, order_line_id, planned_date, line_no, pcb_side, planned_quantity, note, created_at'

function mapSmtProductionPlan(row: {
  id: string
  order_id: string
  order_line_id?: string | null
  planned_date: string
  line_no: number
  pcb_side?: string | null
  planned_quantity: number
  note: string
  created_at: string
}): SmtProductionPlan {
  return {
    id: row.id,
    orderId: row.order_id,
    orderLineId: String(row.order_line_id || '').trim(),
    plannedDate: String(row.planned_date || '').slice(0, 10),
    lineNo: Math.max(1, Math.min(7, Math.floor(Number(row.line_no) || 1))),
    pcbSide: normalizeSmtPlanPcbSide(row.pcb_side),
    plannedQuantity: Math.max(1, Math.floor(Number(row.planned_quantity) || 1)),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function fetchSmtProductionPlansForDate(
  plannedDate: string,
): Promise<{ ok: true; plans: SmtProductionPlan[] } | { ok: false; reason: 'env' | 'query'; detail: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const date = plannedDate.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, reason: 'query', detail: '계획일 형식이 올바르지 않습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('smt_production_plans')
      .select(SMT_PLAN_SELECT)
      .eq('planned_date', date)
      .order('line_no', { ascending: true })

    if (error) {
      if (isMissingSmtPlanTable(error.message)) {
        return { ok: true, plans: [] }
      }
      const schemaDetail = planSchemaErrorDetail(error.message)
      if (schemaDetail) {
        return { ok: false, reason: 'query', detail: schemaDetail }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, plans: (data || []).map(mapSmtProductionPlan) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function fetchAllSmtProductionPlans(): Promise<
  { ok: true; plans: SmtProductionPlan[] } | { ok: false; reason: 'env' | 'query'; detail: string }
> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('smt_production_plans')
      .select(SMT_PLAN_SELECT)
      .order('planned_date', { ascending: true })
      .order('line_no', { ascending: true })

    if (error) {
      if (isMissingSmtPlanTable(error.message)) {
        return { ok: true, plans: [] }
      }
      const schemaDetail = planSchemaErrorDetail(error.message)
      if (schemaDetail) {
        return { ok: false, reason: 'query', detail: schemaDetail }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, plans: (data || []).map(mapSmtProductionPlan) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function fetchSmtPlanPageData(weekStart: string): Promise<FetchSmtPlanPageResult> {
  const ordersResult = await fetchOrders()
  if (!ordersResult.ok) {
    return ordersResult
  }

  const productsResult = await fetchProducts()
  if (!productsResult.ok) {
    return productsResult
  }

  const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))

  const [smtCountsResult, smtOrdersResult, allPlansResult, assemblyResult, deliveryCountsResult] =
    await Promise.all([
      fetchSmtCumulativeCounts(),
      fetchOrders({ includeDerivedLines: true }),
      fetchAllSmtProductionPlans(),
      fetchAssemblyGroups(productById),
      fetchDeliveryCumulativeCounts(),
    ])

  if (!smtCountsResult.ok) {
    return smtCountsResult
  }
  if (!smtOrdersResult.ok) {
    return smtOrdersResult
  }
  if (!allPlansResult.ok) {
    return allPlansResult
  }
  if (!assemblyResult.ok) {
    return assemblyResult
  }
  if (!deliveryCountsResult.ok) {
    return deliveryCountsResult
  }

  const weekDates = getWeekDates(weekStart)
  const weekEnd = getWeekEndYmd(weekStart)
  const progressResult = await fetchSmtPlanProgressRange(weekStart, weekEnd)
  if (!progressResult.ok) {
    return progressResult
  }

  const smtLines = buildProductionOrderLines(
    smtOrdersResult.orders,
    'SMT',
    productById,
    'smt',
  )
  const productionOrders = excludeDeliveryCompleteProductionOrders(
    smtLines,
    assemblyResult.groups,
    deliveryCountsResult.counts,
  )

  const weekPlans = allPlansResult.plans.filter(
    (plan) => plan.plannedDate >= weekStart && plan.plannedDate <= weekEnd,
  )

  return {
    ok: true,
    data: {
      weekStart,
      weekDates,
      lineNos: [...SMT_PLAN_LINE_NOS],
      plans: buildSmtPlanBlocks(weekPlans, ordersResult.orders, smtLines),
      productionOrders,
      counts: smtCountsResult.counts,
      planCandidates: buildSmtPlanOrderCandidates(
        ordersResult.orders,
        smtLines,
        smtCountsResult.counts,
        allPlansResult.plans,
        { onlyUnplanned: false },
      ),
      planProgress: progressResult.progress,
    },
  }
}

export async function upsertSmtProductionPlan(
  input: UpsertSmtProductionPlanInput,
): Promise<UpsertSmtProductionPlanResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const orderId = String(input.orderId || '').trim()
  const orderLineId = String(input.orderLineId || '').trim()
  const plannedDate = String(input.plannedDate || '').trim()
  const lineNo = Math.floor(Number(input.lineNo) || 0)
  const pcbSide = normalizeSmtPlanPcbSide(input.pcbSide)
  const plannedQuantity = Math.floor(Number(input.plannedQuantity) || 0)

  if (!orderId) {
    return { ok: false, reason: 'validation', detail: '주문서를 선택하세요.' }
  }
  if (!orderLineId) {
    return { ok: false, reason: 'validation', detail: '주문 라인을 선택하세요.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
    return { ok: false, reason: 'validation', detail: '계획일 형식이 올바르지 않습니다.' }
  }
  if (lineNo < 1 || lineNo > 7) {
    return { ok: false, reason: 'validation', detail: 'SMT 라인은 1~7 사이여야 합니다.' }
  }
  if (plannedQuantity < 1) {
    return { ok: false, reason: 'validation', detail: '계획 수량은 1 이상이어야 합니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const payload = {
      order_id: orderId,
      order_line_id: orderLineId,
      planned_date: plannedDate,
      line_no: lineNo,
      pcb_side: pcbSide,
      planned_quantity: plannedQuantity,
      note: input.note?.trim() || '',
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      const { data, error } = await supabase
        .from('smt_production_plans')
        .update(payload)
        .eq('id', input.id)
        .select(SMT_PLAN_SELECT)
        .single()

      if (error || !data) {
        const schemaDetail = planSchemaErrorDetail(error?.message || '')
        if (schemaDetail) {
          return { ok: false, reason: 'query', detail: schemaDetail }
        }
        return { ok: false, reason: 'query', detail: error?.message || '생산계획 수정에 실패했습니다.' }
      }

      return { ok: true, plan: mapSmtProductionPlan(data) }
    }

    const { data, error } = await supabase
      .from('smt_production_plans')
      .upsert(payload, { onConflict: 'order_line_id,planned_date,line_no,pcb_side' })
      .select(SMT_PLAN_SELECT)
      .single()

    if (error || !data) {
      const schemaDetail = planSchemaErrorDetail(error?.message || '')
      if (schemaDetail) {
        return { ok: false, reason: 'query', detail: schemaDetail }
      }
      return { ok: false, reason: 'query', detail: error?.message || '생산계획 저장에 실패했습니다.' }
    }

    return { ok: true, plan: mapSmtProductionPlan(data) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteSmtProductionPlan(planId: string): Promise<DeleteSmtProductionPlanResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const id = String(planId || '').trim()
  if (!id) {
    return { ok: false, reason: 'query', detail: '삭제할 계획을 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('smt_production_plans').delete().eq('id', id)

    if (error) {
      if (isMissingSmtPlanTable(error.message)) {
        return {
          ok: false,
          reason: 'query',
          detail: 'smt_production_plans 테이블이 없습니다. setup-smt-production-plans.sql 을 실행하세요.',
        }
      }
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
