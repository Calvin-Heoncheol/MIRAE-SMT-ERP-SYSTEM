/** YYYY-MM-DD 기간 필터 (시작·종료 중 빈 값은 해당 쪽 제한 없음) */
export type DateRangeFilterValue = {
  startDate?: string
  endDate?: string
}

export function matchesDateRange(dateValue: string | null | undefined, range: DateRangeFilterValue) {
  const start = range.startDate?.trim() || ''
  const end = range.endDate?.trim() || ''
  if (!start && !end) return true

  const date = (dateValue ?? '').trim()
  if (!date) return false
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

export function hasDateRangeFilter(range: DateRangeFilterValue) {
  return Boolean(range.startDate?.trim() || range.endDate?.trim())
}
