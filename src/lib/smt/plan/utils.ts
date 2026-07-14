import type { OrderListGroup } from '@/lib/orders/types'
import { addDaysYmd, todayYmdSeoul } from '@/lib/orders/utils'
import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'
import {
  formatProductionProductName,
  resolveProductionCount,
  resolveProductionSideCount,
} from '@/lib/production-input/utils'
import type { SmtPcbSide } from '@/lib/smt/types'
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

export function normalizeSmtPlanPcbSide(value: string | null | undefined): SmtPcbSide {
  const raw = String(value || 'SINGLE').toUpperCase()
  if (raw === 'TOP' || raw === 'BOT') return raw
  return 'SINGLE'
}

export function plannedSideKey(orderLineId: string, pcbSide: SmtPcbSide) {
  return `${orderLineId}:${pcbSide}`
}

function sumPlannedQuantityByLineSide(plans: SmtProductionPlan[]) {
  const map = new Map<string, number>()
  for (const plan of plans) {
    if (!plan.orderLineId) continue
    const side = normalizeSmtPlanPcbSide(plan.pcbSide)
    const key = plannedSideKey(plan.orderLineId, side)
    map.set(key, (map.get(key) ?? 0) + plan.plannedQuantity)
  }
  return map
}

export function getUnplannedRemainingForSide(
  candidate: Pick<SmtPlanOrderCandidate, 'splitPcbSides' | 'unplannedBySide' | 'unplannedRemaining'>,
  pcbSide: SmtPcbSide,
) {
  if (candidate.splitPcbSides) {
    const side = pcbSide === 'BOT' ? 'BOT' : 'TOP'
    return Math.max(0, candidate.unplannedBySide[side] ?? 0)
  }
  return Math.max(0, candidate.unplannedBySide.SINGLE ?? candidate.unplannedRemaining)
}

export function defaultPcbSideForCandidate(
  candidate: Pick<SmtPlanOrderCandidate, 'splitPcbSides' | 'unplannedBySide'>,
): SmtPcbSide {
  if (!candidate.splitPcbSides) return 'SINGLE'
  const top = candidate.unplannedBySide.TOP ?? 0
  const bot = candidate.unplannedBySide.BOT ?? 0
  if (top > 0) return 'TOP'
  if (bot > 0) return 'BOT'
  return 'TOP'
}

export function computeLineSmtMetrics(line: ProductionOrderLine, smtCounts: ProductionCounts) {
  const smtTarget = Math.max(0, Math.floor(line.quantity))
  const smtProduced = resolveProductionCount(line, smtCounts)
  const smtRemaining = Math.max(0, smtTarget - smtProduced)
  return { smtTarget, smtProduced, smtRemaining }
}

/** @deprecated 주문 합산 — 라인 단위 `computeLineSmtMetrics` 사용 */
export function computeOrderSmtMetrics(
  order: OrderListGroup,
  smtLines: ProductionOrderLine[],
  smtCounts: ProductionCounts,
) {
  const orderSmtLines = smtLines.filter((line) => line.orderNumber === order.orderNumber)
  let smtTarget = 0
  let smtProduced = 0

  for (const smtLine of orderSmtLines) {
    const metrics = computeLineSmtMetrics(smtLine, smtCounts)
    smtTarget += metrics.smtTarget
    smtProduced += metrics.smtProduced
  }

  const smtRemaining = Math.max(0, smtTarget - smtProduced)
  return { smtTarget, smtProduced, smtRemaining }
}

export function buildSmtPlanOrderCandidates(
  orders: OrderListGroup[],
  smtLines: ProductionOrderLine[],
  smtCounts: ProductionCounts,
  allPlans: SmtProductionPlan[],
  options?: { onlyUnplanned?: boolean },
): SmtPlanOrderCandidate[] {
  const plannedBySide = sumPlannedQuantityByLineSide(allPlans)
  const orderById = Object.fromEntries(orders.map((order) => [order.orderId, order]))
  const today = todayYmdSeoul()
  const onlyUnplanned = options?.onlyUnplanned !== false

  const candidates = smtLines
    .map((line) => {
      const order = orderById[line.orderId]
      const smtTarget = Math.max(0, Math.floor(line.quantity))
      const deliveryDate = order?.deliveryDate || ''

      let smtProduced = 0
      let smtRemaining = 0
      let plannedTotal = 0
      let unplannedRemaining = 0
      const unplannedBySide: Partial<Record<SmtPcbSide, number>> = {}

      if (line.splitPcbSides) {
        const topProduced = resolveProductionSideCount(line, smtCounts, 'TOP')
        const botProduced = resolveProductionSideCount(line, smtCounts, 'BOT')
        const plannedTop = plannedBySide.get(plannedSideKey(line.orderLineId, 'TOP')) ?? 0
        const plannedBot = plannedBySide.get(plannedSideKey(line.orderLineId, 'BOT')) ?? 0
        const unplannedTop = Math.max(0, smtTarget - topProduced - plannedTop)
        const unplannedBot = Math.max(0, smtTarget - botProduced - plannedBot)

        smtProduced = Math.min(topProduced, botProduced)
        smtRemaining = Math.max(0, smtTarget - smtProduced)
        plannedTotal = plannedTop + plannedBot
        unplannedRemaining = Math.max(unplannedTop, unplannedBot)
        unplannedBySide.TOP = unplannedTop
        unplannedBySide.BOT = unplannedBot
      } else {
        smtProduced = resolveProductionSideCount(line, smtCounts, 'SINGLE')
        smtRemaining = Math.max(0, smtTarget - smtProduced)
        plannedTotal = plannedBySide.get(plannedSideKey(line.orderLineId, 'SINGLE')) ?? 0
        unplannedRemaining = Math.max(0, smtRemaining - plannedTotal)
        unplannedBySide.SINGLE = unplannedRemaining
      }

      return {
        orderId: line.orderId,
        orderLineId: line.orderLineId,
        orderNumber: line.orderNumber,
        customer: line.customer,
        productSummary: formatProductionProductName(line),
        deliveryDate,
        splitPcbSides: line.splitPcbSides,
        smtTarget,
        smtProduced,
        smtRemaining,
        plannedTotal,
        unplannedRemaining,
        unplannedBySide,
        daysUntilDelivery: deliveryDate ? daysUntilYmd(today, deliveryDate) : null,
      }
    })
    .filter((line) => (onlyUnplanned ? line.unplannedRemaining > 0 : line.smtTarget > 0))
    .sort((a, b) => {
      const aDue = a.daysUntilDelivery ?? 9999
      const bDue = b.daysUntilDelivery ?? 9999
      if (aDue !== bDue) return aDue - bDue
      if (a.orderNumber !== b.orderNumber) return b.orderNumber.localeCompare(a.orderNumber)
      return a.productSummary.localeCompare(b.productSummary)
    })

  return candidates
}

export function buildSmtPlanBlocks(
  weekPlans: SmtProductionPlan[],
  orders: OrderListGroup[],
  smtLines: ProductionOrderLine[] = [],
): SmtPlanBlock[] {
  const orderById = Object.fromEntries(orders.map((order) => [order.orderId, order]))
  const lineById = Object.fromEntries(smtLines.map((line) => [line.orderLineId, line]))

  return weekPlans
    .map((plan) => {
      const order = orderById[plan.orderId]
      if (!order) return null

      const line = plan.orderLineId ? lineById[plan.orderLineId] : undefined

      return {
        ...plan,
        orderNumber: order.orderNumber,
        customer: order.customer,
        productSummary: line
          ? formatProductionProductName(line)
          : order.items?.[0]?.productName || order.orderNumber,
        deliveryDate: order.deliveryDate || '',
        splitPcbSides: Boolean(line?.splitPcbSides),
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

/** 계획 대비 생산 진행 상태 */
export type SmtPlanExecutionStatus = 'ready' | 'progress' | 'done'

export function resolveSmtPlanExecutionStatus(
  plannedQuantity: number,
  producedQuantity: number,
): SmtPlanExecutionStatus {
  const planned = Math.max(0, Math.floor(plannedQuantity))
  const produced = Math.max(0, Math.floor(producedQuantity))
  if (planned > 0 && produced >= planned) return 'done'
  if (produced > 0) return 'progress'
  return 'ready'
}

export function resolveSmtLinePlanExecutionStatus(
  statuses: SmtPlanExecutionStatus[],
): 'idle' | SmtPlanExecutionStatus {
  if (!statuses.length) return 'idle'
  if (statuses.every((status) => status === 'done')) return 'done'
  if (statuses.every((status) => status === 'ready')) return 'ready'
  return 'progress'
}

