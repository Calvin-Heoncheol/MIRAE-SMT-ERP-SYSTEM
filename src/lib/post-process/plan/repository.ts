import { fetchAssemblyGroups, repairChildrenOnlyAssemblyGroups } from '@/lib/assembly/repository'
import {
  assertCanWrite,
  postProcessTeamToAccessModule,
} from '@/lib/auth/assert-can-write'
import {
  isMissingCreatedByColumn,
  resolveCreatedBySnapshot,
  stripCreatedByFields,
} from '@/lib/auth/created-by'
import { fetchDeliveryCumulativeCounts } from '@/lib/delivery/repository'
import { excludeDeliveryCompleteProductionOrders } from '@/lib/delivery/utils'
import { fetchOrders } from '@/lib/orders/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { fetchProducts } from '@/lib/products/repository'
import {
  buildPostProcessAssemblyLines,
  buildProductionOrderLines,
  resolveProductionCount,
} from '@/lib/production-input/utils'
import { fetchSmtCumulativeCounts } from '@/lib/smt/repository'
import { fetchAllSmtProductionPlans } from '@/lib/smt/plan/repository'
import { insertPlanCloseLogs, type PlanCloseLogInsert } from '@/lib/production-plan-close-logs'
import { buildPostProcessPlanProgressKey } from '@/lib/post-process/count-keys'
import {
  fetchPostProcessCumulativeCounts,
  fetchPostProcessPlanProgressRange,
} from '@/lib/post-process/repository'
import { createSupabaseClient } from '@/lib/supabase'
import { normalizePostProcessTeam } from '@/lib/post-process/teams'
import type {
  CandidateSmtStatus,
  PostProcessPlanPageData,
  PostProcessProductionPlan,
  UpsertPostProcessProductionPlanInput,
} from './types'
import {
  buildPostProcessPlanBlocks,
  buildPostProcessPlanOrderCandidates,
  getWeekDates,
  getWeekEndYmd,
} from './utils'

export type FetchPostProcessPlanPageResult =
  | { ok: true; data: PostProcessPlanPageData }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type UpsertPostProcessProductionPlanResult =
  | { ok: true; plan: PostProcessProductionPlan }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export type DeletePostProcessProductionPlanResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

function missingEnvResult<T extends { ok: false; reason: 'env'; detail: string }>(): T {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  } as T
}

export function isMissingPostProcessPlanTable(detail: string) {
  return detail.includes('post_process_production_plans') || detail.includes('schema cache')
}

export function isMissingPostProcessPlanTeamColumn(detail: string) {
  return (
    detail.includes('team') &&
    (detail.includes('column') || detail.includes('schema cache') || detail.includes('Could not find'))
  )
}

function planSchemaErrorDetail(message: string): string | null {
  if (isMissingPostProcessPlanTeamColumn(message)) {
    return 'post_process_production_plans.team 컬럼이 없습니다. migrate-post-process-production-plans-team.sql 을 실행하세요.'
  }
  if (isMissingCreatedByColumn(message)) {
    return 'post_process_production_plans.created_by 컬럼이 없습니다. migrate-created-by-high-med.sql 을 실행하세요.'
  }
  if (isMissingPostProcessPlanTable(message)) {
    return 'post_process_production_plans 테이블이 없습니다. setup-post-process-production-plans.sql 을 실행하세요.'
  }
  return null
}

const PLAN_SELECT =
  'id, order_id, assembly_group_id, planned_date, team, planned_quantity, note, created_by, created_by_name, created_at'
const PLAN_SELECT_LEGACY = PLAN_SELECT.replace(', created_by, created_by_name', '')

function mapPlan(row: {
  id: string
  order_id: string
  assembly_group_id: string
  planned_date: string
  team?: string | null
  planned_quantity: number
  note: string
  created_by?: string | null
  created_by_name?: string | null
  created_at: string
}): PostProcessProductionPlan {
  return {
    id: row.id,
    orderId: row.order_id,
    assemblyGroupId: String(row.assembly_group_id || '').trim(),
    plannedDate: String(row.planned_date || '').slice(0, 10),
    team: normalizePostProcessTeam(row.team),
    plannedQuantity: Math.max(1, Math.floor(Number(row.planned_quantity) || 1)),
    note: row.note || '',
    createdByName: String(row.created_by_name || '').trim(),
    createdAt: row.created_at,
  }
}

export async function fetchPostProcessProductionPlansForDate(
  plannedDate: string,
): Promise<
  { ok: true; plans: PostProcessProductionPlan[] } | { ok: false; reason: 'env' | 'query'; detail: string }
> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const date = plannedDate.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, reason: 'query', detail: '계획일 형식이 올바르지 않습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    let { data, error } = await supabase
      .from('post_process_production_plans')
      .select(PLAN_SELECT)
      .eq('planned_date', date)
      .order('created_at', { ascending: true })

    if (error && isMissingCreatedByColumn(error.message)) {
      const legacy = await supabase
        .from('post_process_production_plans')
        .select(PLAN_SELECT_LEGACY)
        .eq('planned_date', date)
        .order('created_at', { ascending: true })
      data = legacy.data as typeof data
      error = legacy.error
    }

    if (error) {
      if (isMissingPostProcessPlanTable(error.message)) {
        return { ok: true, plans: [] }
      }
      const schemaDetail = planSchemaErrorDetail(error.message)
      if (schemaDetail) {
        return { ok: false, reason: 'query', detail: schemaDetail }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, plans: (data || []).map(mapPlan) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function fetchAllPostProcessProductionPlans(): Promise<
  { ok: true; plans: PostProcessProductionPlan[] } | { ok: false; reason: 'env' | 'query'; detail: string }
> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    let { data, error } = await supabase
      .from('post_process_production_plans')
      .select(PLAN_SELECT)
      .order('planned_date', { ascending: true })

    if (error && isMissingCreatedByColumn(error.message)) {
      const legacy = await supabase
        .from('post_process_production_plans')
        .select(PLAN_SELECT_LEGACY)
        .order('planned_date', { ascending: true })
      data = legacy.data as typeof data
      error = legacy.error
    }

    if (error) {
      if (isMissingPostProcessPlanTable(error.message)) {
        return { ok: true, plans: [] }
      }
      const schemaDetail = planSchemaErrorDetail(error.message)
      if (schemaDetail) {
        return { ok: false, reason: 'query', detail: schemaDetail }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, plans: (data || []).map(mapPlan) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 지난 날짜의 미완료 후공정 생산계획 자동 마감.
 * planned_date < today 이고 실적 < 계획이면 계획수량을 실적으로 맞추고,
 * 실적이 0이면 계획을 삭제해 잔량을 다시 배정할 수 있게 한다.
 */
export async function closeIncompletePastPostProcessPlans(
  today: string = todayYmdSeoul(),
): Promise<
  | { ok: true; adjusted: number; deleted: number }
  | { ok: false; reason: 'env' | 'query'; detail: string }
> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const todayYmd = today.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) {
    return { ok: false, reason: 'query', detail: '기준일 형식이 올바르지 않습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    let { data, error } = await supabase
      .from('post_process_production_plans')
      .select(PLAN_SELECT)
      .lt('planned_date', todayYmd)

    if (error && isMissingCreatedByColumn(error.message)) {
      const legacy = await supabase
        .from('post_process_production_plans')
        .select(PLAN_SELECT_LEGACY)
        .lt('planned_date', todayYmd)
      data = legacy.data as typeof data
      error = legacy.error
    }

    if (error) {
      if (isMissingPostProcessPlanTable(error.message)) {
        return { ok: true, adjusted: 0, deleted: 0 }
      }
      const schemaDetail = planSchemaErrorDetail(error.message)
      if (schemaDetail) {
        return { ok: false, reason: 'query', detail: schemaDetail }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    const pastPlans = (data || []).map(mapPlan)
    if (!pastPlans.length) {
      return { ok: true, adjusted: 0, deleted: 0 }
    }

    const minDate = pastPlans.reduce(
      (min, plan) => (plan.plannedDate < min ? plan.plannedDate : min),
      pastPlans[0].plannedDate,
    )
    const progressResult = await fetchPostProcessPlanProgressRange(minDate, todayYmd)
    if (!progressResult.ok) {
      return progressResult
    }

    let adjusted = 0
    let deleted = 0
    const closeLogs: PlanCloseLogInsert[] = []

    for (const plan of pastPlans) {
      const produced =
        progressResult.progress[
          buildPostProcessPlanProgressKey(plan.assemblyGroupId, plan.plannedDate, plan.team)
        ] ?? 0

      if (produced >= plan.plannedQuantity) continue

      if (produced < 1) {
        const { error: deleteError } = await supabase
          .from('post_process_production_plans')
          .delete()
          .eq('id', plan.id)
        if (deleteError) {
          return { ok: false, reason: 'query', detail: deleteError.message }
        }
        deleted += 1
        closeLogs.push({
          module: 'post_process',
          plannedDate: plan.plannedDate,
          team: plan.team,
          orderId: plan.orderId,
          originalQuantity: plan.plannedQuantity,
          producedQuantity: 0,
        })
        continue
      }

      const { error: updateError } = await supabase
        .from('post_process_production_plans')
        .update({
          planned_quantity: produced,
          updated_at: new Date().toISOString(),
        })
        .eq('id', plan.id)

      if (updateError) {
        return { ok: false, reason: 'query', detail: updateError.message }
      }
      adjusted += 1
      closeLogs.push({
        module: 'post_process',
        plannedDate: plan.plannedDate,
        team: plan.team,
        orderId: plan.orderId,
        originalQuantity: plan.plannedQuantity,
        producedQuantity: produced,
      })
    }

    // 원계획 수량 보존 (달성률 계산용) — 실패해도 마감은 유지
    await insertPlanCloseLogs(supabase, closeLogs)

    return { ok: true, adjusted, deleted }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function fetchPostProcessPlanPageData(
  weekStart: string,
): Promise<FetchPostProcessPlanPageResult> {
  // 과거 미완료 계획 자동 마감 후 조회 (실패해도 화면은 계속)
  await closeIncompletePastPostProcessPlans()

  const ordersResult = await fetchOrders()
  if (!ordersResult.ok) {
    return ordersResult
  }

  const productsResult = await fetchProducts()
  if (!productsResult.ok) {
    return productsResult
  }

  const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))

  const [
    countsResult,
    allPlansResult,
    assemblyFetchResult,
    deliveryCountsResult,
    smtPlansResult,
    smtOrdersResult,
    smtCountsResult,
  ] = await Promise.all([
    fetchPostProcessCumulativeCounts(),
    fetchAllPostProcessProductionPlans(),
    fetchAssemblyGroups(productById),
    fetchDeliveryCumulativeCounts(),
    fetchAllSmtProductionPlans(),
    fetchOrders({ includeDerivedLines: true }),
    fetchSmtCumulativeCounts(),
  ])

  if (!countsResult.ok) return countsResult
  if (!allPlansResult.ok) return allPlansResult
  if (!assemblyFetchResult.ok) return assemblyFetchResult
  if (!deliveryCountsResult.ok) return deliveryCountsResult

  const assemblyResult = await repairChildrenOnlyAssemblyGroups(
    assemblyFetchResult.groups,
    ordersResult.orders,
    productById,
  )
  if (!assemblyResult.ok) return assemblyResult

  const weekDates = getWeekDates(weekStart)
  const weekEnd = getWeekEndYmd(weekStart)
  const progressResult = await fetchPostProcessPlanProgressRange(weekStart, weekEnd)
  if (!progressResult.ok) {
    return progressResult
  }

  const assemblyLines = excludeDeliveryCompleteProductionOrders(
    buildPostProcessAssemblyLines(assemblyResult.groups, ordersResult.orders, productById),
    assemblyResult.groups,
    deliveryCountsResult.counts,
  )

  const weekPlans = allPlansResult.plans.filter(
    (plan) => plan.plannedDate >= weekStart && plan.plannedDate <= weekEnd,
  )

  // 후보 카드용 SMT(생산1팀) 진행 상태 — 조회 실패 시 표시만 생략
  const smtStatusByGroupId = new Map<string, CandidateSmtStatus>()
  if (smtPlansResult.ok && smtOrdersResult.ok && smtCountsResult.ok) {
    const smtLines = buildProductionOrderLines(smtOrdersResult.orders, 'SMT', productById, 'smt')
    const smtLineByLineId = new Map(smtLines.map((line) => [line.orderLineId, line]))

    // SMT 계획 합계·마지막 계획일 (주문 라인 단위)
    const plannedByLineId = new Map<string, { total: number; lastDate: string }>()
    for (const plan of smtPlansResult.plans) {
      if (!plan.orderLineId) continue
      const existing = plannedByLineId.get(plan.orderLineId) ?? { total: 0, lastDate: '' }
      existing.total += Math.max(0, Math.floor(plan.plannedQuantity))
      if (plan.plannedDate > existing.lastDate) existing.lastDate = plan.plannedDate
      plannedByLineId.set(plan.orderLineId, existing)
    }

    for (const group of assemblyResult.groups) {
      let target = 0
      let covered = 0
      let lastPlannedDate = ''
      let hasSmtLine = false

      for (const groupLine of group.lines) {
        const smtLine = smtLineByLineId.get(groupLine.orderLineId)
        if (!smtLine) continue
        hasSmtLine = true

        const lineTarget = Math.max(0, Math.floor(smtLine.quantity))
        const produced = Math.max(0, resolveProductionCount(smtLine, smtCountsResult.counts))
        const planned = plannedByLineId.get(smtLine.orderLineId)

        target += lineTarget
        covered += Math.min(lineTarget, produced + (planned?.total ?? 0))
        if (planned?.lastDate && planned.lastDate > lastPlannedDate) {
          lastPlannedDate = planned.lastDate
        }
      }

      if (!hasSmtLine || target <= 0) continue

      const producedOnly = [...group.lines].reduce((sum, groupLine) => {
        const smtLine = smtLineByLineId.get(groupLine.orderLineId)
        if (!smtLine) return sum
        return sum + Math.max(0, resolveProductionCount(smtLine, smtCountsResult.counts))
      }, 0)

      const status: CandidateSmtStatus['status'] =
        producedOnly >= target
          ? 'done'
          : covered >= target
            ? 'planned'
            : covered > 0
              ? 'partial'
              : 'none'

      smtStatusByGroupId.set(group.id, {
        status,
        coveredQuantity: covered,
        targetQuantity: target,
        lastPlannedDate,
      })
    }
  }

  return {
    ok: true,
    data: {
      weekStart,
      weekDates,
      plans: buildPostProcessPlanBlocks(weekPlans, ordersResult.orders, assemblyLines),
      productionOrders: assemblyLines,
      counts: countsResult.counts,
      planCandidates: buildPostProcessPlanOrderCandidates(
        ordersResult.orders,
        assemblyLines,
        countsResult.counts,
        allPlansResult.plans,
        { onlyUnplanned: false },
      ).map((candidate) => ({
        ...candidate,
        smt: smtStatusByGroupId.get(candidate.assemblyGroupId) ?? null,
      })),
      planProgress: progressResult.progress,
    },
  }
}

export async function upsertPostProcessProductionPlan(
  input: UpsertPostProcessProductionPlanInput,
): Promise<UpsertPostProcessProductionPlanResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const orderId = String(input.orderId || '').trim()
  const assemblyGroupId = String(input.assemblyGroupId || '').trim()
  const plannedDate = String(input.plannedDate || '').trim()
  const team = normalizePostProcessTeam(input.team)
  const plannedQuantity = Math.floor(Number(input.plannedQuantity) || 0)

  const gate = await assertCanWrite({
    module: postProcessTeamToAccessModule(team),
    action: input.id ? 'update' : 'create',
  })
  if (!gate.ok) return gate

  if (!orderId) {
    return { ok: false, reason: 'validation', detail: '주문서를 선택하세요.' }
  }
  if (!assemblyGroupId) {
    return { ok: false, reason: 'validation', detail: '조립 그룹을 선택하세요.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
    return { ok: false, reason: 'validation', detail: '계획일 형식이 올바르지 않습니다.' }
  }
  if (plannedQuantity < 1) {
    return { ok: false, reason: 'validation', detail: '계획 수량은 1 이상이어야 합니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const payload = {
      order_id: orderId,
      assembly_group_id: assemblyGroupId,
      planned_date: plannedDate,
      team,
      planned_quantity: plannedQuantity,
      note: input.note?.trim() || '',
      updated_at: new Date().toISOString(),
    }

    if (input.id) {
      let { data, error } = await supabase
        .from('post_process_production_plans')
        .update(payload)
        .eq('id', input.id)
        .select(PLAN_SELECT)
        .single()

      if (error && isMissingCreatedByColumn(error.message)) {
        ;({ data, error } = await supabase
          .from('post_process_production_plans')
          .update(payload)
          .eq('id', input.id)
          .select(PLAN_SELECT_LEGACY)
          .single())
      }

      if (error || !data) {
        const schemaDetail = planSchemaErrorDetail(error?.message || '')
        if (schemaDetail) {
          return { ok: false, reason: 'query', detail: schemaDetail }
        }
        return { ok: false, reason: 'query', detail: error?.message || '생산계획 수정에 실패했습니다.' }
      }

      return { ok: true, plan: mapPlan(data) }
    }

    const snap = await resolveCreatedBySnapshot()
    let insertPayload: Record<string, unknown> = {
      ...payload,
      created_by: snap.createdBy,
      created_by_name: snap.createdByName,
    }

    let { data, error } = await supabase
      .from('post_process_production_plans')
      .upsert(insertPayload, { onConflict: 'assembly_group_id,planned_date,team' })
      .select(PLAN_SELECT)
      .single()

    if (error && isMissingCreatedByColumn(error.message)) {
      insertPayload = stripCreatedByFields(insertPayload)
      ;({ data, error } = await supabase
        .from('post_process_production_plans')
        .upsert(insertPayload, { onConflict: 'assembly_group_id,planned_date,team' })
        .select(PLAN_SELECT_LEGACY)
        .single())
    }

    if (error || !data) {
      const schemaDetail = planSchemaErrorDetail(error?.message || '')
      if (schemaDetail) {
        return { ok: false, reason: 'query', detail: schemaDetail }
      }
      return { ok: false, reason: 'query', detail: error?.message || '생산계획 저장에 실패했습니다.' }
    }

    return { ok: true, plan: mapPlan(data) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deletePostProcessProductionPlan(
  planId: string,
): Promise<DeletePostProcessProductionPlanResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const id = String(planId || '').trim()
  if (!id) {
    return { ok: false, reason: 'query', detail: '삭제할 계획을 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data: existing, error: fetchError } = await supabase
      .from('post_process_production_plans')
      .select('team')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      if (isMissingPostProcessPlanTable(fetchError.message)) {
        return {
          ok: false,
          reason: 'query',
          detail:
            'post_process_production_plans 테이블이 없습니다. setup-post-process-production-plans.sql 을 실행하세요.',
        }
      }
      return { ok: false, reason: 'query', detail: fetchError.message }
    }

    const gate = await assertCanWrite({
      module: postProcessTeamToAccessModule(existing?.team),
      action: 'delete',
    })
    if (!gate.ok) return gate

    const { error } = await supabase.from('post_process_production_plans').delete().eq('id', id)

    if (error) {
      if (isMissingPostProcessPlanTable(error.message)) {
        return {
          ok: false,
          reason: 'query',
          detail:
            'post_process_production_plans 테이블이 없습니다. setup-post-process-production-plans.sql 을 실행하세요.',
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
