import { todayYmdSeoul } from '@/lib/orders/utils'
import { daysUntilYmd } from '@/lib/smt/plan/utils'
import type { ProductionPlanBoardRow, ProductionPlanBoardStatus, ProductionPlanScope } from './types'

export function productionPlanRowKey(scope: ProductionPlanScope, targetId: string) {
  return `${scope}:${targetId}`
}

export function sortProductionPlanRows(rows: ProductionPlanBoardRow[]) {
  return [...rows].sort((a, b) => {
    // 자재 준비됨 우선, 그다음 납기 임박, 미확정/확정은 필터에서
    if (a.materialShort !== b.materialShort) return a.materialShort ? 1 : -1
    if (a.materialUnknown !== b.materialUnknown) return a.materialUnknown ? 1 : -1
    const aDue = a.daysUntilDelivery ?? 9999
    const bDue = b.daysUntilDelivery ?? 9999
    if (aDue !== bDue) return aDue - bDue
    if (a.status !== b.status) return a.status === 'waiting' ? -1 : 1
    if (a.orderNumber !== b.orderNumber) return b.orderNumber.localeCompare(a.orderNumber)
    return a.productName.localeCompare(b.productName, 'ko')
  })
}

export function computeDaysUntilDelivery(deliveryDate: string) {
  const date = deliveryDate.trim().slice(0, 10)
  if (!date) return null
  return daysUntilYmd(todayYmdSeoul(), date)
}

export function formatDeliveryCountdown(daysUntilDelivery: number | null) {
  if (daysUntilDelivery == null) return ''
  if (daysUntilDelivery < 0) return `D+${Math.abs(daysUntilDelivery)}`
  if (daysUntilDelivery === 0) return 'D-Day'
  return `D-${daysUntilDelivery}`
}

export function deliveryUrgencyClass(daysUntilDelivery: number | null) {
  if (daysUntilDelivery == null) return 'text-slate-500'
  if (daysUntilDelivery < 0) return 'font-semibold text-rose-700'
  if (daysUntilDelivery <= 3) return 'font-semibold text-amber-700'
  return 'text-slate-600'
}

export function isConfirmedStatus(status: ProductionPlanBoardStatus) {
  return status === 'confirmed'
}
