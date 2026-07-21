import { addDaysYmd, todayYmdSeoul } from '@/lib/orders/utils'
import {
  formatWeekdayLabel,
  formatWeekRangeLabel,
  getWeekStartMondayYmd,
} from '@/lib/smt/plan/utils'

export type ReportPeriod = 'day' | 'week' | 'month'

export type ResolvedReportPeriod = {
  period: ReportPeriod
  startDate: string
  endDate: string
  rangeLabel: string
  /** ‹ › 이동용 date 쿼리 값 */
  prevDate: string
  nextDate: string
}

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

function sanitizeYmd(value: string, fallback: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

function monthEndYmd(monthStart: string): string {
  const year = Number(monthStart.slice(0, 4))
  const month = Number(monthStart.slice(5, 7))
  const lastDay = new Date(year, month, 0).getDate()
  return `${monthStart.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`
}

function addMonths(monthStart: string, delta: number): string {
  const year = Number(monthStart.slice(0, 4))
  const month = Number(monthStart.slice(5, 7))
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export function resolveReportPeriod(params: {
  period?: string | string[]
  date?: string | string[]
}): ResolvedReportPeriod {
  const rawPeriod = firstParam(params.period)
  const period: ReportPeriod = rawPeriod === 'month' ? 'month' : rawPeriod === 'day' ? 'day' : 'week'
  const anchor = sanitizeYmd(firstParam(params.date), todayYmdSeoul())

  if (period === 'day') {
    return {
      period,
      startDate: anchor,
      endDate: anchor,
      rangeLabel: `${Number(anchor.slice(0, 4))}년 ${Number(anchor.slice(5, 7))}월 ${Number(anchor.slice(8, 10))}일 (${formatWeekdayLabel(anchor)})`,
      prevDate: addDaysYmd(anchor, -1),
      nextDate: addDaysYmd(anchor, 1),
    }
  }

  if (period === 'month') {
    const startDate = `${anchor.slice(0, 7)}-01`
    return {
      period,
      startDate,
      endDate: monthEndYmd(startDate),
      rangeLabel: `${startDate.slice(0, 4)}년 ${Number(startDate.slice(5, 7))}월`,
      prevDate: addMonths(startDate, -1),
      nextDate: addMonths(startDate, 1),
    }
  }

  const startDate = getWeekStartMondayYmd(anchor)
  return {
    period,
    startDate,
    endDate: addDaysYmd(startDate, 6),
    rangeLabel: formatWeekRangeLabel(startDate),
    prevDate: addDaysYmd(startDate, -7),
    nextDate: addDaysYmd(startDate, 7),
  }
}

export function buildReportHrefs(basePath: string, resolved: ResolvedReportPeriod) {
  return {
    prevHref: `${basePath}?period=${resolved.period}&date=${resolved.prevDate}`,
    nextHref: `${basePath}?period=${resolved.period}&date=${resolved.nextDate}`,
    dayHref: `${basePath}?period=day`,
    weekHref: `${basePath}?period=week`,
    monthHref: `${basePath}?period=month`,
  }
}
