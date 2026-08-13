/**
 * 날짜 필터 정책
 * - 현황·이력: 기본 전체(빈 값). 초기화 → 빈 값
 * - 수금·거래명세서: 기본 이번 달(?start&end URL). 초기화 → 이번 달
 * - 라벨: 필터 대상 날짜만 사용
 *   현황 → 납기 / 수금·거래명세서 → 발행일 / 출하등록 → 출하일 / 생산이력 → 기록일
 */
export const DATE_RANGE_FILTER_LABEL = {
  due: '납기',
  issue: '발행일',
  ship: '출하일',
  record: '기록일',
} as const

export type DateRangeFilterLabel =
  (typeof DATE_RANGE_FILTER_LABEL)[keyof typeof DATE_RANGE_FILTER_LABEL]

export const EMPTY_DATE_RANGE = { startDate: '', endDate: '' } as const

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
