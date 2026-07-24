import { fetchAssemblyGroups } from '@/lib/assembly/repository'
import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import {
  fetchDeliveryCumulativeCounts,
  fetchDeliveryTodayRecords,
} from '@/lib/delivery/repository'
import { fetchOutboundPendingSummary } from '@/lib/materials/outbound/repository'
import { fetchMaterialPurchaseOrders } from '@/lib/materials/purchase-orders/repository'
import { fetchOnHandByMaterialId } from '@/lib/materials/inventory/stock'
import { fetchOrders } from '@/lib/orders/repository'
import { formatInternalCodeLabel, todayYmdSeoul } from '@/lib/orders/utils'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import { fetchPostProcessTodayProduction } from '@/lib/post-process/repository'
import { fetchPostProcessProductionPlansForDate } from '@/lib/post-process/plan/repository'
import { fetchProducts } from '@/lib/products/repository'
import { fetchSmtTodayProduction } from '@/lib/smt/repository'
import { fetchSmtProductionPlansForDate } from '@/lib/smt/plan/repository'
import {
  buildSmtPlanBlocks,
  daysUntilYmd,
  formatDeliveryCountdown,
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

export type HomeAlert = {
  key: string
  label: string
  detail: string
  href: string
  tone: 'warn' | 'danger'
}

export type HomeDeptMetric = {
  key: string
  label: string
  value: number | null
  unit: '건' | 'EA' | '%'
  href: string
  tone: 'default' | 'warn' | 'danger'
}

export type HomeDeptSection = {
  dept: string
  href: string
  metrics: HomeDeptMetric[]
}

export type HomeHeroMetric = {
  key: string
  label: string
  value: number | null
  unit: '건' | 'EA' | '%'
  href: string
  tone: 'default' | 'warn' | 'danger'
  hint?: string
}

export type HomeDashboardData = {
  todayLabel: string
  hero: HomeHeroMetric[]
  departments: HomeDeptSection[]
  smtLines: HomeSmtLine[]
  productionTeams: HomeProductionTeam[]
  alerts: HomeAlert[]
}

const DUE_SOON_DAYS = 3
const MAX_DELIVERY_ALERTS = 5

function groupAssembliesByOrderId(groups: OrderAssemblyGroup[]) {
  const map = new Map<string, OrderAssemblyGroup[]>()
  for (const group of groups) {
    const list = map.get(group.orderId) ?? []
    list.push(group)
    map.set(group.orderId, list)
  }
  return map
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

  // ── 출하 미완료 · 납기 임박 ─────────────────────────────────
  let unshippedOrders: number | null = null
  let dueSoonOrders: number | null = null
  let todayDeliveryDue: number | null = null
  const alerts: HomeAlert[] = []

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

    for (const { order, daysUntil } of dueSoon.slice(0, MAX_DELIVERY_ALERTS)) {
      alerts.push({
        key: `delivery:${order.orderId}`,
        label: `${formatInternalCodeLabel(order.orderNumber)} · ${order.customer || '—'}`,
        detail: `납기 ${order.deliveryDate} (${formatDeliveryCountdown(daysUntil)})`,
        href: '/production/status',
        tone: daysUntil < 0 ? 'danger' : 'warn',
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
    if (negativeStockMaterials > 0) {
      alerts.push({
        key: 'stock:negative',
        label: `재고 마이너스 자재 ${negativeStockMaterials.toLocaleString('ko-KR')}건`,
        detail: '재고현황에서 입고·불출 내역을 확인하세요',
        href: '/materials/inventory',
        tone: 'danger',
      })
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

  const warnIfPositive = (value: number | null): 'default' | 'warn' =>
    value != null && value > 0 ? 'warn' : 'default'

  const departments: HomeDeptSection[] = [
    {
      dept: '영업',
      href: '/orders',
      metrics: [
        {
          key: 'sales:new-orders',
          label: '오늘 신규 주문',
          value: todayNewOrders,
          unit: '건',
          href: '/orders?filter=today',
          tone: 'default',
        },
        {
          key: 'sales:due-soon',
          label: '납기 임박 (3일)',
          value: dueSoonOrders,
          unit: '건',
          href: '/production/status',
          tone: warnIfPositive(dueSoonOrders),
        },
      ],
    },
    {
      dept: '자재',
      href: '/materials/inventory',
      metrics: [
        {
          key: 'materials:outbound-pending',
          label: '불출 대기',
          value: outboundPending,
          unit: '건',
          href: '/materials/outbound',
          tone: warnIfPositive(outboundPending),
        },
        {
          key: 'materials:pending-po',
          label: '미입고 발주',
          value: pendingPurchaseOrders,
          unit: '건',
          href: '/materials/purchase-orders',
          tone: warnIfPositive(pendingPurchaseOrders),
        },
        {
          key: 'materials:negative-stock',
          label: '재고 마이너스',
          value: negativeStockMaterials,
          unit: '건',
          href: '/materials/inventory',
          tone: negativeStockMaterials != null && negativeStockMaterials > 0 ? 'danger' : 'default',
        },
      ],
    },
    {
      dept: '생산',
      href: '/smt',
      metrics: [
        {
          key: 'production:planned',
          label: '오늘 계획',
          value: todayPlannedQuantity,
          unit: 'EA',
          href: '/smt/plan',
          tone: 'default',
        },
        {
          key: 'production:achievement',
          label: '계획 달성률',
          value: todayAchievementRate,
          unit: '%',
          href: '/production/status',
          tone: 'default',
        },
        {
          key: 'production:defect',
          label: '오늘 불량',
          value: todayDefectQuantity,
          unit: 'EA',
          href: '/production/history',
          tone: todayDefectQuantity > 0 ? 'danger' : 'default',
        },
      ],
    },
    {
      dept: '출하',
      href: '/delivery/input',
      metrics: [
        {
          key: 'delivery:today-due',
          label: '오늘 출하 예정',
          value: todayDeliveryDue,
          unit: '건',
          href: '/delivery/input',
          tone: warnIfPositive(todayDeliveryDue),
        },
        {
          key: 'delivery:today-shipped',
          label: '오늘 출하 완료',
          value: todayShipped,
          unit: '건',
          href: '/delivery/input',
          tone: 'default',
        },
        {
          key: 'delivery:unshipped',
          label: '출하 미완료',
          value: unshippedOrders,
          unit: '건',
          href: '/delivery/input',
          tone: 'default',
        },
      ],
    },
  ]

  const hero: HomeHeroMetric[] = [
    {
      key: 'hero:new-orders',
      label: '오늘 신규 주문',
      value: todayNewOrders,
      unit: '건',
      href: '/orders?filter=today',
      tone: 'default',
    },
    {
      key: 'hero:achievement',
      label: '계획 달성률',
      value: todayAchievementRate,
      unit: '%',
      href: '/production/status',
      tone: 'default',
      hint:
        todayPlannedQuantity > 0
          ? `${todayProducedQuantity.toLocaleString('ko-KR')} / ${todayPlannedQuantity.toLocaleString('ko-KR')} EA`
          : '오늘 계획 없음',
    },
    {
      key: 'hero:shipped',
      label: '오늘 출하',
      value: todayShipped,
      unit: '건',
      href: '/delivery/input',
      tone: 'default',
      hint:
        todayDeliveryDue != null
          ? `예정 ${todayDeliveryDue.toLocaleString('ko-KR')}건`
          : undefined,
    },
    {
      key: 'hero:alerts',
      label: '주의 알림',
      value: alerts.length,
      unit: '건',
      href: '/production/status',
      tone: alerts.some((alert) => alert.tone === 'danger')
        ? 'danger'
        : alerts.length > 0
          ? 'warn'
          : 'default',
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
    hero,
    departments,
    smtLines,
    productionTeams,
    alerts,
  }
}
