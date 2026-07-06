import type { OrderListGroup } from '@/lib/orders/types'
import { addDaysYmd, formatProductSummary, todayYmdSeoul } from '@/lib/orders/utils'
import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'
import { resolveProductionCount } from '@/lib/production-input/utils'
import type { SmtPlanBlock, SmtPlanOrderCandidate, SmtProductionPlan } from './types'

export function parseYmdToLocalDate(ymd: string) {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return new Date(NaN)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function formatYmdLocal(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getWeekStartMondayYmd(baseYmd: string = todayYmdSeoul()) {
  const date = parseYmdToLocalDate(baseYmd)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return formatYmdLocal(date)
}

export function getWeekDates(weekStartYmd: string) {
  return Array.from({ length: 7 }, (_, index) => addDaysYmd(weekStartYmd, index))
}

export function getWeekEndYmd(weekStartYmd: string) {
  return addDaysYmd(weekStartYmd, 6)
}

export function formatWeekdayLabel(ymd: string) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const date = parseYmdToLocalDate(ymd)
  if (Number.isNaN(date.getTime())) return ''
  return weekdays[date.getDay()] ?? ''
}

export function formatCalendarDayLabel(ymd: string) {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return ymd
  return `${Number(match[2])}/${Number(match[3])}`
}

export function formatWeekRangeLabel(weekStartYmd: string) {
  const weekEndYmd = getWeekEndYmd(weekStartYmd)
  const start = parseYmdToLocalDate(weekStartYmd)
  const end = parseYmdToLocalDate(weekEndYmd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return weekStartYmd

  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 – ${end.getDate()}일`
    }
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 – ${end.getMonth() + 1}월 ${end.getDate()}일`
  }

  return `${weekStartYmd} – ${weekEndYmd}`
}

export function daysUntilYmd(fromYmd: string, toYmd: string) {
  const from = parseYmdToLocalDate(fromYmd)
  const to = parseYmdToLocalDate(toYmd)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((to.getTime() - from.getTime()) / msPerDay)
}

function sumPlannedQuantityByOrderId(plans: SmtProductionPlan[]) {
  const map = new Map<string, number>()
  for (const plan of plans) {
    map.set(plan.orderId, (map.get(plan.orderId) ?? 0) + plan.plannedQuantity)
  }
  return map
}

export function computeOrderSmtMetrics(
  order: OrderListGroup,
  smtLines: ProductionOrderLine[],
  smtCounts: ProductionCounts,
) {
  const orderSmtLines = smtLines.filter((line) => line.orderNumber === order.orderNumber)
  let smtTarget = 0
  let smtProduced = 0

  for (const smtLine of orderSmtLines) {
    const lineTarget = Math.max(0, Math.floor(smtLine.quantity))
    smtTarget += lineTarget
    smtProduced += resolveProductionCount(smtLine, smtCounts)
  }

  const smtRemaining = Math.max(0, smtTarget - smtProduced)
  return { smtTarget, smtProduced, smtRemaining }
}

export function buildSmtPlanOrderCandidates(
  orders: OrderListGroup[],
  smtLines: ProductionOrderLine[],
  smtCounts: ProductionCounts,
  allPlans: SmtProductionPlan[],
): SmtPlanOrderCandidate[] {
  const plannedByOrderId = sumPlannedQuantityByOrderId(allPlans)
  const today = todayYmdSeoul()

  return orders
    .map((order) => {
      const { smtTarget, smtProduced, smtRemaining } = computeOrderSmtMetrics(order, smtLines, smtCounts)
      const plannedTotal = plannedByOrderId.get(order.orderId) ?? 0
      const unplannedRemaining = Math.max(0, smtRemaining - plannedTotal)
      const deliveryDate = order.deliveryDate || ''

      return {
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        customer: order.customer,
        productSummary: formatProductSummary(order),
        deliveryDate,
        smtTarget,
        smtProduced,
        smtRemaining,
        plannedTotal,
        unplannedRemaining,
        daysUntilDelivery: deliveryDate ? daysUntilYmd(today, deliveryDate) : null,
      }
    })
    .filter((order) => order.unplannedRemaining > 0)
    .sort((a, b) => {
      const aDue = a.daysUntilDelivery ?? 9999
      const bDue = b.daysUntilDelivery ?? 9999
      if (aDue !== bDue) return aDue - bDue
      return b.orderNumber.localeCompare(a.orderNumber)
    })
}

export function buildSmtPlanBlocks(
  weekPlans: SmtProductionPlan[],
  orders: OrderListGroup[],
): SmtPlanBlock[] {
  const orderById = Object.fromEntries(orders.map((order) => [order.orderId, order]))

  return weekPlans
    .map((plan) => {
      const order = orderById[plan.orderId]
      if (!order) return null

      return {
        ...plan,
        orderNumber: order.orderNumber,
        customer: order.customer,
        productSummary: formatProductSummary(order),
        deliveryDate: order.deliveryDate || '',
      }
    })
    .filter((plan): plan is SmtPlanBlock => plan !== null)
}

export function getDeliveryUrgencyTone(daysUntilDelivery: number | null) {
  if (daysUntilDelivery == null) return 'neutral' as const
  if (daysUntilDelivery < 0) return 'overdue' as const
  if (daysUntilDelivery <= 3) return 'urgent' as const
  return 'normal' as const
}

export function formatDeliveryCountdown(daysUntilDelivery: number | null) {
  if (daysUntilDelivery == null) return ''
  if (daysUntilDelivery < 0) return `D+${Math.abs(daysUntilDelivery)}`
  if (daysUntilDelivery === 0) return 'D-Day'
  return `D-${daysUntilDelivery}`
}
