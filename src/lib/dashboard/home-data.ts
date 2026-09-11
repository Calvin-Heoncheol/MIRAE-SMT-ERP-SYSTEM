import { fetchAssemblyGroups } from '@/lib/assembly/repository'
import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import {
  fetchDeliveryCumulativeCounts,
} from '@/lib/delivery/repository'
import { buildDeliveryAvailabilityMap } from '@/lib/delivery/utils'
import { fetchOutboundPendingSummary } from '@/lib/materials/outbound/repository'
import { fetchMaterialPurchaseOrders } from '@/lib/materials/purchase-orders/repository'
import { fetchOnHandByMaterialId } from '@/lib/materials/inventory/stock'
import { fetchRecentNotices } from '@/lib/notices/repository'
import type { CompanyNotice } from '@/lib/notices/types'
import {
  buildHomeDashboardHrefs,
  fetchHomeVisualAnalytics,
  resolveHomeDashboardPeriod,
  type HomeResolvedPeriod,
  type HomeVisualAnalytics,
} from '@/lib/dashboard/home-analytics'
import {
  buildDeliveryDueNotifications,
  buildNegativeStockNotification,
  buildPendingPurchaseNotification,
  type OpsAlertDepartment,
} from '@/lib/dashboard/ops-alerts'
import { fetchOrders } from '@/lib/orders/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { normalizePostProcessTeam, POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import {
  fetchPostProcessCumulativeCounts,
  fetchPostProcessTodayProduction,
} from '@/lib/post-process/repository'
import { fetchProducts } from '@/lib/products/repository'
import { fetchSmtCumulativeCounts, fetchSmtTodayProduction } from '@/lib/smt/repository'
import { daysUntilYmd } from '@/lib/smt/plan/utils'

export type HomeTeamProductionRow = {
  id: string
  createdAt: string
  orderNumber: string
  customer: string
  productName: string
  productCode: string
  quantity: number
  /** SMT 면 표시용 (라인·면) */
  detail?: string
}

export type HomeProductionTeam = {
  team: string
  todayQuantity: number
  href: string
  rows: HomeTeamProductionRow[]
}

/** 관심 필요 항목 — department 는 담당 부서 뱃지 */
export type HomeAttentionItem = {
  key: string
  department: OpsAlertDepartment
  title: string
  detail: string
  href: string
  tone: 'warn' | 'danger'
}

/** 공장 운영판 3열 — 영업 / 자재 / 생산 */
export type HomeAttentionByLane = {
  sales: HomeAttentionItem[]
  material: HomeAttentionItem[]
  production: HomeAttentionItem[]
}

export type HomeDashboardData = {
  todayYmd: string
  todayLabel: string
  period: HomeResolvedPeriod
  hrefs: {
    dayHref: string
    weekHref: string
    monthHref: string
    prevHref: string
    nextHref: string
  }
  /** @deprecated 시각형 대시보드로 대체 — 하위 호환 */
  attentionByLane: HomeAttentionByLane
  visual: HomeVisualAnalytics
  notices: CompanyNotice[]
  noticesStatus: 'ok' | 'missing_table' | 'error' | 'env'
  noticesMessage?: string
  canManageNotices: boolean
  productionTeams: HomeProductionTeam[]
}

const DUE_SOON_DAYS = 3

const DEPARTMENT_SORT: Record<OpsAlertDepartment, number> = {
  production: 0,
  material: 1,
  sales: 2,
}

function groupAssembliesByOrderId(groups: OrderAssemblyGroup[]) {
  const map = new Map<string, OrderAssemblyGroup[]>()
  for (const group of groups) {
    const list = map.get(group.orderId) ?? []
    list.push(group)
    map.set(group.orderId, list)
  }
  return map
}

function sortAttention(items: HomeAttentionItem[]) {
  return [...items].sort((a, b) => {
    if (a.tone !== b.tone) return a.tone === 'danger' ? -1 : 1
    return DEPARTMENT_SORT[a.department] - DEPARTMENT_SORT[b.department]
  })
}

function splitAttentionByLane(items: HomeAttentionItem[]): HomeAttentionByLane {
  const sales: HomeAttentionItem[] = []
  const material: HomeAttentionItem[] = []
  const production: HomeAttentionItem[] = []
  for (const item of sortAttention(items)) {
    if (item.department === 'sales') sales.push(item)
    else if (item.department === 'material') material.push(item)
    else production.push(item)
  }
  return { sales, material, production }
}

export function formatHomeDateLabel(ymd: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${ymd}T12:00:00+09:00`))
}

function isValidYmd(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00+09:00`)
  return !Number.isNaN(date.getTime())
}

type SmtTodayResult = Awaited<ReturnType<typeof fetchSmtTodayProduction>>
type PostTodayResult = Awaited<ReturnType<typeof fetchPostProcessTodayProduction>>

export function buildHomeProductionTeams(
  smtTodayResult: SmtTodayResult,
  postTodayResult: PostTodayResult,
): HomeProductionTeam[] {
  const smtRows: HomeTeamProductionRow[] = smtTodayResult.ok
    ? smtTodayResult.rows.map((row) => {
        const bits: string[] = []
        if (row.lineNo != null) bits.push(`L${row.lineNo}`)
        if (row.pcbSide && row.pcbSide !== 'SINGLE') bits.push(row.pcbSide)
        return {
          id: row.id,
          createdAt: row.createdAt,
          orderNumber: row.orderNumber,
          customer: row.customer,
          productName: row.productName,
          productCode: row.productCode,
          quantity: Math.max(0, row.quantity),
          detail: bits.length ? bits.join(' · ') : undefined,
        }
      })
    : []

  const smtTeamQuantity = smtRows.reduce((sum, row) => sum + row.quantity, 0)

  return [
    {
      team: '생산1팀',
      todayQuantity: smtTeamQuantity,
      href: '/production/history?team=생산1팀',
      rows: smtRows,
    },
    ...POST_PROCESS_TEAMS.map((team) => {
      const teamRows: HomeTeamProductionRow[] = postTodayResult.ok
        ? postTodayResult.rows
            // 팀이 비어 있거나 잘못된 값은 생산2팀으로 정규화 (이력·리포트와 동일)
            .filter((row) => normalizePostProcessTeam(row.team) === team)
            .map((row) => ({
              id: row.id,
              createdAt: row.createdAt,
              orderNumber: row.orderNumber,
              customer: row.customer,
              productName: row.productName,
              productCode: row.productCode,
              quantity: Math.max(0, row.quantity),
            }))
        : []
      const todayQuantity = teamRows.reduce((sum, row) => sum + row.quantity, 0)
      return {
        team: team as string,
        todayQuantity,
        href: `/production/history?team=${encodeURIComponent(team)}`,
        rows: teamRows,
      }
    }),
  ]
}

/** 특정 일자 팀별 생산 (대시보드 날짜 선택용) */
export async function fetchHomeTeamProduction(recordDate: string): Promise<{
  ok: true
  recordDate: string
  dateLabel: string
  teams: HomeProductionTeam[]
} | {
  ok: false
  message: string
}> {
  const date = recordDate.trim()
  if (!isValidYmd(date)) {
    return { ok: false, message: '날짜 형식이 올바르지 않습니다.' }
  }

  const [smtTodayResult, postTodayResult] = await Promise.all([
    fetchSmtTodayProduction(date),
    fetchPostProcessTodayProduction(date),
  ])

  return {
    ok: true,
    recordDate: date,
    dateLabel: formatHomeDateLabel(date),
    teams: buildHomeProductionTeams(smtTodayResult, postTodayResult),
  }
}

export async function fetchHomeDashboardData(input?: {
  period?: string | string[] | null
  date?: string | string[] | null
}): Promise<HomeDashboardData> {
  const today = todayYmdSeoul()
  const period = resolveHomeDashboardPeriod({
    period: input?.period ?? undefined,
    date: input?.date ?? undefined,
  })
  const hrefs = buildHomeDashboardHrefs(period)

  const [
    ordersResult,
    productsResult,
    deliveryCountsResult,
    smtCountsResult,
    postCountsResult,
    smtTodayResult,
    postTodayResult,
    purchaseOrdersResult,
    onHandResult,
    outboundPendingResult,
    noticesResult,
  ] = await Promise.all([
    fetchOrders(),
    fetchProducts(),
    fetchDeliveryCumulativeCounts(),
    fetchSmtCumulativeCounts(),
    fetchPostProcessCumulativeCounts(),
    fetchSmtTodayProduction(),
    fetchPostProcessTodayProduction(),
    fetchMaterialPurchaseOrders(),
    fetchOnHandByMaterialId(),
    fetchOutboundPendingSummary(),
    fetchRecentNotices(),
  ])

  const productById = productsResult.ok
    ? Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
    : {}
  const assemblyResult = await fetchAssemblyGroups(productById)

  let unshippedOrders: number | null = null
  let dueSoonOrders: number | null = null
  const attention: HomeAttentionItem[] = []

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

    const availabilityByGroupId =
      smtCountsResult.ok && postCountsResult.ok
        ? buildDeliveryAvailabilityMap(
            assemblyResult.groups,
            smtCountsResult.counts,
            postCountsResult.counts,
            deliveryCounts,
            productById,
            {
              orderById: Object.fromEntries(
                ordersResult.orders.map((order) => [order.orderId, order]),
              ),
            },
          )
        : {}

    for (const note of buildDeliveryDueNotifications({
      today,
      orders: ordersResult.orders,
      assemblyGroups: assemblyResult.groups,
      deliveryCounts,
      availabilityByGroupId,
    })) {
      attention.push({
        key: note.key,
        department: note.department,
        title: note.label,
        detail: note.detail,
        href: note.href,
        tone: note.tone === 'danger' ? 'danger' : 'warn',
      })
    }
  }

  const pendingPurchaseOrders = purchaseOrdersResult.ok
    ? purchaseOrdersResult.orders.filter((order) =>
        order.items.some((item) => item.inboundQuantity < item.quantity),
      ).length
    : null

  let negativeStockMaterials: number | null = null
  let positiveStockSkus = 0
  if (onHandResult.ok) {
    negativeStockMaterials = 0
    for (const onHand of onHandResult.onHandByMaterialId.values()) {
      if (onHand < 0) negativeStockMaterials += 1
      if (onHand > 0) positiveStockSkus += 1
    }
  }

  const expectedInboundSkus = purchaseOrdersResult.ok
    ? new Set(
        purchaseOrdersResult.orders.flatMap((order) =>
          order.items
            .filter((item) => item.inboundQuantity < item.quantity)
            .map((item) => String(item.materialId || item.materialCode || '').trim())
            .filter(Boolean),
        ),
      ).size
    : 0

  let openDueDates: string[] = []
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
    openDueDates = ordersResult.orders
      .filter((order) => order.items.length > 0 && !isFullyShipped(order.orderId) && order.deliveryDate)
      .map((order) => order.deliveryDate)
  }

  const todayDefectQuantity =
    (smtTodayResult.ok
      ? smtTodayResult.rows.reduce((sum, row) => sum + Math.max(0, row.defectQuantity), 0)
      : 0) +
    (postTodayResult.ok
      ? postTodayResult.rows.reduce((sum, row) => sum + Math.max(0, row.defectQuantity), 0)
      : 0)

  const productionTeams = buildHomeProductionTeams(smtTodayResult, postTodayResult)

  const outboundPending = outboundPendingResult.ok
    ? outboundPendingResult.pending.smd +
      outboundPendingResult.pending.dip +
      outboundPendingResult.pending.etc
    : null

  const stockAlert = buildNegativeStockNotification(negativeStockMaterials ?? 0)
  if (stockAlert) {
    attention.push({
      key: stockAlert.key,
      department: stockAlert.department,
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
      department: purchaseAlert.department,
      title: purchaseAlert.label,
      detail: purchaseAlert.detail,
      href: purchaseAlert.href,
      tone: 'warn',
    })
  }
  if (outboundPending != null && outboundPending > 0) {
    attention.push({
      key: 'material:outbound',
      department: 'material',
      title: `불출 대기 ${outboundPending.toLocaleString('ko-KR')}건`,
      detail: 'BOM 기준 미불출',
      href: '/materials/outbound',
      tone: 'warn',
    })
  }
  if (todayDefectQuantity > 0) {
    attention.push({
      key: 'quality:defect',
      department: 'production',
      title: `오늘 불량 ${todayDefectQuantity.toLocaleString('ko-KR')}EA`,
      detail: 'SMT·후공정 합산',
      href: '/production/history',
      tone: 'danger',
    })
  }

  const todayLabel = formatHomeDateLabel(today)

  const noticesStatus = !noticesResult.ok
    ? noticesResult.reason === 'missing_table'
      ? ('missing_table' as const)
      : noticesResult.reason === 'env'
        ? ('env' as const)
        : ('error' as const)
    : ('ok' as const)

  const visual = await fetchHomeVisualAnalytics(
    {
      dueSoonOrders: dueSoonOrders ?? 0,
      unshippedOrders: unshippedOrders ?? 0,
      negativeStockMaterials: negativeStockMaterials ?? 0,
      positiveStockSkus,
      expectedInboundSkus,
      openDeliveryDates: openDueDates,
    },
    period,
  )

  return {
    todayYmd: today,
    todayLabel,
    period,
    hrefs,
    attentionByLane: splitAttentionByLane(attention),
    visual,
    notices: noticesResult.ok ? noticesResult.rows : [],
    noticesStatus,
    noticesMessage: noticesResult.ok ? undefined : noticesResult.detail,
    canManageNotices: false,
    productionTeams,
  }
}
