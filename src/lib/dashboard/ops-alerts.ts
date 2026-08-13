import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import type { OrderListGroup } from '@/lib/orders/types'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import {
  daysUntilYmd,
  formatDeliveryCountdown,
} from '@/lib/smt/plan/utils'

/** 관심 필요 알림의 담당 부서 */
export type OpsAlertDepartment = 'production' | 'material' | 'sales'

/** 홈 대시보드 주의 항목용 (알림 벨과 무관) */
export type OpsAlert = {
  key: string
  label: string
  detail: string
  href: string
  tone: 'warn' | 'danger' | 'info'
  department: OpsAlertDepartment
}

const DUE_SOON_DAYS = 3
const MAX_DELIVERY_ALERTS = 8

function groupAssembliesByOrderId(groups: OrderAssemblyGroup[]) {
  const map = new Map<string, OrderAssemblyGroup[]>()
  for (const group of groups) {
    const list = map.get(group.orderId) ?? []
    list.push(group)
    map.set(group.orderId, list)
  }
  return map
}

/**
 * 납기 임박·지연 미출하 주문.
 * - 출하가능 수량 있음 → 영업 (생산은 됐고 출하 대기)
 * - 아니면 → 생산 (아직 생산이 막혀 납기 위험)
 */
export function buildDeliveryDueNotifications(input: {
  today: string
  orders: OrderListGroup[]
  assemblyGroups: OrderAssemblyGroup[]
  deliveryCounts: Record<string, number>
  availabilityByGroupId: Record<string, DeliveryAvailability>
}): OpsAlert[] {
  const assembliesByOrderId = groupAssembliesByOrderId(input.assemblyGroups)

  const isFullyShipped = (orderId: string) => {
    const groups = (assembliesByOrderId.get(orderId) ?? []).filter(
      (group) => Math.floor(group.targetQuantity) > 0,
    )
    if (!groups.length) return false
    return groups.every(
      (group) =>
        Math.max(0, Math.floor(Number(input.deliveryCounts[group.id]) || 0)) >=
        Math.floor(group.targetQuantity),
    )
  }

  const orderShippable = (orderId: string) => {
    const groups = (assembliesByOrderId.get(orderId) ?? []).filter(
      (group) => Math.floor(group.targetQuantity) > 0,
    )
    let shippable = 0
    for (const group of groups) {
      shippable += Math.max(0, Math.floor(input.availabilityByGroupId[group.id]?.shippable || 0))
    }
    return shippable
  }

  const pendingOrders = input.orders.filter(
    (order) => order.items.length > 0 && !isFullyShipped(order.orderId),
  )

  const dueSoon = pendingOrders
    .filter((order) => order.deliveryDate)
    .flatMap((order) => {
      const daysUntil = daysUntilYmd(input.today, order.deliveryDate)
      return daysUntil != null && daysUntil <= DUE_SOON_DAYS
        ? [{ order, daysUntil }]
        : []
    })
    .sort((a, b) => a.daysUntil - b.daysUntil)

  return dueSoon.slice(0, MAX_DELIVERY_ALERTS).map(({ order, daysUntil }) => {
    const shippable = orderShippable(order.orderId)
    const readyToShip = shippable > 0
    const countdown = formatDeliveryCountdown(daysUntil)

    if (readyToShip) {
      return {
        key: `sales:ship:${order.orderId}`,
        label: `${formatInternalCodeLabel(order.orderNumber)} · ${order.customer || '—'}`,
        detail: `출하 가능 ${shippable.toLocaleString('ko-KR')}대 · 납기 ${order.deliveryDate} (${countdown})`,
        href: '/delivery/input',
        tone: daysUntil < 0 ? ('danger' as const) : ('warn' as const),
        department: 'sales' as const,
      }
    }

    return {
      key: `production:due:${order.orderId}`,
      label: `${formatInternalCodeLabel(order.orderNumber)} · ${order.customer || '—'}`,
      detail: `납기 ${order.deliveryDate} (${countdown}) · 생산 진행 필요`,
      href: '/production/status',
      tone: daysUntil < 0 ? ('danger' as const) : ('warn' as const),
      department: 'production' as const,
    }
  })
}

export function buildNegativeStockNotification(negativeCount: number): OpsAlert | null {
  if (negativeCount <= 0) return null
  return {
    key: 'stock:negative',
    label: `재고 마이너스 자재 ${negativeCount.toLocaleString('ko-KR')}건`,
    detail: '재고현황에서 입고·불출 내역을 확인하세요',
    href: '/materials/inventory',
    tone: 'danger',
    department: 'material',
  }
}

export function buildPendingPurchaseNotification(pendingCount: number): OpsAlert | null {
  if (pendingCount <= 0) return null
  return {
    key: 'purchase:pending-inbound',
    label: `미입고 발주 ${pendingCount.toLocaleString('ko-KR')}건`,
    detail: '발주서 입고 잔량을 확인하세요',
    href: '/materials/purchase-orders',
    tone: 'warn',
    department: 'material',
  }
}
