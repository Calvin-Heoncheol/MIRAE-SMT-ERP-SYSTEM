import { fetchAssemblyGroups } from '@/lib/assembly/repository'
import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import {
  fetchDeliveryCumulativeCounts,
  fetchDeliveryTodayRecords,
} from '@/lib/delivery/repository'
import { fetchOutboundPendingSummary } from '@/lib/materials/outbound/repository'
import { fetchMaterialPurchaseOrders } from '@/lib/materials/purchase-orders/repository'
import { fetchOnHandByMaterialId } from '@/lib/materials/inventory/stock'
import {
  buildDeliveryDueNotifications,
  buildNegativeStockNotification,
  buildPendingPurchaseNotification,
} from '@/lib/notifications/ops-alerts'
import { fetchOrders } from '@/lib/orders/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import { fetchPostProcessTodayProduction } from '@/lib/post-process/repository'
import { fetchPostProcessProductionPlansForDate } from '@/lib/post-process/plan/repository'
import { fetchProducts } from '@/lib/products/repository'
import { fetchSmtTodayProduction } from '@/lib/smt/repository'
import { fetchSmtProductionPlansForDate } from '@/lib/smt/plan/repository'
import {
  buildSmtPlanBlocks,
  daysUntilYmd,
} from '@/lib/smt/plan/utils'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'

export type HomeSmtLineStatus = 'idle' | 'planned' | 'running' | 'done'

export type HomeSmtLine = {
  lineNo: number
  status: HomeSmtLineStatus
  jobLabel: string
  plannedQuantity: number
  producedQuantity: number
}

export type HomeProductionTeam = {
  team: string
  todayQuantity: number
  href: string
}

/** 주문→자재→생산→출하 흐름 한 칸 */
export type HomePipelineStage = {
  key: string
  label: string
  primary: string
  secondary?: string
  href: string
  tone: 'default' | 'warn' | 'danger' | 'ok'
}

/** 조치가 필요한 항목 (목록 한 줄) */
export type HomeAttentionItem = {
  key: string
  kind: 'delivery' | 'material' | 'quality'
  title: string
  detail: string
  href: string
  tone: 'warn' | 'danger'
}

export type HomeDashboardData = {
  todayLabel: string
  pipeline: HomePipelineStage[]
  attention: HomeAttentionItem[]
  smtLines: HomeSmtLine[]
  productionTeams: HomeProductionTeam[]
}

const DUE_SOON_DAYS = 3

function groupAssembliesByOrderId(groups: OrderAssemblyGroup[]) {
  const map = new Map<string, OrderAssemblyGroup[]>()
  for (const group of groups) {
    const list = map.get(group.orderId) ?? []
    list.push(group)
    map.set(group.orderId, list)
  }
  return map
}

function formatCount(value: number | null, unit: string) {
  if (value == null) return '—'
  return `${value.toLocaleString('ko-KR')}${unit}`
}

export async function fetchHomeDashboardData(): Promise<HomeDashboardData> {
  const today = todayYmdSeoul()

  const [
    ordersResult,
    productsResult,
    deliveryCountsResult,
    smtPlansResult,
    postPlansResult,
    smtTodayResult,
    postTodayResult,
    purchaseOrdersResult,
    onHandResult,
    outboundPendingResult,
    deliveryTodayResult,
  ] = await Promise.all([
    fetchOrders(),
    fetchProducts(),
    fetchDeliveryCumulativeCounts(),
    fetchSmtProductionPlansForDate(today),
    fetchPostProcessProductionPlansForDate(today),
    fetchSmtTodayProduction(),
    fetchPostProcessTodayProduction(),
    fetchMaterialPurchaseOrders(),
    fetchOnHandByMaterialId(),
    fetchOutboundPendingSummary(),
    fetchDeliveryTodayRecords(),
  ])

  const productById = productsResult.ok
    ? Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
    : {}
  const assemblyResult = await fetchAssemblyGroups(productById)

  // ── 출하 미완료 · 납기 임박 · 조치 목록 ─────────────────────
  let unshippedOrders: number | null = null
  let dueSoonOrders: number | null = null
  let todayDeliveryDue: number | null = null
  const attention: HomeAttentionItem[] = []

  const todayNewOrders = ordersResult.ok
    ? ordersResult.orders.filter((order) => order.orderDate === today).length
    : null

  if (ordersResult.ok && assemblyResult.ok && deliveryCountsResult.ok) {
    const assembliesByOrderId = groupAssembliesByOrderId(assemblyResult.groups)
    const deliveryCounts = deliveryCountsResult.counts

    const isFullyShipped = (orderId: string) => {
      const groups = (assembliesByOrderId.get(orderId) ?? []).filter(
        (group) => Math.floor(group.targetQuantity) > 0,
      )
      if (!groups.length) return false
      return groups.every(
        (group) =>
          Math.max(0, Math.floor(Number(deliveryCounts[group.id]) || 0)) >=
          Math.floor(group.targetQuantity),
      )
    }

    const pendingOrders = ordersResult.orders.filter(
      (order) => order.items.length > 0 && !isFullyShipped(order.orderId),
    )
    unshippedOrders = pendingOrders.length

    const dueSoon = pendingOrders
      .filter((order) => order.deliveryDate)
      .flatMap((order) => {
        const daysUntil = daysUntilYmd(today, order.deliveryDate)
        return daysUntil != null && daysUntil <= DUE_SOON_DAYS ? [{ order, daysUntil }] : []
      })
      .sort((a, b) => a.daysUntil - b.daysUntil)

    dueSoonOrders = dueSoon.length
    todayDeliveryDue = pendingOrders.filter((order) => order.deliveryDate === today).length

    for (const note of buildDeliveryDueNotifications({
      today,
      orders: ordersResult.orders,
      assemblyGroups: assemblyResult.groups,
      deliveryCounts,
    })) {
      attention.push({
        key: note.key,
        kind: 'delivery',
        title: note.label,
        detail: note.detail,
        href: note.href,
        tone: note.tone === 'danger' ? 'danger' : 'warn',
      })
    }
  }

  // ── 미입고 발주 ─────────────────────────────────────────────
  const pendingPurchaseOrders = purchaseOrdersResult.ok
    ? purchaseOrdersResult.orders.filter((order) =>
        order.items.some((item) => item.inboundQuantity < item.quantity),
      ).length
    : null

  // ── 재고 마이너스 ───────────────────────────────────────────
  let negativeStockMaterials: number | null = null
  if (onHandResult.ok) {
    negativeStockMaterials = 0
    for (const onHand of onHandResult.onHandByMaterialId.values()) {
      if (onHand < 0) negativeStockMaterials += 1
    }
  }

  // ── SMT 라인현황 (오늘 실제 생산 기록 + 계획) ───────────────
  const planBlocks =
    smtPlansResult.ok && ordersResult.ok
      ? buildSmtPlanBlocks(smtPlansResult.plans, ordersResult.orders)
      : []
  const todaySmtRows = smtTodayResult.ok
    ? [...smtTodayResult.rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : []

  const smtLines: HomeSmtLine[] = SMT_PLAN_LINE_NOS.map((lineNo) => {
    const linePlans = planBlocks.filter((plan) => plan.lineNo === lineNo)
    const lineRows = todaySmtRows.filter((row) => row.lineNo === lineNo)

    const plannedQuantity = linePlans.reduce(
      (sum, plan) => sum + Math.max(0, Math.floor(plan.plannedQuantity)),
      0,
    )
    const producedQuantity = lineRows.reduce((sum, row) => sum + Math.max(0, row.quantity), 0)

    // 지금 생산중인 제품 — 오늘 가장 최근 등록 기록 기준, 없으면 계획 제품
    const latestRow = lineRows[0]
    const jobLabel = latestRow
      ? latestRow.productName || latestRow.productCode || '—'
      : linePlans.length
        ? linePlans.length > 1
          ? `${linePlans[0].productSummary} 외 ${linePlans.length - 1}건`
          : linePlans[0].productSummary
        : '생산 없음'

    const status: HomeSmtLineStatus =
      producedQuantity > 0
        ? plannedQuantity > 0 && producedQuantity >= plannedQuantity
          ? 'done'
          : 'running'
        : linePlans.length
          ? 'planned'
          : 'idle'

    return { lineNo, status, jobLabel, plannedQuantity, producedQuantity }
  })

  // ── 팀별 오늘 생산실적 (생산1 = SMT · 생산2/3/4 = 후공정) ──
  const smtTeamQuantity = smtTodayResult.ok
    ? smtTodayResult.rows.reduce((sum, row) => sum + Math.max(0, row.quantity), 0)
    : 0

  const todayDefectQuantity =
    (smtTodayResult.ok
      ? smtTodayResult.rows.reduce((sum, row) => sum + Math.max(0, row.defectQuantity), 0)
      : 0) +
    (postTodayResult.ok
      ? postTodayResult.rows.reduce((sum, row) => sum + Math.max(0, row.defectQuantity), 0)
      : 0)

  const productionTeams: HomeProductionTeam[] = [
    { team: '생산1팀', todayQuantity: smtTeamQuantity, href: '/smt' },
    ...POST_PROCESS_TEAMS.map((team) => {
      const todayQuantity = postTodayResult.ok
        ? postTodayResult.rows
            .filter((row) => row.team === team)
            .reduce((sum, row) => sum + Math.max(0, row.quantity), 0)
        : 0
      return {
        team: team as string,
        todayQuantity,
        href: `/post-process?team=${encodeURIComponent(team)}`,
      }
    }),
  ]

  // ── 부서별 오늘 요약 ────────────────────────────────────────
  const todayPlannedQuantity =
    smtLines.reduce((sum, line) => sum + line.plannedQuantity, 0) +
    (postPlansResult.ok
      ? postPlansResult.plans.reduce(
          (sum, plan) => sum + Math.max(0, Math.floor(plan.plannedQuantity)),
          0,
        )
      : 0)
  const todayProducedQuantity = productionTeams.reduce((sum, team) => sum + team.todayQuantity, 0)
  const todayAchievementRate =
    todayPlannedQuantity > 0
      ? Math.round((todayProducedQuantity / todayPlannedQuantity) * 100)
      : null

  const outboundPending = outboundPendingResult.ok
    ? outboundPendingResult.pending.smd +
      outboundPendingResult.pending.dip +
      outboundPendingResult.pending.etc
    : null

  const todayShipped = deliveryTodayResult.ok ? deliveryTodayResult.rows.length : null

  const stockAlert = buildNegativeStockNotification(negativeStockMaterials ?? 0)
  if (stockAlert) {
    attention.push({
      key: stockAlert.key,
      kind: 'material',
      title: stockAlert.label,
      detail: stockAlert.detail,
      href: stockAlert.href,
      tone: 'danger',
    })
  }
  const purchaseAlert = buildPendingPurchaseNotification(pendingPurchaseOrders ?? 0)
  if (purchaseAlert) {
    attention.push({
      key: purchaseAlert.key,
      kind: 'material',
      title: purchaseAlert.label,
      detail: purchaseAlert.detail,
      href: purchaseAlert.href,
      tone: 'warn',
    })
  }
  if (outboundPending != null && outboundPending > 0) {
    attention.push({
      key: 'material:outbound',
      kind: 'material',
      title: `불출 대기 ${outboundPending.toLocaleString('ko-KR')}건`,
      detail: 'BOM 기준 미불출',
      href: '/materials/outbound',
      tone: 'warn',
    })
  }
  if (todayDefectQuantity > 0) {
    attention.push({
      key: 'quality:defect',
      kind: 'quality',
      title: `오늘 불량 ${todayDefectQuantity.toLocaleString('ko-KR')}EA`,
      detail: 'SMT·후공정 합산',
      href: '/production/history',
      tone: 'danger',
    })
  }

  const materialIssueCount =
    (negativeStockMaterials ?? 0) + (pendingPurchaseOrders ?? 0) + (outboundPending ?? 0)

  const pipeline: HomePipelineStage[] = [
    {
      key: 'order',
      label: '주문',
      primary: formatCount(todayNewOrders, '건'),
      secondary:
        dueSoonOrders != null
          ? `납기임박 ${dueSoonOrders.toLocaleString('ko-KR')}`
          : undefined,
      href: '/orders?filter=today',
      tone: (dueSoonOrders ?? 0) > 0 ? 'warn' : 'default',
    },
    {
      key: 'material',
      label: '자재',
      primary: materialIssueCount > 0 ? `이슈 ${materialIssueCount.toLocaleString('ko-KR')}` : '정상',
      secondary:
        outboundPending != null
          ? `불출대기 ${outboundPending.toLocaleString('ko-KR')}`
          : undefined,
      href: '/materials/inventory',
      tone: (negativeStockMaterials ?? 0) > 0 ? 'danger' : materialIssueCount > 0 ? 'warn' : 'ok',
    },
    {
      key: 'production',
      label: '생산',
      primary:
        todayAchievementRate != null ? `${todayAchievementRate}%` : '계획 없음',
      secondary:
        todayPlannedQuantity > 0
          ? `${todayProducedQuantity.toLocaleString('ko-KR')} / ${todayPlannedQuantity.toLocaleString('ko-KR')} EA`
          : undefined,
      href: '/production/plan',
      tone: 'default',
    },
    {
      key: 'delivery',
      label: '출하',
      primary: formatCount(todayShipped, '건'),
      secondary:
        unshippedOrders != null
          ? `미완료 ${unshippedOrders.toLocaleString('ko-KR')} · 예정 ${todayDeliveryDue ?? 0}`
          : undefined,
      href: '/delivery/input',
      tone: 'default',
    },
  ]

  const todayLabel = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${today}T12:00:00+09:00`))

  return {
    todayLabel,
    pipeline,
    attention,
    smtLines,
    productionTeams,
  }
}
