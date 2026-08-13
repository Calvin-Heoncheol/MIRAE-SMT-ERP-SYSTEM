import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { resolveCreatedBySnapshot } from '@/lib/auth/created-by'
import { fetchAssemblyGroups, repairChildrenOnlyAssemblyGroups, repairOrphanAssemblyGroups } from '@/lib/assembly/repository'
import { fetchDeliveryCumulativeCounts } from '@/lib/delivery/repository'
import { excludeDeliveryCompleteProductionOrders } from '@/lib/delivery/utils'
import { fetchOnHandByMaterialId } from '@/lib/materials/inventory/stock'
import { fetchBomEdges } from '@/lib/materials/outbound/repository'
import { computeIssuableProductQuantity } from '@/lib/materials/outbound/utils'
import type { BomEdge } from '@/lib/materials/outbound/types'
import { fetchOrders } from '@/lib/orders/repository'
import { fetchProducts } from '@/lib/products/repository'
import { upsertPostProcessProductionPlan } from '@/lib/post-process/plan/repository'
import { normalizePostProcessTeam } from '@/lib/post-process/teams'
import { fetchPostProcessCumulativeCounts } from '@/lib/post-process/repository'
import {
  buildPostProcessAssemblyLines,
  buildProductionOrderLines,
  resolveProductionCount,
  resolveProductionSideCount,
} from '@/lib/production-input/utils'
import { fetchQuotes } from '@/lib/quotes/repository'
import { upsertSmtProductionPlan } from '@/lib/smt/plan/repository'
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
  productionPlanRowKey,
  sortProductionPlanRows,
} from './utils'

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
) {
  const id = productId.trim()
  if (!id || remainingQty <= 0) {
    return { materialReadyQty: 0, materialShort: false, materialUnknown: true }
  }
  const hasBom = (edgesByParent.get(id)?.length ?? 0) > 0
  if (!hasBom) {
    return { materialReadyQty: 0, materialShort: false, materialUnknown: true }
  }
  const materialReadyQty = computeIssuableProductQuantity(
    id,
    remainingQty,
    edgesByParent,
    onHandByMaterialId,
  )
  return {
    materialReadyQty,
    materialShort: materialReadyQty < remainingQty,
    materialUnknown: false,
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

  const [productsResult, ordersResult, confirmResult, onHandResult, quotesResult] = await Promise.all([
    fetchProducts(false),
    fetchOrders({ includeDerivedLines: true }),
    fetchConfirmRows(),
    fetchOnHandByMaterialId(),
    fetchQuotes(),
  ])

  if (!productsResult.ok) return productsResult
  if (!ordersResult.ok) return ordersResult
  if (!confirmResult.ok) return confirmResult
  if (!quotesResult.ok) return quotesResult
  if (!onHandResult.ok) {
    return { ok: false, reason: 'query', detail: onHandResult.detail }
  }

  let bomEdges: BomEdge[] = []
  try {
    bomEdges = await fetchBomEdges()
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : 'BOM 조회에 실패했습니다.',
    }
  }

  const productById = Object.fromEntries(productsResult.products.map((p) => [p.id, p]))
  const edgesByParent = buildEdgesByParent(bomEdges)
  const onHand = onHandResult.onHandByMaterialId

  const confirmedSmt = new Map<string, BoardConfirmRow>()
  const confirmedPost = new Map<string, BoardConfirmRow>()
  for (const row of confirmResult.rows) {
    if (row.scope === 'smt' && row.order_line_id) {
      confirmedSmt.set(row.order_line_id, row)
    }
    if (row.scope === 'post' && row.assembly_group_id) {
      confirmedPost.set(row.assembly_group_id, row)
    }
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

    const confirm = confirmedSmt.get(line.orderLineId)
    const hint = materialHint(productId, remainingQty, edgesByParent, onHand)
    const daysUntilDelivery = computeDaysUntilDelivery(line.deliveryDate)

    rows.push({
      key: productionPlanRowKey('smt', line.orderLineId),
      scope: 'smt',
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
      status: confirm ? 'confirmed' : 'waiting',
      confirmedAt: confirm?.confirmed_at || '',
      confirmedByName: confirm?.confirmed_by_name || '',
      ...scheduleFromConfirm(confirm),
    })
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

    const confirm = confirmedPost.get(groupId)
    const hint = materialHint(productId, remainingQty, edgesByParent, onHand)
    const daysUntilDelivery = computeDaysUntilDelivery(line.deliveryDate)

    rows.push({
      key: productionPlanRowKey('post', groupId),
      scope: 'post',
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
      status: confirm ? 'confirmed' : 'waiting',
      confirmedAt: confirm?.confirmed_at || '',
      confirmedByName: confirm?.confirmed_by_name || '',
      ...scheduleFromConfirm(confirm),
    })
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
    })
  }

  const team = normalizePostProcessTeam(input.team)
  const planResult = await upsertPostProcessProductionPlan({
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
}): Promise<ConfirmProductionPlanResult> {
  const createdBy = await resolveCreatedBySnapshot()
  const supabase = createSupabaseClient()
  const scope = input.scope

  const existingQuery =
    scope === 'smt'
      ? supabase
          .from('production_plan_board_items')
          .select('id')
          .eq('scope', 'smt')
          .eq('order_line_id', input.targetId)
          .maybeSingle()
      : supabase
          .from('production_plan_board_items')
          .select('id')
          .eq('scope', 'post')
          .eq('assembly_group_id', input.targetId)
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

  if (existing.data?.id) {
    let { error } = await supabase
      .from('production_plan_board_items')
      .update(schedulePayload)
      .eq('id', existing.data.id)

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

  const insertRow: Record<string, unknown> =
    scope === 'smt'
      ? {
          scope: 'smt',
          order_id: input.orderId,
          order_line_id: input.targetId,
          assembly_group_id: null,
          ...schedulePayload,
        }
      : {
          scope: 'post',
          order_id: input.orderId,
          order_line_id: null,
          assembly_group_id: input.targetId,
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
      error.message.includes('planned_date') ||
      error.message.includes('line_no') ||
      error.message.includes('pcb_side')
    ) {
      return {
        ok: false,
        reason: 'query',
        detail:
          '배정 컬럼이 없습니다. Supabase에서 migrate-production-plan-board-schedule.sql 을 실행하세요.',
      }
    }
    if (error.code === '23505' || error.message.toLowerCase().includes('duplicate')) {
      return { ok: true }
    }
    return { ok: false, reason: 'query', detail: error.message }
  }

  return { ok: true }
}

export async function unconfirmProductionPlanItem(input: {
  scope: ProductionPlanScope
  targetId: string
}): Promise<ConfirmProductionPlanResult> {
  const gate = await assertCanWrite({ module: 'production_plan', action: 'update' })
  if (!gate.ok) return gate

  const targetId = input.targetId.trim()
  if (!targetId) {
    return { ok: false, reason: 'validation', detail: '대상이 올바르지 않습니다.' }
  }

  const supabase = createSupabaseClient()

  // 보드에 저장된 배정 정보로 캘린더 계획도 정리
  const boardSelect =
    input.scope === 'smt'
      ? await supabase
          .from('production_plan_board_items')
          .select('planned_date, line_no, pcb_side')
          .eq('scope', 'smt')
          .eq('order_line_id', targetId)
          .maybeSingle()
      : await supabase
          .from('production_plan_board_items')
          .select('planned_date, team')
          .eq('scope', 'post')
          .eq('assembly_group_id', targetId)
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
    input.scope === 'smt'
      ? supabase
          .from('production_plan_board_items')
          .delete()
          .eq('scope', 'smt')
          .eq('order_line_id', targetId)
      : supabase
          .from('production_plan_board_items')
          .delete()
          .eq('scope', 'post')
          .eq('assembly_group_id', targetId)

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
