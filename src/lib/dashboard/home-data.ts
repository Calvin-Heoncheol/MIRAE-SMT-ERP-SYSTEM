import { fetchAssemblyGroups } from '@/lib/assembly/repository'
import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import {
  fetchDeliveryCumulativeCounts,
  fetchDeliveryTodayRecords,
} from '@/lib/delivery/repository'
import { buildDeliveryAvailabilityMap } from '@/lib/delivery/utils'
import { fetchOutboundPendingSummary } from '@/lib/materials/outbound/repository'
import { fetchMaterialPurchaseOrders } from '@/lib/materials/purchase-orders/repository'
import { fetchOnHandByMaterialId } from '@/lib/materials/inventory/stock'
import {
  buildDeliveryDueNotifications,
  buildNegativeStockNotification,
  buildPendingPurchaseNotification,
  type OpsAlertDepartment,
} from '@/lib/dashboard/ops-alerts'
import { fetchOrders } from '@/lib/orders/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import {
  fetchPostProcessCumulativeCounts,
  fetchPostProcessTodayProduction,
} from '@/lib/post-process/repository'
import { fetchProducts } from '@/lib/products/repository'
import { fetchSmtCumulativeCounts, fetchSmtTodayProduction } from '@/lib/smt/repository'
import { daysUntilYmd } from '@/lib/smt/plan/utils'

export type HomeProductionTeam = {
  team: string
  todayQuantity: number
  href: string
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

export type HomeHeadlineMetric = {
  key: string
  label: string
  value: number | null
  unit: string
  hint?: string
  href: string
  tone: 'default' | 'sky' | 'emerald' | 'amber' | 'rose'
}

export type HomeDashboardData = {
  todayLabel: string
  headline: HomeHeadlineMetric[]
  attention: HomeAttentionItem[]
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

export async function fetchHomeDashboardData(): Promise<HomeDashboardData> {
  const today = todayYmdSeoul()

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
    deliveryTodayResult,
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
    fetchDeliveryTodayRecords(),
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
  if (onHandResult.ok) {
    negativeStockMaterials = 0
    for (const onHand of onHandResult.onHandByMaterialId.values()) {
      if (onHand < 0) negativeStockMaterials += 1
    }
  }

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
    { team: '생산1팀', todayQuantity: smtTeamQuantity, href: '/smt/input' },
    ...POST_PROCESS_TEAMS.map((team) => {
      const todayQuantity = postTodayResult.ok
        ? postTodayResult.rows
            .filter((row) => row.team === team)
            .reduce((sum, row) => sum + Math.max(0, row.quantity), 0)
        : 0
      return {
        team: team as string,
        todayQuantity,
        href: `/post-process/input?team=${encodeURIComponent(team)}`,
      }
    }),
  ]

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

  const materialIssueCount =
    (negativeStockMaterials ?? 0) + (pendingPurchaseOrders ?? 0) + (outboundPending ?? 0)

  const headline: HomeHeadlineMetric[] = [
    {
      key: 'dueSoon',
      label: '납기 위험',
      value: dueSoonOrders,
      unit: '건',
      hint: `D-${DUE_SOON_DAYS} 이내·지연`,
      href: '/orders/status',
      tone: (dueSoonOrders ?? 0) > 0 ? 'rose' : 'default',
    },
    {
      key: 'unshipped',
      label: '미출하 주문',
      value: unshippedOrders,
      unit: '건',
      hint: '출하 미완료',
      href: '/orders/status',
      tone: (unshippedOrders ?? 0) > 0 ? 'amber' : 'default',
    },
    {
      key: 'todayShipped',
      label: '오늘 출하',
      value: todayShipped,
      unit: '건',
      hint: '오늘 등록분',
      href: '/delivery/input',
      tone: 'sky',
    },
    {
      key: 'materialIssues',
      label: '자재 이슈',
      value: materialIssueCount,
      unit: '건',
      hint:
        outboundPending != null
          ? `불출대기 ${outboundPending.toLocaleString('ko-KR')}`
          : undefined,
      href: '/materials/inventory',
      tone: (negativeStockMaterials ?? 0) > 0 ? 'rose' : materialIssueCount > 0 ? 'amber' : 'emerald',
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
    headline,
    attention: sortAttention(attention),
    productionTeams,
  }
}
