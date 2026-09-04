import { canPlanPost, canPlanSmt } from '@/lib/production-plan/pipeline'
import { buildSmtPlanLineGroups } from '@/lib/production-plan/smt-plan-lines'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import { isProductionPlanRemainderRow, isProductionPlanScheduleRow } from '@/lib/production-plan/utils'
import { isYmdInMonth } from '@/lib/production-plan/calendar'

export type UnifiedPlanFilter = 'now' | 'all' | 'month'

export type UnifiedPlanSheetLineKind = 'main' | 'material_entry' | 'smt_entry' | 'post_entry'

export type UnifiedPlanRowKind = 'smt_work' | 'post_work'

export type UnifiedPlanSheetLine = {
  key: string
  kind: UnifiedPlanSheetLineKind
  rowKind: UnifiedPlanRowKind
  targetId: string
  rep: ProductionPlanBoardRow
  materialRow: ProductionPlanBoardRow | null
  smtRow: ProductionPlanBoardRow | null
  postRow: ProductionPlanBoardRow | null
}

function syntheticMaterialRow(rep: ProductionPlanBoardRow): ProductionPlanBoardRow {
  return {
    ...rep,
    scope: 'material',
    key: `material:${rep.targetId}`,
    status: 'waiting',
    rowKind: 'remainder',
    plannedDate: '',
    plannedQuantity: null,
    lineNo: null,
    team: '',
    pcbSide: 'SINGLE',
    plannedTotalQty: 0,
    unplannedQty: rep.remainingQty,
  }
}

function syntheticPostRow(rep: ProductionPlanBoardRow): ProductionPlanBoardRow {
  return {
    ...rep,
    scope: 'post',
    key: `post:${rep.targetId}`,
    status: 'waiting',
    rowKind: 'remainder',
    plannedDate: '',
    plannedQuantity: null,
    lineNo: null,
    team: rep.team || '',
    pcbSide: 'SINGLE',
    plannedTotalQty: 0,
    unplannedQty: rep.remainingQty,
  }
}

function buildSmtUnifiedLines(rows: ProductionPlanBoardRow[]): UnifiedPlanSheetLine[] {
  const groups = buildSmtPlanLineGroups(rows)
  const lines: UnifiedPlanSheetLine[] = []

  for (const group of groups) {
    const materialRemainder =
      group.materialPlanRow ??
      (group.materialSchedules.find((row) => isProductionPlanRemainderRow(row)) ?? null)
    const smtRemainder = group.planRow

    lines.push({
      key: `main:smt:${group.targetId}`,
      kind: 'main',
      rowKind: 'smt_work',
      targetId: group.targetId,
      rep: group.planRow,
      materialRow: materialRemainder ?? syntheticMaterialRow(group.planRow),
      smtRow: smtRemainder,
      postRow: null,
    })

    for (const schedule of group.materialSchedules) {
      if (isProductionPlanRemainderRow(schedule)) continue
      lines.push({
        key: schedule.key,
        kind: 'material_entry',
        rowKind: 'smt_work',
        targetId: group.targetId,
        rep: group.planRow,
        materialRow: schedule,
        smtRow: null,
        postRow: null,
      })
    }

    for (const schedule of group.schedules) {
      if (isProductionPlanRemainderRow(schedule)) continue
      lines.push({
        key: schedule.key,
        kind: 'smt_entry',
        rowKind: 'smt_work',
        targetId: group.targetId,
        rep: group.planRow,
        materialRow: null,
        smtRow: schedule,
        postRow: null,
      })
    }
  }

  return lines
}

function buildPostUnifiedLines(rows: ProductionPlanBoardRow[]): UnifiedPlanSheetLine[] {
  const byTarget = new Map<string, ProductionPlanBoardRow[]>()

  for (const row of rows) {
    if (row.scope !== 'post') continue
    const list = byTarget.get(row.targetId) ?? []
    list.push(row)
    byTarget.set(row.targetId, list)
  }

  const lines: UnifiedPlanSheetLine[] = []

  for (const [targetId, lineRows] of byTarget) {
    const rep =
      lineRows.find((row) => isProductionPlanRemainderRow(row)) ??
      lineRows.find((row) => row.status === 'waiting') ??
      lineRows[0]
    if (!rep) continue

    const postRemainder =
      lineRows.find((row) => isProductionPlanRemainderRow(row)) ??
      lineRows.find((row) => row.status === 'waiting') ??
      null

    lines.push({
      key: `main:post:${targetId}`,
      kind: 'main',
      rowKind: 'post_work',
      targetId,
      rep,
      materialRow: null,
      smtRow: null,
      postRow: postRemainder ?? syntheticPostRow(rep),
    })

    for (const schedule of lineRows) {
      if (!isProductionPlanScheduleRow(schedule)) continue
      lines.push({
        key: schedule.key,
        kind: 'post_entry',
        rowKind: 'post_work',
        targetId,
        rep,
        materialRow: null,
        smtRow: null,
        postRow: schedule,
      })
    }
  }

  return lines
}

function sortUnifiedLines(a: UnifiedPlanSheetLine, b: UnifiedPlanSheetLine) {
  const aDue = a.rep.daysUntilDelivery ?? 9999
  const bDue = b.rep.daysUntilDelivery ?? 9999
  if (aDue !== bDue) return aDue - bDue
  if (a.rep.orderNumber !== b.rep.orderNumber) {
    return a.rep.orderNumber.localeCompare(b.rep.orderNumber, 'ko')
  }
  if (a.rowKind !== b.rowKind) {
    return a.rowKind === 'smt_work' ? -1 : 1
  }
  const kindOrder: Record<UnifiedPlanSheetLineKind, number> = {
    main: 0,
    material_entry: 1,
    smt_entry: 2,
    post_entry: 3,
  }
  return kindOrder[a.kind] - kindOrder[b.kind]
}

export function buildUnifiedPlanSheetLines(rows: ProductionPlanBoardRow[]): UnifiedPlanSheetLine[] {
  return [...buildSmtUnifiedLines(rows), ...buildPostUnifiedLines(rows)].sort(sortUnifiedLines)
}

function isActiveSmtMainLine(line: UnifiedPlanSheetLine) {
  if (line.kind !== 'main' || line.rowKind !== 'smt_work') return false
  const remaining = line.rep.remainingQty
  if (remaining <= 0) return false
  const materialReady = line.rep.materialReadyQty
  const smtUnplanned = line.smtRow?.unplannedQty ?? remaining
  const materialUnplanned = line.materialRow?.unplannedQty ?? remaining
  if (materialUnplanned > 0 || materialReady < remaining) return true
  if (materialReady > 0 && smtUnplanned > 0 && line.smtRow && canPlanSmt(line.smtRow)) return true
  return false
}

function isActivePostMainLine(line: UnifiedPlanSheetLine) {
  if (line.kind !== 'main' || line.rowKind !== 'post_work') return false
  const remaining = line.rep.remainingQty
  if (remaining <= 0) return false
  const postUnplanned = line.postRow?.unplannedQty ?? remaining
  return postUnplanned > 0
}

export function filterUnifiedPlanSheetLines(
  lines: UnifiedPlanSheetLine[],
  filter: UnifiedPlanFilter,
  monthStart: string,
  allRows: ProductionPlanBoardRow[],
) {
  if (filter === 'all') {
    return lines.filter((line) => line.kind === 'main' && line.rep.remainingQty > 0)
  }

  if (filter === 'now') {
    return lines.filter((line) => isActiveSmtMainLine(line) || isActivePostMainLine(line))
  }

  return lines.filter((line) => {
    if (line.kind === 'main') return line.rep.remainingQty > 0
    const schedule = line.materialRow ?? line.smtRow ?? line.postRow
    if (!schedule || !isProductionPlanScheduleRow(schedule)) return false
    return isYmdInMonth(schedule.plannedDate, monthStart)
  })
}

export function searchUnifiedPlanSheetLines(lines: UnifiedPlanSheetLine[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return lines
  return lines.filter((line) => {
    const haystack = [
      line.rep.orderNumber,
      line.rep.customer,
      line.rep.productName,
      line.rep.productCode,
      line.rep.deliveryDate,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function canEditPostRow(row: ProductionPlanBoardRow, allRows: ProductionPlanBoardRow[]) {
  if (row.status === 'confirmed') return true
  return canPlanPost(row, allRows)
}

/** 해당 줄 기준 아직 계획하지 않은 수량 (단계별) */
export function lineUnplannedQty(line: UnifiedPlanSheetLine): number {
  if (line.rowKind === 'post_work') {
    return Math.max(0, line.postRow?.unplannedQty ?? line.rep.remainingQty)
  }
  if (line.kind === 'material_entry' && line.materialRow) {
    return Math.max(0, line.materialRow.unplannedQty ?? 0)
  }
  if (line.smtRow) {
    return Math.max(0, line.smtRow.unplannedQty ?? line.rep.remainingQty)
  }
  if (line.materialRow && isProductionPlanRemainderRow(line.materialRow)) {
    return Math.max(0, line.materialRow.unplannedQty ?? line.rep.remainingQty)
  }
  return Math.max(0, line.rep.remainingQty)
}

export type PlanningScopeFilter = 'all' | ProductionPlanBoardRow['scope']

/** 캘린더 배정 시 다음으로 잡을 board row (자재 → SMT → 후공정 순) */
export function pickPlanningRowForLine(
  line: UnifiedPlanSheetLine,
  scopeFilter: PlanningScopeFilter = 'all',
): ProductionPlanBoardRow | null {
  if (line.kind !== 'main') return null

  if (line.rowKind === 'post_work') {
    if (scopeFilter !== 'all' && scopeFilter !== 'post') return null
    const row = line.postRow
    if (!row || (row.unplannedQty ?? 0) <= 0) return null
    return row
  }

  if (scopeFilter === 'post') return null

  const materialUnplanned = line.materialRow?.unplannedQty ?? 0
  // 자재 입고는 별도 메뉴에서 처리 — 생산계획 캘린더에서는 SMT/후공정만 배정
  if (scopeFilter === 'material') {
    return materialUnplanned > 0 && line.materialRow ? line.materialRow : null
  }

  const smtUnplanned = line.smtRow?.unplannedQty ?? 0
  if (
    (scopeFilter === 'all' || scopeFilter === 'smt') &&
    smtUnplanned > 0 &&
    line.smtRow &&
    canPlanSmt(line.smtRow)
  ) {
    return line.smtRow
  }

  if (scopeFilter === 'smt') return line.smtRow
  return null
}

export function planningStageLabel(row: ProductionPlanBoardRow | null) {
  if (!row) return ''
  if (row.scope === 'material') return '자재 입고'
  if (row.scope === 'smt') return 'SMT'
  return '후공정'
}
