'use client'

import { ERP_SECONDARY_BUTTON_CLASS } from '@/lib/ui/tokens'
import type { DateRangeFilterLabel } from '@/lib/ui/date-range'

const DATE_INPUT_CLASS =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 shadow-sm outline-none ring-slate-100 focus:border-slate-400 focus:ring-2'

type DateRangeFilterProps = {
  startDate: string
  endDate: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  /** 납기 / 발행일 / 출하일 / 기록일 */
  label: DateRangeFilterLabel
  /** 초기화 시 복원. 현황·이력은 생략(빈 값=전체), 수금·거래명세서는 이번 달 */
  defaultStartDate?: string
  defaultEndDate?: string
  /** 지정 시 초기화가 시작·종료를 따로 비우지 않고 이 콜백만 호출 */
  onClear?: () => void
}

/** 시작일 ~ 종료일. 한쪽만 고르면 같은 날짜로 맞춰 그날만 필터합니다. */
export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  label,
  defaultStartDate = '',
  defaultEndDate = '',
  onClear,
}: DateRangeFilterProps) {
  const hasRange = Boolean(startDate || endDate)
  const atDefault = startDate === defaultStartDate && endDate === defaultEndDate
  const showClear = hasRange && !atDefault

  function handleStartChange(value: string) {
    onStartDateChange(value)
    if (!value) return
    // 종료일이 비어 있으면 같은 날로 맞춰 「그날만」 필터가 되게 함
    if (!endDate) {
      onEndDateChange(value)
      return
    }
    if (value > endDate) {
      onEndDateChange(value)
    }
  }

  function handleEndChange(value: string) {
    onEndDateChange(value)
    if (!value) return
    // 시작일이 비어 있으면 같은 날로 맞춤
    if (!startDate) {
      onStartDateChange(value)
      return
    }
    if (value < startDate) {
      onStartDateChange(value)
    }
  }

  function handleClear() {
    if (onClear) {
      onClear()
      return
    }
    onStartDateChange(defaultStartDate)
    onEndDateChange(defaultEndDate)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${label} 기간`}>
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        type="date"
        value={startDate}
        onChange={(event) => handleStartChange(event.target.value)}
        aria-label={`${label} 시작일`}
        className={DATE_INPUT_CLASS}
      />
      <span className="text-sm font-medium text-slate-400" aria-hidden>
        ~
      </span>
      <input
        type="date"
        value={endDate}
        onChange={(event) => handleEndChange(event.target.value)}
        aria-label={`${label} 종료일`}
        className={DATE_INPUT_CLASS}
      />
      {showClear ? (
        <button
          type="button"
          onClick={handleClear}
          className={`${ERP_SECONDARY_BUTTON_CLASS} !px-2.5 !py-2 text-xs`}
        >
          초기화
        </button>
      ) : null}
    </div>
  )
}
