'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ReportPeriod } from '@/lib/reports/period'

type ReportPeriodControlsProps = {
  period: ReportPeriod
  rangeLabel: string
  prevHref: string
  nextHref: string
  dayHref: string
  weekHref: string
  monthHref: string
  /** 오른쪽 끝 액션 (EXCEL 버튼 등) */
  actions?: ReactNode
}

const NAV_BUTTON_CLASS =
  'inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50'

export function ReportPeriodControls({
  period,
  rangeLabel,
  prevHref,
  nextHref,
  dayHref,
  weekHref,
  monthHref,
  actions,
}: ReportPeriodControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {(
          [
            { key: 'day', label: '일간', href: dayHref },
            { key: 'week', label: '주간', href: weekHref },
            { key: 'month', label: '월간', href: monthHref },
          ] as const
        ).map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={[
              'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
              period === item.key ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Link href={prevHref} className={NAV_BUTTON_CLASS} aria-label="이전 기간">
          ‹
        </Link>
        <span className="min-w-[180px] text-center text-sm font-bold text-slate-900">
          {rangeLabel}
        </span>
        <Link href={nextHref} className={NAV_BUTTON_CLASS} aria-label="다음 기간">
          ›
        </Link>
      </div>

      {actions ? <div className="ml-auto">{actions}</div> : null}
    </div>
  )
}
