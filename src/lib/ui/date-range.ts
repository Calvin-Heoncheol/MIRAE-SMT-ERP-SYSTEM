/** YYYY-MM-DD 기간 필터 (시작·종료 중 빈 값은 해당 쪽 제한 없음) */
export type DateRangeFilterValue = {
  startDate?: string
  endDate?: string
}

export function matchesDateRange(dateValue: string | null | undefined, range: DateRangeFilterValue) {
  let start = range.startDate?.trim() || ''
  let end = range.endDate?.trim() || ''
  if (!start && !end) return true

  // YYYY-MM-DD 만 비교 (타임스탬프·시분초 섞여도 일자 기준)
  const date = (dateValue ?? '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false

  // 한쪽만 있으면 그 날짜 하루만
  if (start && !end) end = start
  if (end && !start) start = end

  start = start.slice(0, 10)
  end = end.slice(0, 10)

  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

export function hasDateRangeFilter(range: DateRangeFilterValue) {
  return Boolean(range.startDate?.trim() || range.endDate?.trim())
}
