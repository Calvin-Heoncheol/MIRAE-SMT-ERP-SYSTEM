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

/**
 * 후공정 시작이 SMT 종료보다 이르면 안 됨.
 * smtEnds: 해당 발주의 SMT 계획 종료일들
 */
export function validatePostAfterSmt(input: {
  postStart: string
  smtEndDates: string[]
}): { ok: true } | { ok: false; detail: string } {
  const postStart = String(input.postStart || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(postStart)) {
    return { ok: false, detail: '후공정 시작일 형식이 올바르지 않습니다.' }
  }
  const ends = input.smtEndDates
    .map((d) => String(d || '').slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  if (!ends.length) return { ok: true }
  const latestSmtEnd = ends.reduce((a, b) => (a >= b ? a : b))
  if (postStart < latestSmtEnd) {
    return {
      ok: false,
      detail: `후공정 시작(${postStart})이 SMT 종료(${latestSmtEnd})보다 빠릅니다. SMT 종료 이후로 잡아 주세요.`,
    }
  }
  return { ok: true }
}
