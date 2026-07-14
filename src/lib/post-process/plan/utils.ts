import type { OrderListGroup } from '@/lib/orders/types'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'
import {
  formatProductionProductName,
  resolveProductionCount,
} from '@/lib/production-input/utils'
import {
  daysUntilYmd,
  formatCalendarDayLabel,
  formatDeliveryCountdown,
  formatWeekdayLabel,
  formatWeekRangeLabel,
  getDeliveryUrgencyTone,
  getWeekDates,
  getWeekEndYmd,
  getWeekStartMondayYmd,
  resolveSmtPlanExecutionStatus,
  type SmtPlanExecutionStatus,
} from '@/lib/smt/plan/utils'
import type {
  PostProcessPlanBlock,
  PostProcessPlanOrderCandidate,
  PostProcessProductionPlan,
} from './types'

export {
  daysUntilYmd,
  formatCalendarDayLabel,
  formatDeliveryCountdown,
  formatWeekdayLabel,
  formatWeekRangeLabel,
  getDeliveryUrgencyTone,
  getWeekDates,
  getWeekEndYmd,
  getWeekStartMondayYmd,
  resolveSmtPlanExecutionStatus,
}

export type PostProcessPlanExecutionStatus = SmtPlanExecutionStatus

function sumPlannedByAssemblyGroup(plans: PostProcessProductionPlan[]) {
  const map = new Map<string, number>()
  for (const plan of plans) {
    if (!plan.assemblyGroupId) continue
    map.set(plan.assemblyGroupId, (map.get(plan.assemblyGroupId) ?? 0) + plan.plannedQuantity)
  }
  return map
}

export function buildPostProcessPlanOrderCandidates(
  orders: OrderListGroup[],
  lines: ProductionOrderLine[],
  counts: ProductionCounts,
  allPlans: PostProcessProductionPlan[],
  options?: { onlyUnplanned?: boolean },
): PostProcessPlanOrderCandidate[] {
  const plannedByGroup = sumPlannedByAssemblyGroup(allPlans)
  const orderById = Object.fromEntries(orders.map((order) => [order.orderId, order]))
  const today = todayYmdSeoul()
  const onlyUnplanned = options?.onlyUnplanned !== false

  return lines
    .map((line) => {
      const assemblyGroupId = line.assemblyGroupId || line.orderLineId
      const order = orderById[line.orderId]
      const deliveryDate = order?.deliveryDate || ''
      const target = Math.max(0, Math.floor(line.quantity))
      const produced = resolveProductionCount(line, counts)
      const remaining = Math.max(0, target - produced)
      const plannedTotal = plannedByGroup.get(assemblyGroupId) ?? 0
      const unplannedRemaining = Math.max(0, remaining - plannedTotal)

      return {
        orderId: line.orderId,
        assemblyGroupId,
        orderNumber: line.orderNumber,
        customer: line.customer,
        productSummary: formatProductionProductName(line),
        deliveryDate,
        target,
        produced,
        remaining,
        plannedTotal,
        unplannedRemaining,
        daysUntilDelivery: deliveryDate ? daysUntilYmd(today, deliveryDate) : null,
      }
    })
    .filter((line) => (onlyUnplanned ? line.unplannedRemaining > 0 : line.target > 0))
    .sort((a, b) => {
      const aDue = a.daysUntilDelivery ?? 9999
      const bDue = b.daysUntilDelivery ?? 9999
      if (aDue !== bDue) return aDue - bDue
      if (a.orderNumber !== b.orderNumber) return b.orderNumber.localeCompare(a.orderNumber)
      return a.productSummary.localeCompare(b.productSummary)
    })
}

export function buildPostProcessPlanBlocks(
  weekPlans: PostProcessProductionPlan[],
  orders: OrderListGroup[],
  lines: ProductionOrderLine[],
): PostProcessPlanBlock[] {
  const orderById = Object.fromEntries(orders.map((order) => [order.orderId, order]))
  const lineById = Object.fromEntries(
    lines.map((line) => [line.assemblyGroupId || line.orderLineId, line]),
  )

  return weekPlans
    .map((plan) => {
      const order = orderById[plan.orderId]
      const line = lineById[plan.assemblyGroupId]
      if (!order && !line) return null

      return {
        ...plan,
        orderNumber: line?.orderNumber || order?.orderNumber || '',
        customer: line?.customer || order?.customer || '',
        productSummary: line
          ? formatProductionProductName(line)
          : order?.items?.[0]?.productName || order?.orderNumber || '',
        deliveryDate: order?.deliveryDate || '',
      }
    })
    .filter((plan): plan is PostProcessPlanBlock => plan !== null)
}
