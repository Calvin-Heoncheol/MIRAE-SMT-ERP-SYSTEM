/** draft=가계획, confirmed=확정 */
export type ProductionPlanStatus = 'draft' | 'confirmed'

export function normalizeProductionPlanStatus(
  value: string | null | undefined,
): ProductionPlanStatus {
  return String(value || '').trim() === 'draft' ? 'draft' : 'confirmed'
}

export function resolvePlannedEndDate(start: string, end?: string | null) {
  const startYmd = String(start || '').slice(0, 10)
  const endYmd = String(end || '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(endYmd) && endYmd >= startYmd) return endYmd
  return startYmd
}

/** 주간과 계획 기간이 겹치면 주간에 표시 */
export function planOverlapsWeek(start: string, end: string, weekStart: string, weekEnd: string) {
  const from = resolvePlannedEndDate(start, start)
  const to = resolvePlannedEndDate(start, end)
  return from <= weekEnd && to >= weekStart
}

export function formatPlanDateRangeLabel(start: string, end?: string | null) {
  const from = String(start || '').slice(0, 10)
  const to = resolvePlannedEndDate(from, end)
  if (!from) return ''
  if (from === to) return from.slice(5).replace('-', '/')
  return `${from.slice(5).replace('-', '/')}~${to.slice(5).replace('-', '/')}`
}