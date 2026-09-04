import { addDaysYmd, todayYmdSeoul } from '@/lib/orders/utils'
import {
  formatWeekRangeLabel,
  formatYmdLocal,
  getWeekDates,
  getWeekStartMondayYmd,
  parseYmdToLocalDate,
} from '@/lib/smt/plan/utils'

export type MonthCalendarCell = {
  ymd: string
  day: number
  inMonth: boolean
  isToday: boolean
}

export type WeekCalendarCell = {
  ymd: string
  day: number
  weekdayIndex: number
  isToday: boolean
}

export const MONTH_WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 주간 캘린더 헤더 — 월요일 시작 */
export const WEEK_WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const

export function getMonthStartYmd(baseYmd: string = todayYmdSeoul()) {
  const date = parseYmdToLocalDate(baseYmd)
  if (Number.isNaN(date.getTime())) return todayYmdSeoul().slice(0, 8) + '01'
  return formatYmdLocal(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function getWeekStartYmd(baseYmd: string = todayYmdSeoul()) {
  return getWeekStartMondayYmd(baseYmd)
}

export function addMonthsYmd(ymd: string, months: number) {
  const date = parseYmdToLocalDate(getMonthStartYmd(ymd))
  date.setMonth(date.getMonth() + months)
  return formatYmdLocal(date)
}

export function addWeeksYmd(ymd: string, weeks: number) {
  return addDaysYmd(getWeekStartYmd(ymd), weeks * 7)
}

export function formatMonthLabel(monthStartYmd: string) {
  const date = parseYmdToLocalDate(monthStartYmd)
  if (Number.isNaN(date.getTime())) return monthStartYmd
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`
}

export function formatWeekLabel(weekStartYmd: string) {
  return formatWeekRangeLabel(getWeekStartYmd(weekStartYmd))
}

export function buildMonthGrid(monthStartYmd: string): MonthCalendarCell[] {
  const today = todayYmdSeoul()
  const start = parseYmdToLocalDate(monthStartYmd)
  if (Number.isNaN(start.getTime())) return []

  const year = start.getFullYear()
  const month = start.getMonth()
  const gridStart = new Date(year, month, 1 - start.getDay())
  const cells: MonthCalendarCell[] = []

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const ymd = formatYmdLocal(date)
    cells.push({
      ymd,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: ymd === today,
    })
  }

  return cells
}

export function buildWeekGrid(weekStartYmd: string): WeekCalendarCell[] {
  const today = todayYmdSeoul()
  const start = getWeekStartYmd(weekStartYmd)
  return getWeekDates(start).map((ymd, index) => {
    const date = parseYmdToLocalDate(ymd)
    return {
      ymd,
      day: Number.isNaN(date.getTime()) ? index + 1 : date.getDate(),
      weekdayIndex: index,
      isToday: ymd === today,
    }
  })
}

export function isYmdInMonth(ymd: string, monthStartYmd: string) {
  return ymd.slice(0, 7) === monthStartYmd.slice(0, 7)
}

export function isYmdInWeek(ymd: string, weekStartYmd: string) {
  const start = getWeekStartYmd(weekStartYmd)
  const end = addDaysYmd(start, 6)
  const date = ymd.slice(0, 10)
  return date >= start && date <= end
}
