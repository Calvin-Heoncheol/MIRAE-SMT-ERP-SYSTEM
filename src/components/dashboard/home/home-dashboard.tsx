'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { HomeImportantNoticesBoard } from '@/components/dashboard/home/home-important-notices'
import type { HomeDashboardData } from '@/lib/dashboard/home-data'
import type {
  HomeCalendarDotTone,
  HomeDashboardPeriod,
} from '@/lib/dashboard/home-analytics'
import {
  addMonthsYmd,
  buildMonthGrid,
  formatMonthLabel,
  MONTH_WEEKDAY_LABELS,
} from '@/lib/production-plan/calendar'
import { ERP_PANEL_CLASS } from '@/lib/ui/tokens'

const TONE_ICON: Record<string, string> = {
  sky: 'bg-sky-100 text-sky-700',
  violet: 'bg-violet-100 text-violet-700',
  rose: 'bg-rose-100 text-rose-700',
  amber: 'bg-amber-100 text-amber-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  slate: 'bg-slate-100 text-slate-700',
}

const DOT_CLASS: Record<HomeCalendarDotTone, string> = {
  due: 'bg-rose-500',
  plan: 'bg-indigo-500',
  ship: 'bg-sky-500',
}

const NAV_BUTTON_CLASS =
  'inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50'

function trendSpanLabel(period: HomeDashboardPeriod) {
  if (period === 'day') return '최근 7일'
  if (period === 'week') return '최근 6주'
  return '최근 6개월'
}

function currentBucketLabel(period: HomeDashboardPeriod) {
  if (period === 'day') return '당일'
  if (period === 'week') return '당주'
  return '당월'
}

function Panel({
  title,
  period,
  children,
  className = '',
  dark = false,
}: {
  title: string
  period?: string
  children: ReactNode
  className?: string
  dark?: boolean
}) {
  return (
    <section
      className={[
        'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border shadow-sm',
        dark ? 'border-slate-800 bg-slate-900 text-white' : `${ERP_PANEL_CLASS}`,
        className,
      ].join(' ')}
    >
      <header className={`shrink-0 px-4 py-2.5 ${dark ? '' : 'border-b border-slate-100'}`}>
        <h2 className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
          {title}
          {period ? (
            <span
              className={`ml-1.5 text-xs font-medium ${dark ? 'text-slate-300' : 'text-slate-400'}`}
            >
              ({period})
            </span>
          ) : null}
        </h2>
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-3">{children}</div>
    </section>
  )
}

function PeriodControls({ data }: { data: HomeDashboardData }) {
  const { period, hrefs } = data
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3">
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {(
          [
            { key: 'day' as const, label: '오늘', href: hrefs.dayHref },
            { key: 'week' as const, label: '주간', href: hrefs.weekHref },
            { key: 'month' as const, label: '월간', href: hrefs.monthHref },
          ] as const
        ).map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={[
              'rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
              period.period === item.key
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Link href={hrefs.prevHref} className={NAV_BUTTON_CLASS} aria-label="이전 기간">
          ‹
        </Link>
        <span className="min-w-[180px] text-center text-sm font-bold text-slate-900">
          {period.rangeLabel}
        </span>
        <Link href={hrefs.nextHref} className={NAV_BUTTON_CLASS} aria-label="다음 기간">
          ›
        </Link>
      </div>
    </div>
  )
}

function StatusGrid({
  data,
  periodLabel,
}: {
  data: HomeDashboardData['visual']['status']
  periodLabel: string
}) {
  return (
    <Panel title="작업현황" period={periodLabel}>
      <div className="grid h-full min-h-0 grid-cols-2 gap-2 sm:grid-cols-3">
        {data.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="flex min-h-0 flex-col justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-600">{item.label}</p>
                {item.snapshot ? (
                  <p className="mt-0.5 text-[10px] font-medium text-slate-400">현재 기준</p>
                ) : null}
              </div>
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${TONE_ICON[item.tone]}`}
              >
                {item.unit}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 xl:text-[1.65rem]">
              {item.value.toLocaleString('ko-KR')}
            </p>
          </Link>
        ))}
      </div>
    </Panel>
  )
}

function TeamRanking({
  rows,
  periodLabel,
}: {
  rows: HomeDashboardData['visual']['teamRanking']
  periodLabel: string
}) {
  const max = Math.max(...rows.map((r) => r.quantity), 1)
  return (
    <Panel title="생산실적 랭킹" period={periodLabel}>
      {rows.every((r) => r.quantity <= 0) ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-center text-xs text-slate-400">선택 기간 생산 실적이 없습니다.</p>
        </div>
      ) : (
        <ul className="flex h-full min-h-0 flex-col justify-evenly gap-1">
          {rows.map((row) => (
            <li key={row.team} className="min-h-0">
              <Link href={row.href} className="block rounded-lg px-0.5 py-1 hover:bg-slate-50">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-white">
                      {row.rank}
                    </span>
                    {row.team}
                  </span>
                  <span className="text-xs font-bold tabular-nums text-slate-700">
                    {row.quantity.toLocaleString('ko-KR')} EA
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${Math.round((row.quantity / max) * 100)}%` }}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function CompareChart({
  title,
  periodLabel,
  period,
  rows,
  plannedLabel,
  actualLabel,
  unit,
}: {
  title: string
  periodLabel: string
  period: HomeDashboardPeriod
  rows: { label: string; planned: number; actual: number }[]
  plannedLabel: string
  actualLabel: string
  unit: string
}) {
  const currentActual = rows[rows.length - 1]?.actual ?? 0
  const currentPlanned = rows[rows.length - 1]?.planned ?? 0
  const trendActual = rows.reduce((sum, r) => sum + r.actual, 0)
  const bucket = currentBucketLabel(period)
  const span = trendSpanLabel(period)

  return (
    <Panel title={title} period={periodLabel}>
      <div className="mb-2 flex shrink-0 flex-wrap gap-3 text-[11px] text-slate-500">
        <span>
          {bucket} {plannedLabel}{' '}
          <strong className="text-slate-800">{currentPlanned.toLocaleString('ko-KR')}</strong>
        </span>
        <span>
          {bucket} {actualLabel}{' '}
          <strong className="text-slate-800">{currentActual.toLocaleString('ko-KR')}</strong>
        </span>
        <span>
          {span} {actualLabel}{' '}
          <strong className="text-slate-800">{trendActual.toLocaleString('ko-KR')}</strong>
        </span>
      </div>
      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
            <YAxis
              width={40}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value, name) => [
                `${Number(value).toLocaleString('ko-KR')} ${unit}`,
                String(name),
              ]}
              contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
            <Bar
              dataKey="planned"
              name={plannedLabel}
              fill="#1e3a5f"
              maxBarSize={22}
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="actual"
              name={actualLabel}
              fill="#7dd3fc"
              maxBarSize={22}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

function HomeCalendar({
  monthStart,
  dots,
}: {
  monthStart: string
  dots: Record<string, HomeCalendarDotTone[]>
}) {
  const [viewMonth, setViewMonth] = useState(monthStart)
  const cells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth])
  const weekRows = Math.max(1, Math.ceil(cells.length / 7))

  useEffect(() => {
    setViewMonth(monthStart)
  }, [monthStart])

  return (
    <Panel title="캘린더">
      <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2">
        <button
          type="button"
          className="rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          onClick={() => setViewMonth(addMonthsYmd(viewMonth, -1))}
        >
          ‹
        </button>
        <p className="text-xs font-bold text-slate-800">{formatMonthLabel(viewMonth)}</p>
        <button
          type="button"
          className="rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          onClick={() => setViewMonth(addMonthsYmd(viewMonth, 1))}
        >
          ›
        </button>
      </div>
      <div className="grid shrink-0 grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-400">
        {MONTH_WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-0.5">
            {label}
          </div>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-7 gap-0.5"
        style={{ gridTemplateRows: `repeat(${weekRows}, minmax(0, 1fr))` }}
      >
        {cells.map((cell) => {
          const dayDots = dots[cell.ymd] ?? []
          return (
            <div
              key={cell.ymd}
              className={[
                'flex min-h-0 flex-col items-center justify-center rounded-md text-xs',
                cell.inMonth ? 'text-slate-800' : 'text-slate-300',
                cell.isToday ? 'bg-slate-800 font-bold text-white' : '',
              ].join(' ')}
            >
              <span>{cell.day}</span>
              {dayDots.length && cell.inMonth ? (
                <span className="mt-0.5 flex gap-0.5">
                  {dayDots.slice(0, 3).map((tone) => (
                    <span
                      key={tone}
                      className={`h-1 w-1 rounded-full ${cell.isToday ? 'bg-sky-300' : DOT_CLASS[tone]}`}
                    />
                  ))}
                </span>
              ) : (
                <span className="mt-0.5 h-1" />
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-1.5 flex shrink-0 flex-wrap gap-2 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS.due}`} /> 납기
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS.plan}`} /> 생산계획
        </span>
        <span className="inline-flex items-center gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS.ship}`} /> 출하
        </span>
      </p>
    </Panel>
  )
}

function DeliveryQtyChart({
  rows,
  periodLabel,
  period,
}: {
  rows: HomeDashboardData['visual']['deliverySeries']
  periodLabel: string
  period: HomeDashboardPeriod
}) {
  return (
    <Panel title="납품통계" period={periodLabel}>
      <div className="mb-1 shrink-0 text-[11px] text-slate-500">
        {trendSpanLabel(period)} 출하 수량 (EA)
      </div>
      <div className="min-h-0 w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
            <YAxis
              width={40}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value) => [`${Number(value).toLocaleString('ko-KR')} EA`, '출하']}
              contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
            />
            <Bar dataKey="actual" name="출하" fill="#1e3a5f" maxBarSize={28} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

/** 시각형 공장 운영 대시보드 — 화면 높이를 두 행으로 채움 */
export function HomeDashboard({ data }: { data: HomeDashboardData }) {
  const { visual, period } = data
  const periodLabel = period.periodLabel

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 rounded-3xl bg-gradient-to-br from-slate-200/50 via-indigo-50/40 to-transparent"
        aria-hidden
      />

      <PeriodControls data={data} />

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(220px,0.9fr)_minmax(280px,1.15fr)] gap-3 overflow-y-auto xl:overflow-hidden">
        <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="min-h-[220px] xl:col-span-5 xl:min-h-0">
            <StatusGrid data={visual.status} periodLabel={periodLabel} />
          </div>
          <div className="min-h-[220px] xl:col-span-4 xl:min-h-0">
            <HomeImportantNoticesBoard
              initialRows={data.notices}
              status={data.noticesStatus}
              message={data.noticesMessage}
              canManage={data.canManageNotices}
            />
          </div>
          <div className="min-h-[220px] xl:col-span-3 xl:min-h-0">
            <TeamRanking rows={visual.teamRanking} periodLabel={periodLabel} />
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="min-h-[280px] xl:col-span-4 xl:min-h-0">
            <CompareChart
              title="생산통계"
              periodLabel={periodLabel}
              period={period.period}
              rows={visual.productionSeries}
              plannedLabel="계획"
              actualLabel="실적"
              unit="EA"
            />
          </div>
          <div className="min-h-[280px] xl:col-span-4 xl:min-h-0">
            <DeliveryQtyChart
              rows={visual.deliverySeries}
              periodLabel={periodLabel}
              period={period.period}
            />
          </div>
          <div className="min-h-[280px] xl:col-span-4 xl:min-h-0">
            <HomeCalendar monthStart={visual.calendarMonthStart} dots={visual.calendarDots} />
          </div>
        </div>
      </div>
    </div>
  )
}
