'use client'

import Link from 'next/link'
import { useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { HomeNoticesSlimBar } from '@/components/dashboard/home/home-notices-panel'
import type { HomeDashboardData } from '@/lib/dashboard/home-data'
import type { HomeCalendarDotTone } from '@/lib/dashboard/home-analytics'
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
        'flex min-h-0 flex-col overflow-hidden rounded-xl border shadow-sm',
        dark
          ? 'border-slate-800 bg-slate-900 text-white'
          : `${ERP_PANEL_CLASS}`,
        className,
      ].join(' ')}
    >
      <header className={`shrink-0 px-4 py-3 ${dark ? '' : 'border-b border-slate-100'}`}>
        <h2 className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
          {title}
          {period ? (
            <span className={`ml-1.5 text-xs font-medium ${dark ? 'text-slate-300' : 'text-slate-400'}`}>
              ({period})
            </span>
          ) : null}
        </h2>
      </header>
      <div className="min-h-0 flex-1 p-3">{children}</div>
    </section>
  )
}

function WeekStatusGrid({ data }: { data: HomeDashboardData['visual']['weekStatus'] }) {
  return (
    <Panel title="작업현황" period="주간" className="min-h-[220px]">
      <div className="grid h-full grid-cols-2 gap-2 sm:grid-cols-3">
        {data.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-slate-600">{item.label}</p>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${TONE_ICON[item.tone]}`}
              >
                {item.unit}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">
              {item.value.toLocaleString('ko-KR')}
            </p>
          </Link>
        ))}
      </div>
    </Panel>
  )
}

function InventoryDonut({
  total,
  segments,
}: {
  total: number
  segments: HomeDashboardData['visual']['inventory']['segments']
}) {
  const chartData = segments.filter((s) => s.value > 0)
  const fallback = chartData.length ? chartData : [{ key: 'empty', label: '데이터 없음', value: 1, color: '#334155' }]

  return (
    <Panel title="재고관리" period="현재" dark className="min-h-[220px]">
      <div className="flex h-full items-center gap-3">
        <div className="relative h-[140px] w-[140px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={fallback}
                dataKey="value"
                nameKey="label"
                innerRadius={42}
                outerRadius={62}
                paddingAngle={2}
                stroke="none"
              >
                {fallback.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[10px] text-slate-300">총 건수</p>
            <p className="text-xl font-bold tabular-nums">{total.toLocaleString('ko-KR')}</p>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {segments.map((seg) => (
            <li key={seg.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-slate-200">
                <span className="h-2 w-2 rounded-full" style={{ background: seg.color }} />
                {seg.label}
              </span>
              <span className="font-semibold tabular-nums text-white">
                {seg.value.toLocaleString('ko-KR')}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}

function TeamRanking({ rows }: { rows: HomeDashboardData['visual']['teamRanking'] }) {
  const max = Math.max(...rows.map((r) => r.quantity), 1)
  return (
    <Panel title="생산실적 랭킹" period="월간" className="min-h-[220px]">
      {rows.every((r) => r.quantity <= 0) ? (
        <p className="py-8 text-center text-xs text-slate-400">이번 달 생산 실적이 없습니다.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.team}>
              <Link href={row.href} className="block rounded-lg hover:bg-slate-50">
                <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
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
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
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

function MonthCompareChart({
  title,
  period,
  rows,
  plannedLabel,
  actualLabel,
  unit,
}: {
  title: string
  period: string
  rows: { label: string; planned: number; actual: number }[]
  plannedLabel: string
  actualLabel: string
  unit: string
}) {
  const monthActual = rows[rows.length - 1]?.actual ?? 0
  const monthPlanned = rows[rows.length - 1]?.planned ?? 0
  const yearActual = rows.reduce((sum, r) => sum + r.actual, 0)

  return (
    <Panel title={title} period={period} className="min-h-[260px]">
      <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
        <span>
          당월 {plannedLabel}{' '}
          <strong className="text-slate-800">{monthPlanned.toLocaleString('ko-KR')}</strong>
        </span>
        <span>
          당월 {actualLabel}{' '}
          <strong className="text-slate-800">{monthActual.toLocaleString('ko-KR')}</strong>
        </span>
        <span>
          최근6개월 {actualLabel}{' '}
          <strong className="text-slate-800">{yearActual.toLocaleString('ko-KR')}</strong>
        </span>
      </div>
      <div className="h-[180px] w-full">
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
            <Bar dataKey="planned" name={plannedLabel} fill="#1e3a5f" maxBarSize={22} radius={[3, 3, 0, 0]} />
            <Bar dataKey="actual" name={actualLabel} fill="#7dd3fc" maxBarSize={22} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  )
}

function OrderLineChart({ rows }: { rows: HomeDashboardData['visual']['orderMonthly'] }) {
  return (
    <Panel title="수주 건수" period="월별" className="min-h-[220px]">
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
            <YAxis width={36} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(value) => [`${Number(value).toLocaleString('ko-KR')} 건`, '수주']}
              contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="수주"
              stroke="#4f46e5"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#4f46e5' }}
            />
          </LineChart>
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

  return (
    <Panel title="캘린더" className="min-h-[260px]">
      <div className="mb-2 flex items-center justify-between gap-2">
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
      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-400">
        {MONTH_WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell) => {
          const dayDots = dots[cell.ymd] ?? []
          return (
            <div
              key={cell.ymd}
              className={[
                'flex min-h-[2rem] flex-col items-center justify-center rounded-md text-xs',
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
      <p className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-400">
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

function DeliveryQtyChart({ rows }: { rows: HomeDashboardData['visual']['deliveryMonthly'] }) {
  return (
    <Panel title="납품통계" period="월별" className="min-h-[220px]">
      <div className="mb-1 text-[11px] text-slate-500">월별 출하 수량 (EA)</div>
      <div className="h-[160px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
            <YAxis width={40} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
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

/** 참고 화면 톤의 시각형 공장 운영 대시보드 */
export function HomeDashboard({ data }: { data: HomeDashboardData }) {
  const { visual } = data

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 rounded-3xl bg-gradient-to-br from-slate-200/50 via-indigo-50/40 to-transparent"
        aria-hidden
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-1 pr-0.5">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <WeekStatusGrid data={visual.weekStatus} />
          </div>
          <div className="xl:col-span-4">
            <InventoryDonut total={visual.inventory.total} segments={visual.inventory.segments} />
          </div>
          <div className="xl:col-span-3">
            <TeamRanking rows={visual.teamRanking} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <MonthCompareChart
              title="생산통계"
              period="월별"
              rows={visual.productionMonthly}
              plannedLabel="계획"
              actualLabel="실적"
              unit="EA"
            />
          </div>
          <div className="xl:col-span-4">
            <DeliveryQtyChart rows={visual.deliveryMonthly} />
          </div>
          <div className="xl:col-span-4">
            <HomeCalendar monthStart={visual.calendarMonthStart} dots={visual.calendarDots} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <OrderLineChart rows={visual.orderMonthly} />
          <Panel title="빠른 이동" className="min-h-[220px]">
            <div className="grid grid-cols-2 gap-2">
              {data.headline.map((metric) => (
                <Link
                  key={metric.key}
                  href={metric.href}
                  className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-3 transition hover:border-slate-300 hover:bg-white"
                >
                  <p className="text-[11px] font-semibold text-slate-500">{metric.label}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                    {metric.value == null ? '–' : metric.value.toLocaleString('ko-KR')}
                    <span className="ml-1 text-[10px] font-semibold text-slate-400">{metric.unit}</span>
                  </p>
                  {metric.hint ? (
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">{metric.hint}</p>
                  ) : null}
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <HomeNoticesSlimBar
        initialRows={data.notices}
        status={data.noticesStatus}
        message={data.noticesMessage}
        canManage={data.canManageNotices}
      />
    </div>
  )
}
