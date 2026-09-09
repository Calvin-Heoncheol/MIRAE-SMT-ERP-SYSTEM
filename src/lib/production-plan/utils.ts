import { todayYmdSeoul } from '@/lib/orders/utils'
import { daysUntilYmd } from '@/lib/smt/plan/utils'
import type { ProductionPlanBoardRow, ProductionPlanBoardStatus, ProductionPlanScope } from './types'

export function productionPlanRowKey(scope: ProductionPlanScope, targetId: string, suffix?: string) {
  return suffix ? `${scope}:${targetId}:${suffix}` : `${scope}:${targetId}`
}

export function productionPlanRemainderRowKey(scope: ProductionPlanScope, targetId: string) {
  return productionPlanRowKey(scope, targetId, 'remainder')
}

export function isProductionPlanRemainderRow(row: Pick<ProductionPlanBoardRow, 'key' | 'rowKind'>) {
  return row.rowKind === 'remainder' || row.key.endsWith(':remainder')
}

export function isProductionPlanScheduleRow(row: Pick<ProductionPlanBoardRow, 'status' | 'rowKind' | 'key' | 'plannedDate'>) {
  if (isProductionPlanRemainderRow(row)) return false
  if (row.rowKind === 'schedule') return row.status === 'confirmed'
  return row.status === 'confirmed' && Boolean(row.plannedDate.trim())
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

/** SMT 양면: 발주 수량 − 면별 실적 − 면별 계획 = 미계획 */
export function computeSmtSideUnplannedQty(
  rows: ProductionPlanBoardRow[],
  targetId: string,
  orderQty: number,
  options?: { excludePlanKey?: string },
): { top: number; bot: number } {
  const excludeKey = String(options?.excludePlanKey || '').trim()
  const rep = rows.find((row) => row.scope === 'smt' && row.targetId === targetId)

  let plannedTop = 0
  let plannedBot = 0
  for (const row of rows) {
    if (row.scope !== 'smt' || row.targetId !== targetId) continue
    if (!isProductionPlanScheduleRow(row)) continue
    if (excludeKey && row.key === excludeKey) continue
    const qty = Math.max(0, Math.round(Number(row.plannedQuantity) || 0))
    if (row.pcbSide === 'TOP' || row.pcbSide === 'BOTH') plannedTop += qty
    if (row.pcbSide === 'BOT' || row.pcbSide === 'BOTH') plannedBot += qty
  }

  const cap = Math.max(0, Math.round(Number(orderQty) || 0))
  const producedTop = Math.max(0, Math.round(Number(rep?.producedQtyTop) || 0))
  const producedBot = Math.max(0, Math.round(Number(rep?.producedQtyBot) || 0))

  // 보드에 면별 미계획이 이미 있고, 편집 제외가 없으면 그대로 사용
  if (
    !excludeKey &&
    (rep?.unplannedQtyTop != null || rep?.unplannedQtyBot != null)
  ) {
    return {
      top: Math.max(0, Math.round(Number(rep?.unplannedQtyTop) || 0)),
      bot: Math.max(0, Math.round(Number(rep?.unplannedQtyBot) || 0)),
    }
  }

  return {
    top: Math.max(0, cap - producedTop - plannedTop),
    bot: Math.max(0, cap - producedBot - plannedBot),
  }
}

/** 일정 모달 계획 수량 상한 (양면은 선택 면 기준) */
export function resolveScheduleMaxQuantity(
  row: ProductionPlanBoardRow,
  pcbSide: ProductionPlanPcbSide,
  allRows: ProductionPlanBoardRow[] = [],
): number {
  const materialCap =
    row.materialShort && row.materialReadyQty > 0 ? row.materialReadyQty : null

  if (row.scope === 'smt' && row.splitPcbSides) {
    const sides = computeSmtSideUnplannedQty(allRows, row.targetId, row.orderQty, {
      excludePlanKey: isProductionPlanScheduleRow(row) ? row.key : undefined,
    })
    let sideCap =
      pcbSide === 'BOT'
        ? sides.bot
        : pcbSide === 'BOTH'
          ? Math.min(sides.top, sides.bot)
          : sides.top
    if (materialCap != null) sideCap = Math.min(sideCap, materialCap)
    return Math.max(0, sideCap)
  }

  if (isProductionPlanRemainderRow(row)) {
    let cap = Math.max(1, row.unplannedQty ?? row.remainingQty)
    if (materialCap != null) cap = Math.min(cap, materialCap)
    return Math.max(1, cap)
  }

  if (isProductionPlanScheduleRow(row) && row.plannedQuantity) {
    let cap = Math.min(row.remainingQty, row.plannedQuantity + (row.unplannedQty ?? 0))
    if (materialCap != null) cap = Math.min(cap, materialCap)
    return Math.max(1, cap)
  }

  let cap = Math.max(1, row.unplannedQty ?? row.remainingQty)
  if (materialCap != null) cap = Math.min(cap, materialCap)
  return Math.max(1, cap)
}
