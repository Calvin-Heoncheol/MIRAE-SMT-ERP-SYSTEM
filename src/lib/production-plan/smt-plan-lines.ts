import {
  canPlanSmt,
  productionPlanRowBlockReason,
} from '@/lib/production-plan/pipeline'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import {
  isProductionPlanRemainderRow,
  isProductionPlanScheduleRow,
} from '@/lib/production-plan/utils'

export type SmtPlanLineFilter = 'now' | 'all'

export type SmtPlanLineGroup = {
  targetId: string
  orderId: string
  orderNumber: string
  customer: string
  productName: string
  productCode: string
  deliveryDate: string
  daysUntilDelivery: number | null
  remainingQty: number
  orderQty: number
  materialReadyQty: number
  materialShort: boolean
  materialLabel: string
  materialSchedules: ProductionPlanBoardRow[]
  materialPlanRow: ProductionPlanBoardRow | null
  materialUnplannedQty: number
  plannedTotal: number
  unplannedQty: number
  schedules: ProductionPlanBoardRow[]
  planRow: ProductionPlanBoardRow
  canPlan: boolean
  blockReason: string
  /** 지금 새로 잡을 수 있는 수량 */
  availableQty: number
  smtComplete: boolean
}

function computeSmtAvailableQty(
  materialReadyQty: number,
  unplannedQty: number,
  plannedTotal: number,
) {
  if (unplannedQty <= 0 || materialReadyQty <= 0) return 0
  return Math.min(unplannedQty, Math.max(0, materialReadyQty - plannedTotal))
}

function materialLabelForRow(materialReadyQty: number) {
  if (materialReadyQty <= 0) return '입고 미입력'
  return `입고 ${materialReadyQty.toLocaleString('ko-KR')}대`
}

export function buildSmtPlanLineGroups(rows: ProductionPlanBoardRow[]): SmtPlanLineGroup[] {
  const byTarget = new Map<string, ProductionPlanBoardRow[]>()

  for (const row of rows) {
    if (row.scope !== 'smt') continue
    const list = byTarget.get(row.targetId) ?? []
    list.push(row)
    byTarget.set(row.targetId, list)
  }

  const groups: SmtPlanLineGroup[] = []

  for (const [targetId, lineRows] of byTarget) {
    const rep =
      lineRows.find((row) => isProductionPlanRemainderRow(row)) ??
      lineRows.find((row) => row.status === 'waiting') ??
      lineRows[0]
    if (!rep) continue

    const materialLineRows = rows.filter(
      (row) => row.scope === 'material' && row.targetId === targetId,
    )
    const materialSchedules = materialLineRows.filter((row) => isProductionPlanScheduleRow(row))
    const materialRemainder = materialLineRows.find((row) => isProductionPlanRemainderRow(row))
    const materialPlanRow =
      materialRemainder ??
      materialLineRows.find((row) => row.status === 'waiting') ??
      materialSchedules[0] ??
      null
    const materialPlannedTotal = materialSchedules.reduce(
      (sum, row) => sum + Math.max(0, row.plannedQuantity ?? 0),
      0,
    )
    const materialUnplannedQty =
      materialRemainder?.unplannedQty ?? Math.max(0, rep.remainingQty - materialPlannedTotal)

    const schedules = lineRows.filter((row) => isProductionPlanScheduleRow(row))
    const plannedTotal = schedules.reduce(
      (sum, row) => sum + Math.max(0, row.plannedQuantity ?? 0),
      0,
    )
    const remainder = lineRows.find((row) => isProductionPlanRemainderRow(row))
    const unplannedQty =
      remainder?.unplannedQty ?? Math.max(0, rep.remainingQty - plannedTotal)
    const planRow = remainder ?? lineRows.find((row) => row.status === 'waiting') ?? rep
    const materialReadyQty = rep.materialReadyQty
    const availableQty = computeSmtAvailableQty(materialReadyQty, unplannedQty, plannedTotal)
    const canPlan = canPlanSmt(planRow) && unplannedQty > 0 && availableQty > 0

    groups.push({
      targetId,
      orderId: rep.orderId,
      orderNumber: rep.orderNumber,
      customer: rep.customer,
      productName: rep.productName,
      productCode: rep.productCode,
      deliveryDate: rep.deliveryDate,
      daysUntilDelivery: rep.daysUntilDelivery,
      remainingQty: rep.remainingQty,
      orderQty: rep.orderQty,
      materialReadyQty,
      materialShort: rep.materialShort,
      materialLabel: materialLabelForRow(materialReadyQty),
      materialSchedules,
      materialPlanRow,
      materialUnplannedQty,
      plannedTotal,
      unplannedQty,
      schedules,
      planRow,
      canPlan,
      blockReason: productionPlanRowBlockReason(planRow, rows),
      availableQty,
      smtComplete: unplannedQty <= 0 && plannedTotal > 0,
    })
  }

  return groups.sort((a, b) => {
    if (a.canPlan !== b.canPlan) return a.canPlan ? -1 : 1
    const aDue = a.daysUntilDelivery ?? 9999
    const bDue = b.daysUntilDelivery ?? 9999
    if (aDue !== bDue) return aDue - bDue
    return a.orderNumber.localeCompare(b.orderNumber, 'ko')
  })
}

export function filterSmtPlanLineGroups(
  groups: SmtPlanLineGroup[],
  filter: SmtPlanLineFilter,
) {
  if (filter === 'all') return groups
  return groups.filter(
    (group) =>
      group.canPlan ||
      group.schedules.length > 0 ||
      (group.materialReadyQty <= 0 && !group.smtComplete) ||
      group.materialUnplannedQty > 0,
  )
}

export function searchSmtPlanLineGroups(groups: SmtPlanLineGroup[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return groups
  return groups.filter((group) => {
    const haystack = [
      group.orderNumber,
      group.customer,
      group.productName,
      group.productCode,
      group.deliveryDate,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function progressRatio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return Math.max(0, Math.min(1, numerator / denominator))
}
