import type { MaterialInboundStatus } from '@/lib/materials/material-inbound-status'
import type { ProductionPlanBoardRow, ProductionPlanScope } from './types'

export type ProductionPlanPipelineBuckets = {
  materialWaiting: ProductionPlanBoardRow[]
  smtWaiting: ProductionPlanBoardRow[]
  postWaitingReady: ProductionPlanBoardRow[]
  postWaitingBlocked: ProductionPlanBoardRow[]
}

/** SMD 계획 가능 — 입고완료·입고예정(가용) 또는 BOM 없음 */
export function canPlanSmt(row: ProductionPlanBoardRow): boolean {
  if (row.scope !== 'smt' || row.status !== 'waiting') return false
  if (row.materialUnknown || row.materialInboundStatus === 'no_bom') return true
  if (row.materialInboundStatus === 'ready' && row.materialReadyQty > 0) return true
  if (row.materialInboundStatus === 'scheduled' && (row.materialScheduledQty ?? 0) > 0) {
    return true
  }
  if (row.materialReadyQty > 0) return true
  return false
}

/** 후공정 계획 가능 — 해당 발주 SMD 계획 확정 후 (SMD 없는 발주는 바로 가능) */
export function canPlanPost(row: ProductionPlanBoardRow, rows: ProductionPlanBoardRow[]): boolean {
  if (row.scope !== 'post' || row.status !== 'waiting') return false
  const smtRows = rows.filter((entry) => entry.orderId === row.orderId && entry.scope === 'smt')
  if (smtRows.length === 0) return true
  return smtRows.some((entry) => entry.status === 'confirmed' && entry.plannedDate.trim())
}

export function getSmtPlannedEndDate(orderId: string, rows: ProductionPlanBoardRow[]): string {
  const dates = rows
    .filter(
      (entry) =>
        entry.orderId === orderId &&
        entry.scope === 'smt' &&
        entry.status === 'confirmed' &&
        /^\d{4}-\d{2}-\d{2}$/.test(entry.plannedDate.slice(0, 10)),
    )
    .map((entry) => entry.plannedDate.slice(0, 10))
  if (!dates.length) return ''
  return dates.reduce((latest, date) => (date >= latest ? date : latest))
}

export function validatePostPlanDate(
  row: ProductionPlanBoardRow,
  plannedDate: string,
  rows: ProductionPlanBoardRow[],
): { ok: true } | { ok: false; detail: string } {
  const smtEnd = row.smtPlannedEndDate || getSmtPlannedEndDate(row.orderId, rows)
  if (!smtEnd) return { ok: true }
  const date = plannedDate.slice(0, 10)
  if (date < smtEnd) {
    return {
      ok: false,
      detail: `후공정 시작(${date})이 SMD 종료(${smtEnd})보다 빠릅니다. SMD 종료 이후로 잡아 주세요.`,
    }
  }
  return { ok: true }
}

export function bucketProductionPlanRows(rows: ProductionPlanBoardRow[]): ProductionPlanPipelineBuckets {
  const materialWaiting: ProductionPlanBoardRow[] = []
  const smtWaiting: ProductionPlanBoardRow[] = []
  const postWaitingReady: ProductionPlanBoardRow[] = []
  const postWaitingBlocked: ProductionPlanBoardRow[] = []

  for (const row of rows) {
    if (row.status !== 'waiting') continue

    if (row.scope === 'smt') {
      if (canPlanSmt(row)) smtWaiting.push(row)
      else materialWaiting.push(row)
      continue
    }

    if (row.scope === 'post') {
      if (canPlanPost(row, rows)) postWaitingReady.push(row)
      else postWaitingBlocked.push(row)
    }
  }

  return { materialWaiting, smtWaiting, postWaitingReady, postWaitingBlocked }
}

/** 팀 탭별 캘린더 대기함 — 해당 scope의 waiting 행 */
export function getProductionPlanWaitingRows(
  rows: ProductionPlanBoardRow[],
  scope: ProductionPlanScope,
): ProductionPlanBoardRow[] {
  if (scope === 'material') {
    return rows.filter((row) => row.scope === 'material' && row.status === 'waiting')
  }

  const buckets = bucketProductionPlanRows(rows)
  if (scope === 'smt') return buckets.smtWaiting
  return [...buckets.postWaitingReady, ...buckets.postWaitingBlocked]
}

export function filterPipelineRows(rows: ProductionPlanBoardRow[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => {
    const haystack = [
      row.orderNumber,
      row.customer,
      row.productName,
      row.productCode,
      row.deliveryDate,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function materialStatusLabel(status: MaterialInboundStatus | undefined) {
  if (status === 'ready') return '입고완료'
  if (status === 'scheduled') return '입고예정'
  if (status === 'missing') return '구매발주필요'
  if (status === 'no_bom') return ''
  return '자재확인중'
}
