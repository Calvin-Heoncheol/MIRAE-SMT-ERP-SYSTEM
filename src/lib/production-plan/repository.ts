import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { resolveCreatedBySnapshot } from '@/lib/auth/created-by'
import { fetchAssemblyGroups, repairChildrenOnlyAssemblyGroups, repairOrphanAssemblyGroups } from '@/lib/assembly/repository'
import { fetchDeliveryCumulativeCounts } from '@/lib/delivery/repository'
import { excludeDeliveryCompleteProductionOrders } from '@/lib/delivery/utils'
import { fetchOnHandByMaterialId } from '@/lib/materials/inventory/stock'
import { fetchPendingInboundByMaterialId } from '@/lib/materials/inventory/pending-inbound'
import { resolveMaterialInboundStatus } from '@/lib/materials/material-inbound-status'
import { fetchBomEdges } from '@/lib/materials/outbound/repository'
import type { BomEdge } from '@/lib/materials/outbound/types'
import { fetchOrders } from '@/lib/orders/repository'
import { fetchProducts } from '@/lib/products/repository'
import type { PostProcessProductionPlan } from '@/lib/post-process/plan/types'
import { upsertPostProcessProductionPlan, deletePostProcessProductionPlan, fetchAllPostProcessProductionPlans } from '@/lib/post-process/plan/repository'
import { buildPostProcessPlanOrderCandidates } from '@/lib/post-process/plan/utils'
import { normalizePostProcessTeam } from '@/lib/post-process/teams'
import { fetchPostProcessCumulativeCounts } from '@/lib/post-process/repository'
import {
  buildPostProcessAssemblyLines,
  buildProductionOrderLines,
  resolveProductionCount,
  resolveProductionSideCount,
} from '@/lib/production-input/utils'
import { fetchQuotes } from '@/lib/quotes/repository'
import type { SmtProductionPlan } from '@/lib/smt/plan/types'
import { upsertSmtProductionPlan, deleteSmtProductionPlan, fetchAllSmtProductionPlans } from '@/lib/smt/plan/repository'
import { buildSmtPlanOrderCandidates } from '@/lib/smt/plan/utils'
import { fetchSmtCumulativeCounts } from '@/lib/smt/repository'
import { createSupabaseClient } from '@/lib/supabase'
import type {
  ConfirmProductionPlanScheduleInput,
  FetchProductionPlanBoardResult,
  ProductionPlanBoardRow,
  ProductionPlanPcbSide,
  ProductionPlanScope,
} from './types'
import {
  computeDaysUntilDelivery,
  productionPlanRemainderRowKey,
  productionPlanRowKey,
  sortProductionPlanRows,
} from './utils'
import { getSmtPlannedEndDate } from './pipeline'

export type ConfirmProductionPlanResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'auth' | 'validation'; detail: string }

function missingEnv(): FetchProductionPlanBoardResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

export function isMissingProductionPlanBoardTable(detail: string) {
  const lower = detail.toLowerCase()
  return (
    lower.includes('production_plan_board_items') ||
    (lower.includes('schema cache') && lower.includes('production_plan_board'))
  )
}

function buildEdgesByParent(edges: BomEdge[]) {
  const edgesByParent = new Map<string, BomEdge[]>()
  for (const edge of edges) {
    const list = edgesByParent.get(edge.parentProductId) || []
    list.push(edge)
    edgesByParent.set(edge.parentProductId, list)
  }
  return edgesByParent
}

function materialHint(
  productId: string,
  remainingQty: number,
  edgesByParent: Map<string, BomEdge[]>,
  onHandByMaterialId: Map<string, number>,
  pendingInboundByMaterialId: Map<string, number>,
  latestDeliveryDateByMaterialId: Map<string, string>,
) {
  const id = productId.trim()
  if (!id || remainingQty <= 0) {
    return {
      materialReadyQty: 0,
      materialScheduledQty: 0,
      materialExpectedReadyDate: '',
      materialShort: false,
      materialUnknown: true,
      materialInboundStatus: 'no_bom' as const,
    }
  }

  const inbound = resolveMaterialInboundStatus(
    id,
    remainingQty,
    edgesByParent,
    onHandByMaterialId,
    pendingInboundByMaterialId,
    latestDeliveryDateByMaterialId,
  )

  return {
    materialReadyQty: inbound.readyUnits,
    materialScheduledQty: inbound.scheduledUnits,
    materialExpectedReadyDate: inbound.expectedReadyDate || '',
    materialShort:
      inbound.status === 'missing' ||
      (inbound.status === 'ready' && inbound.readyUnits < remainingQty),
    materialUnknown: inbound.status === 'no_bom',
    materialInboundStatus: inbound.status,
  }
}

type BoardConfirmRow = {
  id: string
  scope: string
  order_id: string
  order_line_id: string | null
  assembly_group_id: string | null
  confirmed_at: string
  confirmed_by_name: string
  planned_date?: string | null
  line_no?: number | null
  team?: string | null
  pcb_side?: string | null
  planned_quantity?: number | null
}

function normalizeBoardPcbSide(value: string | null | undefined): ProductionPlanPcbSide {
  const raw = String(value || 'SINGLE').toUpperCase()
  if (raw === 'TOP' || raw === 'BOT' || raw === 'BOTH') return raw
  return 'SINGLE'
}

function scheduleFromConfirm(confirm: BoardConfirmRow | undefined) {
  return {
    plannedDate: String(confirm?.planned_date || '').slice(0, 10),
    lineNo:
      confirm?.line_no == null || Number.isNaN(Number(confirm.line_no))
        ? null
        : Math.floor(Number(confirm.line_no)),
    team: String(confirm?.team || '').trim(),
    pcbSide: normalizeBoardPcbSide(confirm?.pcb_side),
    plannedQuantity:
      confirm?.planned_quantity == null || Number.isNaN(Number(confirm.planned_quantity))
        ? null
        : Math.floor(Number(confirm.planned_quantity)),
  }
}

function sumPlannedQuantities(entries: Array<{ plannedQuantity: number | null }>) {
  return entries.reduce((sum, entry) => sum + Math.max(0, entry.plannedQuantity ?? 0), 0)
}

function appendRemainderRow(
  rows: ProductionPlanBoardRow[],
  base: Omit<
    ProductionPlanBoardRow,
    'key' | 'status' | 'rowKind' | 'plannedDate' | 'lineNo' | 'team' | 'pcbSide' | 'plannedQuantity' | 'planId' | 'boardItemId' | 'confirmedAt' | 'confirmedByName'
  >,
  unplannedQty: number,
) {
  if (unplannedQty <= 0) return
  rows.push({
    ...base,
    key: productionPlanRemainderRowKey(base.scope, base.targetId),
    status: 'waiting',
    rowKind: 'remainder',
    confirmedAt: '',
    confirmedByName: '',
    plannedDate: '',
    lineNo: null,
    team: '',
    pcbSide: base.splitPcbSides ? 'TOP' : 'SINGLE',
    plannedQuantity: null,
    unplannedQty,
    planId: undefined,
    boardItemId: undefined,
  })
}

async function fetchConfirmRows(): Promise<
  | { ok: true; rows: BoardConfirmRow[] }
  | { ok: false; reason: 'query'; detail: string }
> {
  const supabase = createSupabaseClient()
  const fullSelect =
    'id, scope, order_id, order_line_id, assembly_group_id, confirmed_at, confirmed_by_name, planned_date, line_no, team, pcb_side, planned_quantity'
  const legacySelect =
    'id, scope, order_id, order_line_id, assembly_group_id, confirmed_at, confirmed_by_name'

  let data: BoardConfirmRow[] | null = null
  let error: { message: string } | null = null

  {
    const full = await supabase
      .from('production_plan_board_items')
      .select(fullSelect)
      .eq('status', 'confirmed')
    error = full.error
    data = (full.data || null) as BoardConfirmRow[] | null
  }

  if (
    error &&
    (error.message.includes('planned_date') ||
      error.message.includes('line_no') ||
      error.message.includes('pcb_side') ||
      error.message.includes('planned_quantity') ||
      error.message.includes('team'))
  ) {
    const legacy = await supabase
      .from('production_plan_board_items')
      .select(legacySelect)
      .eq('status', 'confirmed')
    error = legacy.error
    data = (legacy.data || null) as BoardConfirmRow[] | null
  }

  if (error) {
    if (isMissingProductionPlanBoardTable(error.message)) {
      return {
        ok: false,
        reason: 'query',
        detail:
          'production_plan_board_items 테이블이 없습니다. Supabase에서 migrate-production-plan-board.sql 을 실행하세요.',
      }
    }
    return { ok: false, reason: 'query', detail: error.message }
  }

  return { ok: true, rows: data || [] }
}

export async function fetchProductionPlanBoard(): Promise<FetchProductionPlanBoardResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnv()
  }

  let productsResult: Awaited<ReturnType<typeof fetchProducts>>
  let ordersResult: Awaited<ReturnType<typeof fetchOrders>>
  let confirmResult: Awaited<ReturnType<typeof fetchConfirmRows>>
  let onHandResult: Awaited<ReturnType<typeof fetchOnHandByMaterialId>>
  let pendingResult: Awaited<ReturnType<typeof fetchPendingInboundByMaterialId>>
  let quotesResult: Awaited<ReturnType<typeof fetchQuotes>>
  let bomEdges: BomEdge[]
  let smtPlansResult: Awaited<ReturnType<typeof fetchAllSmtProductionPlans>>
  let postPlansResult: Awaited<ReturnType<typeof fetchAllPostProcessProductionPlans>>

  try {
    ;[
      productsResult,
      ordersResult,
      confirmResult,
      onHandResult,
      pendingResult,
      quotesResult,
      bomEdges,
      smtPlansResult,
      postPlansResult,
    ] = await Promise.all([
      fetchProducts(false),
      fetchOrders({ includeDerivedLines: true }),
      fetchConfirmRows(),
      fetchOnHandByMaterialId(),
      fetchPendingInboundByMaterialId(),
      fetchQuotes(),
      fetchBomEdges(),
      fetchAllSmtProductionPlans(),
      fetchAllPostProcessProductionPlans(),
    ])
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : 'BOM 조회에 실패했습니다.',
    }
  }

  if (!productsResult.ok) return productsResult
  if (!ordersResult.ok) return ordersResult
  if (!confirmResult.ok) return confirmResult
  if (!quotesResult.ok) return quotesResult
  if (!smtPlansResult.ok) return smtPlansResult
  if (!postPlansResult.ok) return postPlansResult
  if (!onHandResult.ok) {
    return { ok: false, reason: 'query', detail: onHandResult.detail }
  }

  const productById = Object.fromEntries(productsResult.products.map((p) => [p.id, p]))
  const edgesByParent = buildEdgesByParent(bomEdges)
  const onHand = onHandResult.onHandByMaterialId
  const pendingByMaterialId = pendingResult.ok
    ? pendingResult.pendingByMaterialId
    : new Map<string, number>()
  const latestDeliveryDateByMaterialId = pendingResult.ok
    ? pendingResult.latestDeliveryDateByMaterialId
    : new Map<string, string>()

  const confirmedMaterialByLine = new Map<string, BoardConfirmRow[]>()
  const confirmedSmtBoardByLine = new Map<string, BoardConfirmRow>()
  const confirmedPostBoardByGroup = new Map<string, BoardConfirmRow>()
  for (const row of confirmResult.rows) {
    if (row.scope === 'material' && row.order_line_id) {
      const list = confirmedMaterialByLine.get(row.order_line_id) ?? []
      list.push(row)
      confirmedMaterialByLine.set(row.order_line_id, list)
    }
    if (row.scope === 'smt' && row.order_line_id) {
      confirmedSmtBoardByLine.set(row.order_line_id, row)
    }
    if (row.scope === 'post' && row.assembly_group_id) {
      confirmedPostBoardByGroup.set(row.assembly_group_id, row)
    }
  }

  const smtPlansByLine = new Map<string, SmtProductionPlan[]>()
  for (const plan of smtPlansResult.plans) {
    const list = smtPlansByLine.get(plan.orderLineId) ?? []
    list.push(plan)
    smtPlansByLine.set(plan.orderLineId, list)
  }

  const postPlansByGroup = new Map<string, PostProcessProductionPlan[]>()
  for (const plan of postPlansResult.plans) {
    const list = postPlansByGroup.get(plan.assemblyGroupId) ?? []
    list.push(plan)
    postPlansByGroup.set(plan.assemblyGroupId, list)
  }

  const [smtCountsResult, assemblyFetch, deliveryCountsResult, postCountsResult] =
    await Promise.all([
      fetchSmtCumulativeCounts(),
      fetchAssemblyGroups(productById),
      fetchDeliveryCumulativeCounts(),
      fetchPostProcessCumulativeCounts(),
    ])

  if (!smtCountsResult.ok) return smtCountsResult
  if (!assemblyFetch.ok) return assemblyFetch
  if (!deliveryCountsResult.ok) return deliveryCountsResult
  if (!postCountsResult.ok) return postCountsResult

  let assemblyResult = await repairChildrenOnlyAssemblyGroups(
    assemblyFetch.groups,
    ordersResult.orders,
    productById,
  )
  if (!assemblyResult.ok) return assemblyResult

  assemblyResult = await repairOrphanAssemblyGroups(assemblyResult.groups, productById)
  if (!assemblyResult.ok) return assemblyResult

  const smtOrders = excludeDeliveryCompleteProductionOrders(
    buildProductionOrderLines(
      ordersResult.orders,
      '반제품',
      productById,
      'smt',
      quotesResult.quotes,
    ),
    assemblyResult.groups,
    deliveryCountsResult.counts,
  )

  const postOrders = excludeDeliveryCompleteProductionOrders(
    buildPostProcessAssemblyLines(
      assemblyResult.groups,
      ordersResult.orders,
      productById,
      quotesResult.quotes,
    ),
    assemblyResult.groups,
    deliveryCountsResult.counts,
  )

  const productIdByOrderLine = new Map<string, string>()
  for (const order of ordersResult.orders) {
    for (const item of order.items || []) {
      const lineId = String(item.lineId || '').trim()
      if (!lineId) continue
      const productId = String(item.productId || '').trim()
      if (productId) productIdByOrderLine.set(lineId, productId)
    }
  }

  const smtPlanMetricsByLine = new Map(
    buildSmtPlanOrderCandidates(
      ordersResult.orders,
      smtOrders,
      smtCountsResult.counts,
      smtPlansResult.plans,
      { onlyUnplanned: false },
    ).map((candidate) => [candidate.orderLineId, candidate]),
  )

  const postPlanMetricsByGroup = new Map(
    buildPostProcessPlanOrderCandidates(
      ordersResult.orders,
      postOrders,
      postCountsResult.counts,
      postPlansResult.plans,
      { onlyUnplanned: false },
    ).map((candidate) => [candidate.assemblyGroupId, candidate]),
  )

  const rows: ProductionPlanBoardRow[] = []

  for (const line of smtOrders) {
    const productId =
      productIdByOrderLine.get(line.orderLineId) ||
      String(line.productCode || '').trim()
    let producedQty = 0
    if (line.splitPcbSides) {
      const top = resolveProductionSideCount(line, smtCountsResult.counts, 'TOP')
      const bot = resolveProductionSideCount(line, smtCountsResult.counts, 'BOT')
      producedQty = Math.min(top, bot)
    } else {
      producedQty = resolveProductionSideCount(line, smtCountsResult.counts, 'SINGLE')
    }
    const remainingQty = Math.max(0, Math.floor(line.quantity) - producedQty)
    if (remainingQty <= 0) continue

    const hint = materialHint(
      productId,
      remainingQty,
      edgesByParent,
      onHand,
      pendingByMaterialId,
      latestDeliveryDateByMaterialId,
    )
    const daysUntilDelivery = computeDaysUntilDelivery(line.deliveryDate)

    const shared = {
      orderId: line.orderId,
      orderNumber: line.orderNumber,
      customer: line.customer,
      deliveryDate: line.deliveryDate,
      daysUntilDelivery,
      productId,
      productName: line.productName,
      productCode: line.productCode,
      productKindLabel: line.productKindLabel,
      targetId: line.orderLineId,
      splitPcbSides: line.splitPcbSides,
      orderQty: Math.floor(line.quantity),
      producedQty,
      remainingQty,
      ...hint,
    }

    const materialConfirms = confirmedMaterialByLine.get(line.orderLineId) ?? []
    const materialSchedules = materialConfirms.map((confirm) => ({
      ...scheduleFromConfirm(confirm),
      boardItemId: confirm.id,
    }))
    const materialPlannedTotal = sumPlannedQuantities(materialSchedules)
    const materialUnplanned = Math.max(0, remainingQty - materialPlannedTotal)

    if (!materialSchedules.length) {
      rows.push({
        key: productionPlanRowKey('material', line.orderLineId),
        scope: 'material',
        ...shared,
        status: 'waiting',
        rowKind: 'remainder',
        confirmedAt: '',
        confirmedByName: '',
        plannedDate: '',
        lineNo: null,
        team: '',
        pcbSide: 'SINGLE',
        plannedQuantity: null,
        plannedTotalQty: 0,
        unplannedQty: remainingQty,
      })
    } else {
      for (const schedule of materialSchedules) {
        rows.push({
          key: `${productionPlanRowKey('material', line.orderLineId)}:${schedule.boardItemId}`,
          scope: 'material',
          ...shared,
          status: 'confirmed',
          rowKind: 'schedule',
          confirmedAt: materialConfirms.find((entry) => entry.id === schedule.boardItemId)?.confirmed_at || '',
          confirmedByName:
            materialConfirms.find((entry) => entry.id === schedule.boardItemId)?.confirmed_by_name || '',
          plannedDate: schedule.plannedDate,
          lineNo: schedule.lineNo,
          team: schedule.team,
          pcbSide: schedule.pcbSide,
          plannedQuantity: schedule.plannedQuantity,
          plannedTotalQty: materialPlannedTotal,
          unplannedQty: materialUnplanned,
          boardItemId: schedule.boardItemId,
        })
      }
      appendRemainderRow(
        rows,
        { scope: 'material', ...shared },
        materialUnplanned,
      )
    }

    const smtMetrics = smtPlanMetricsByLine.get(line.orderLineId)
    const smtPlans = smtPlansByLine.get(line.orderLineId) ?? []
    const smtBoardConfirm = confirmedSmtBoardByLine.get(line.orderLineId)
    const smtPlannedTotal = smtMetrics?.plannedTotal ?? 0
    let smtUnplanned = smtMetrics?.unplannedRemaining ?? remainingQty

    if (!smtPlans.length && smtBoardConfirm) {
      const legacySchedule = scheduleFromConfirm(smtBoardConfirm)
      smtUnplanned = Math.max(0, remainingQty - (legacySchedule.plannedQuantity ?? 0))
    }

    if (!smtPlans.length && smtBoardConfirm) {
      const schedule = scheduleFromConfirm(smtBoardConfirm)
      rows.push({
        key: `${productionPlanRowKey('smt', line.orderLineId)}:${smtBoardConfirm.id}`,
        scope: 'smt',
        ...shared,
        status: 'confirmed',
        rowKind: 'schedule',
        confirmedAt: smtBoardConfirm.confirmed_at || '',
        confirmedByName: smtBoardConfirm.confirmed_by_name || '',
        ...schedule,
        plannedTotalQty: schedule.plannedQuantity ?? 0,
        unplannedQty: smtUnplanned,
        boardItemId: smtBoardConfirm.id,
      })
      appendRemainderRow(rows, { scope: 'smt', ...shared }, smtUnplanned)
    } else if (!smtPlans.length) {
      rows.push({
        key: productionPlanRowKey('smt', line.orderLineId),
        scope: 'smt',
        ...shared,
        status: 'waiting',
        rowKind: 'remainder',
        confirmedAt: '',
        confirmedByName: '',
        plannedDate: '',
        lineNo: null,
        team: '',
        pcbSide: line.splitPcbSides ? 'TOP' : 'SINGLE',
        plannedQuantity: null,
        plannedTotalQty: 0,
        unplannedQty: smtUnplanned,
      })
    } else {
      for (const plan of smtPlans) {
        rows.push({
          key: `${productionPlanRowKey('smt', line.orderLineId)}:${plan.id}`,
          scope: 'smt',
          ...shared,
          status: 'confirmed',
          rowKind: 'schedule',
          confirmedAt: plan.createdAt,
          confirmedByName: plan.createdByName,
          plannedDate: plan.plannedDate,
          lineNo: plan.lineNo,
          team: '',
          pcbSide: plan.pcbSide,
          plannedQuantity: plan.plannedQuantity,
          plannedTotalQty: smtPlannedTotal,
          unplannedQty: smtUnplanned,
          planId: plan.id,
        })
      }
      appendRemainderRow(rows, { scope: 'smt', ...shared }, smtUnplanned)
    }
  }

  for (const line of postOrders) {
    const groupId = line.assemblyGroupId || line.orderLineId
    const productId = String(
      assemblyResult.groups.find((g) => g.id === groupId)?.parentProductId ||
        line.productCode ||
        '',
    ).trim()
    const producedQty = resolveProductionCount(line, postCountsResult.counts)
    const remainingQty = Math.max(0, Math.floor(line.quantity) - producedQty)
    if (remainingQty <= 0) continue

    const confirm = confirmedPostBoardByGroup.get(groupId)
    const hint = materialHint(
      productId,
      remainingQty,
      edgesByParent,
      onHand,
      pendingByMaterialId,
      latestDeliveryDateByMaterialId,
    )
    const daysUntilDelivery = computeDaysUntilDelivery(line.deliveryDate)

    const shared = {
      orderId: line.orderId,
      orderNumber: line.orderNumber,
      customer: line.customer,
      deliveryDate: line.deliveryDate,
      daysUntilDelivery,
      productId,
      productName: line.productName,
      productCode: line.productCode,
      productKindLabel: line.productKindLabel,
      targetId: groupId,
      splitPcbSides: false,
      orderQty: Math.floor(line.quantity),
      producedQty,
      remainingQty,
      ...hint,
    }

    const postMetrics = postPlanMetricsByGroup.get(groupId)
    const postPlans = postPlansByGroup.get(groupId) ?? []
    const postPlannedTotal = postMetrics?.plannedTotal ?? 0
    let postUnplanned = postMetrics?.unplannedRemaining ?? remainingQty

    if (!postPlans.length && confirm) {
      const legacySchedule = scheduleFromConfirm(confirm)
      postUnplanned = Math.max(0, remainingQty - (legacySchedule.plannedQuantity ?? 0))
    }

    if (!postPlans.length && confirm) {
      const schedule = scheduleFromConfirm(confirm)
      rows.push({
        key: `${productionPlanRowKey('post', groupId)}:${confirm.id}`,
        scope: 'post',
        ...shared,
        status: 'confirmed',
        rowKind: 'schedule',
        confirmedAt: confirm.confirmed_at || '',
        confirmedByName: confirm.confirmed_by_name || '',
        ...schedule,
        plannedTotalQty: schedule.plannedQuantity ?? 0,
        unplannedQty: postUnplanned,
        boardItemId: confirm.id,
      })
      appendRemainderRow(rows, { scope: 'post', ...shared }, postUnplanned)
    } else if (!postPlans.length) {
      rows.push({
        key: productionPlanRowKey('post', groupId),
        scope: 'post',
        ...shared,
        status: 'waiting',
        rowKind: 'remainder',
        confirmedAt: '',
        confirmedByName: '',
        plannedDate: '',
        lineNo: null,
        team: '',
        pcbSide: 'SINGLE',
        plannedQuantity: null,
        plannedTotalQty: 0,
        unplannedQty: postUnplanned,
      })
    } else {
      for (const plan of postPlans) {
        rows.push({
          key: `${productionPlanRowKey('post', groupId)}:${plan.id}`,
          scope: 'post',
          ...shared,
          status: 'confirmed',
          rowKind: 'schedule',
          confirmedAt: plan.createdAt,
          confirmedByName: plan.createdByName,
          plannedDate: plan.plannedDate,
          lineNo: null,
          team: plan.team,
          pcbSide: 'SINGLE',
          plannedQuantity: plan.plannedQuantity,
          plannedTotalQty: postPlannedTotal,
          unplannedQty: postUnplanned,
          planId: plan.id,
        })
      }
      appendRemainderRow(rows, { scope: 'post', ...shared }, postUnplanned)
    }
  }

  for (const row of rows) {
    if (row.scope !== 'post') continue
    const smtEnd = getSmtPlannedEndDate(row.orderId, rows)
    if (smtEnd) row.smtPlannedEndDate = smtEnd
  }

  return {
    ok: true,
    data: { rows: sortProductionPlanRows(rows) },
  }
}

export async function confirmProductionPlanItem(
  input: ConfirmProductionPlanScheduleInput,
): Promise<ConfirmProductionPlanResult> {
  const gate = await assertCanWrite({ module: 'production_plan', action: 'create' })
  if (!gate.ok) return gate

  const scope = input.scope
  const orderId = input.orderId.trim()
  const targetId = input.targetId.trim()
  const plannedDate = String(input.plannedDate || '').trim().slice(0, 10)
  const plannedQuantity = Math.floor(Number(input.plannedQuantity) || 0)
  const note = input.note?.trim() || ''

  if (!orderId || !targetId) {
    return { ok: false, reason: 'validation', detail: '발주서·대상이 올바르지 않습니다.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
    return { ok: false, reason: 'validation', detail: '계획일을 선택하세요.' }
  }
  if (plannedQuantity < 1) {
    return { ok: false, reason: 'validation', detail: '계획 수량은 1 이상이어야 합니다.' }
  }

  if (scope === 'smt') {
    const lineNo = Math.floor(Number(input.lineNo) || 0)
    const pcbSide = normalizeBoardPcbSide(input.pcbSide)
    if (lineNo < 1 || lineNo > 7) {
      return { ok: false, reason: 'validation', detail: 'SMT 라인을 선택하세요 (1~7).' }
    }

    const sides =
      pcbSide === 'BOTH' ? (['TOP', 'BOT'] as const) : ([pcbSide === 'TOP' || pcbSide === 'BOT' ? pcbSide : 'SINGLE'] as const)

    for (const side of sides) {
      const planResult = await upsertSmtProductionPlan({
        id: side === sides[0] ? input.planId : undefined,
        orderId,
        orderLineId: targetId,
        plannedDate,
        lineNo,
        pcbSide: side,
        plannedQuantity,
        note,
      })
      if (!planResult.ok) {
        return {
          ok: false,
          reason: planResult.reason === 'auth' ? 'auth' : planResult.reason === 'validation' ? 'validation' : 'query',
          detail: planResult.detail,
        }
      }
    }

    return saveBoardConfirmation({
      scope: 'smt',
      orderId,
      targetId,
      plannedDate,
      plannedQuantity,
      lineNo,
      team: '',
      pcbSide: pcbSide === 'BOTH' || sides.length > 1 ? 'BOTH' : sides[0]!,
      note,
      boardItemId: input.boardItemId,
      createBoardIfMissing: !input.planId && !input.boardItemId,
    })
  }

  if (scope === 'material') {
    return saveBoardConfirmation({
      scope: 'material',
      orderId,
      targetId,
      plannedDate,
      plannedQuantity,
      lineNo: null,
      team: '',
      pcbSide: 'SINGLE',
      note,
      boardItemId: input.boardItemId,
      createBoardIfMissing: true,
    })
  }

  const team = normalizePostProcessTeam(input.team)
  const planResult = await upsertPostProcessProductionPlan({
    id: input.planId,
    orderId,
    assemblyGroupId: targetId,
    plannedDate,
    team,
    plannedQuantity,
    note,
  })
  if (!planResult.ok) {
    return {
      ok: false,
      reason: planResult.reason === 'auth' ? 'auth' : planResult.reason === 'validation' ? 'validation' : 'query',
      detail: planResult.detail,
    }
  }

  return saveBoardConfirmation({
    scope: 'post',
    orderId,
    targetId,
    plannedDate,
    plannedQuantity,
    lineNo: null,
    team,
    pcbSide: 'SINGLE',
    note,
    boardItemId: input.boardItemId,
    createBoardIfMissing: !input.planId && !input.boardItemId,
  })
}

async function saveBoardConfirmation(input: {
  scope: ProductionPlanScope
  orderId: string
  targetId: string
  plannedDate: string
  plannedQuantity: number
  lineNo: number | null
  team: string
  pcbSide: ProductionPlanPcbSide
  note: string
  boardItemId?: string
  createBoardIfMissing?: boolean
}): Promise<ConfirmProductionPlanResult> {
  const createdBy = await resolveCreatedBySnapshot()
  const supabase = createSupabaseClient()
  const scope = input.scope

  const schedulePayload: Record<string, unknown> = {
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
    confirmed_by: createdBy.createdBy,
    confirmed_by_name: createdBy.createdByName,
    planned_date: input.plannedDate,
    line_no: input.lineNo,
    team: input.team || null,
    pcb_side: input.pcbSide,
    planned_quantity: input.plannedQuantity,
    note: input.note,
  }

  if (input.boardItemId) {
    let { error } = await supabase
      .from('production_plan_board_items')
      .update(schedulePayload)
      .eq('id', input.boardItemId)

    if (
      error &&
      (error.message.includes('planned_date') ||
        error.message.includes('line_no') ||
        error.message.includes('pcb_side'))
    ) {
      return {
        ok: false,
        reason: 'query',
        detail:
          '배정 컬럼이 없습니다. Supabase에서 migrate-production-plan-board-schedule.sql 을 실행하세요.',
      }
    }
    if (error) return { ok: false, reason: 'query', detail: error.message }
    return { ok: true }
  }

  if (scope === 'material') {
    const insertRow = {
      scope: 'material' as const,
      order_id: input.orderId,
      order_line_id: input.targetId,
      assembly_group_id: null,
      ...schedulePayload,
    }
    const { error } = await supabase.from('production_plan_board_items').insert(insertRow)
    if (error) {
      if (isMissingProductionPlanBoardTable(error.message)) {
        return {
          ok: false,
          reason: 'query',
          detail:
            'production_plan_board_items 테이블이 없습니다. Supabase에서 migrate-production-plan-board.sql 을 실행하세요.',
        }
      }
      if (
        error.message.includes('scope') ||
        error.message.toLowerCase().includes('check') ||
        error.message.includes('production_plan_board_scope_ref') ||
        error.code === '23505'
      ) {
        return {
          ok: false,
          reason: 'query',
          detail:
            '자재 분할 배정을 위해 Supabase에서 migrate-production-plan-board-material-split.sql 을 실행하세요.',
        }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }
    return { ok: true }
  }

  if (!input.createBoardIfMissing) {
    return { ok: true }
  }

  const existingQuery =
    scope === 'post'
      ? supabase
          .from('production_plan_board_items')
          .select('id')
          .eq('scope', 'post')
          .eq('assembly_group_id', input.targetId)
          .maybeSingle()
      : supabase
          .from('production_plan_board_items')
          .select('id')
          .eq('scope', scope)
          .eq('order_line_id', input.targetId)
          .maybeSingle()

  const existing = await existingQuery
  if (existing.error) {
    if (isMissingProductionPlanBoardTable(existing.error.message)) {
      return {
        ok: false,
        reason: 'query',
        detail:
          'production_plan_board_items 테이블이 없습니다. Supabase에서 migrate-production-plan-board.sql 을 실행하세요.',
      }
    }
    return { ok: false, reason: 'query', detail: existing.error.message }
  }

  if (existing.data?.id) {
    return { ok: true }
  }

  const insertRow: Record<string, unknown> =
    scope === 'post'
      ? {
          scope: 'post',
          order_id: input.orderId,
          order_line_id: null,
          assembly_group_id: input.targetId,
          ...schedulePayload,
        }
      : {
          scope,
          order_id: input.orderId,
          order_line_id: input.targetId,
          assembly_group_id: null,
          ...schedulePayload,
        }

  const { error } = await supabase.from('production_plan_board_items').insert(insertRow)
  if (error) {
    if (isMissingProductionPlanBoardTable(error.message)) {
      return {
        ok: false,
        reason: 'query',
        detail:
          'production_plan_board_items 테이블이 없습니다. Supabase에서 migrate-production-plan-board.sql 을 실행하세요.',
      }
    }
    if (error.code === '23505' || error.message.toLowerCase().includes('duplicate')) {
      return { ok: true }
    }
    return { ok: false, reason: 'query', detail: error.message }
  }

  return { ok: true }
}

async function cleanupOrphanBoardRow(
  scope: ProductionPlanScope,
  targetId: string,
): Promise<void> {
  const supabase = createSupabaseClient()

  if (scope === 'smt') {
    const { count } = await supabase
      .from('smt_production_plans')
      .select('id', { count: 'exact', head: true })
      .eq('order_line_id', targetId)
    if ((count ?? 0) === 0) {
      await supabase
        .from('production_plan_board_items')
        .delete()
        .eq('scope', 'smt')
        .eq('order_line_id', targetId)
    }
    return
  }

  if (scope === 'post') {
    const { count } = await supabase
      .from('post_process_production_plans')
      .select('id', { count: 'exact', head: true })
      .eq('assembly_group_id', targetId)
    if ((count ?? 0) === 0) {
      await supabase
        .from('production_plan_board_items')
        .delete()
        .eq('scope', 'post')
        .eq('assembly_group_id', targetId)
    }
  }
}

export async function unconfirmProductionPlanItem(input: {
  scope: ProductionPlanScope
  targetId: string
  planId?: string
  boardItemId?: string
}): Promise<ConfirmProductionPlanResult> {
  const gate = await assertCanWrite({ module: 'production_plan', action: 'update' })
  if (!gate.ok) return gate

  const targetId = input.targetId.trim()
  if (!targetId) {
    return { ok: false, reason: 'validation', detail: '대상이 올바르지 않습니다.' }
  }

  const supabase = createSupabaseClient()

  if (input.planId) {
    if (input.scope === 'smt') {
      const result = await deleteSmtProductionPlan(input.planId)
      if (!result.ok) {
        return {
          ok: false,
          reason: result.reason === 'auth' ? 'auth' : 'query',
          detail: result.detail,
        }
      }
    } else if (input.scope === 'post') {
      const result = await deletePostProcessProductionPlan(input.planId)
      if (!result.ok) {
        return {
          ok: false,
          reason: result.reason === 'auth' ? 'auth' : 'query',
          detail: result.detail,
        }
      }
    }

    if (input.boardItemId) {
      await supabase.from('production_plan_board_items').delete().eq('id', input.boardItemId)
    }

    await cleanupOrphanBoardRow(input.scope, targetId)
    return { ok: true }
  }

  if (input.boardItemId) {
    const { error } = await supabase
      .from('production_plan_board_items')
      .delete()
      .eq('id', input.boardItemId)
    if (error) {
      if (isMissingProductionPlanBoardTable(error.message)) {
        return {
          ok: false,
          reason: 'query',
          detail:
            'production_plan_board_items 테이블이 없습니다. Supabase에서 migrate-production-plan-board.sql 을 실행하세요.',
        }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }
    return { ok: true }
  }

  // 레거시: planId·boardItemId 없이 targetId만으로 삭제
  const boardSelect =
    input.scope === 'post'
      ? await supabase
          .from('production_plan_board_items')
          .select('planned_date, team')
          .eq('scope', 'post')
          .eq('assembly_group_id', targetId)
          .maybeSingle()
      : await supabase
          .from('production_plan_board_items')
          .select('planned_date, line_no, pcb_side')
          .eq('scope', input.scope)
          .eq('order_line_id', targetId)
          .maybeSingle()

  if (boardSelect.error && !isMissingProductionPlanBoardTable(boardSelect.error.message)) {
    // schedule columns missing — still delete board row
  } else if (boardSelect.data) {
    const plannedDate = String(boardSelect.data.planned_date || '').slice(0, 10)
    if (input.scope === 'smt' && plannedDate) {
      const lineNo = Math.floor(Number((boardSelect.data as { line_no?: number }).line_no) || 0)
      let del = supabase
        .from('smt_production_plans')
        .delete()
        .eq('order_line_id', targetId)
        .eq('planned_date', plannedDate)
      if (lineNo >= 1) del = del.eq('line_no', lineNo)
      await del
    }
    if (input.scope === 'post' && plannedDate) {
      const team = normalizePostProcessTeam((boardSelect.data as { team?: string }).team)
      await supabase
        .from('post_process_production_plans')
        .delete()
        .eq('assembly_group_id', targetId)
        .eq('planned_date', plannedDate)
        .eq('team', team)
    }
  }

  const query =
    input.scope === 'post'
      ? supabase
          .from('production_plan_board_items')
          .delete()
          .eq('scope', 'post')
          .eq('assembly_group_id', targetId)
      : supabase
          .from('production_plan_board_items')
          .delete()
          .eq('scope', input.scope)
          .eq('order_line_id', targetId)

  const { error } = await query
  if (error) {
    if (isMissingProductionPlanBoardTable(error.message)) {
      return {
        ok: false,
        reason: 'query',
        detail:
          'production_plan_board_items 테이블이 없습니다. Supabase에서 migrate-production-plan-board.sql 을 실행하세요.',
      }
    }
    return { ok: false, reason: 'query', detail: error.message }
  }

  return { ok: true }
}
