'use client'

import Link from 'next/link'
import type {
  HomeAttentionItem,
  HomeDashboardData,
  HomeHeadlineMetric,
  HomeProductionTeam,
} from '@/lib/dashboard/home-data'

const DEPARTMENT_LABEL = {
  production: '생산',
  material: '자재',
  sales: '영업',
} as const

const DEPARTMENT_CHIP = {
  production: 'bg-sky-50 text-sky-800 ring-sky-200',
  material: 'bg-amber-50 text-amber-800 ring-amber-200',
  sales: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
} as const

const VALUE_TONE: Record<HomeHeadlineMetric['tone'], string> = {
  default: 'text-slate-900',
  sky: 'text-sky-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
}

function attentionToneClass(tone: HomeAttentionItem['tone']) {
  if (tone === 'danger') return 'border-l-rose-500 bg-rose-50/40'
  return 'border-l-amber-500 bg-amber-50/40'
}

function HeadlineCards({ metrics }: { metrics: HomeHeadlineMetric[] }) {
  return (
    <section className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
      {metrics.map((metric) => {
        const display =
          metric.value == null ? '–' : metric.value.toLocaleString('ko-KR')
        return (
          <Link
            key={metric.key}
            href={metric.href}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
            <p className={`mt-1.5 text-3xl font-bold tabular-nums ${VALUE_TONE[metric.tone]}`}>
              {display}
              <span className="ml-1 text-sm font-semibold text-slate-400">{metric.unit}</span>
            </p>
            {metric.hint ? (
              <p className="mt-1 truncate text-xs font-medium text-slate-500">{metric.hint}</p>
            ) : null}
          </Link>
        )
      })}
    </section>
  )
}

function AttentionPanel({ items }: { items: HomeAttentionItem[] }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div>
          <h2 className="text-base font-bold text-slate-900">관심 필요</h2>
          <p className="mt-0.5 text-xs text-slate-500">생산 · 자재 · 영업</p>
        </div>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700">
          {items.length}건
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!items.length ? (
          <p className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500">
            지금 당장 볼 이슈가 없습니다
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={[
                    'flex items-start gap-3 rounded-xl border border-transparent border-l-4 px-3.5 py-3 transition hover:border-slate-200 hover:bg-white hover:shadow-sm',
                    attentionToneClass(item.tone),
                  ].join(' ')}
                >
                  <span
                    className={[
                      'mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ring-1',
                      DEPARTMENT_CHIP[item.department],
                    ].join(' ')}
                  >
                    {DEPARTMENT_LABEL[item.department]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function TeamProduction({
  teams,
  todayLabel,
}: {
  teams: HomeProductionTeam[]
  todayLabel: string
}) {
  const total = teams.reduce((sum, team) => sum + team.todayQuantity, 0)
  const max = Math.max(...teams.map((team) => team.todayQuantity), 1)

  return (
    <aside className="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:w-[22rem] xl:shrink-0">
      <header className="shrink-0 border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">{todayLabel}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">팀별 생산</h2>
          <p className="text-xs font-bold tabular-nums text-slate-600">
            합계 {total.toLocaleString('ko-KR')} EA
          </p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {teams.map((team) => {
          const width = total <= 0 ? 0 : Math.round((team.todayQuantity / max) * 100)
          return (
            <Link
              key={team.team}
              href={team.href}
              className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 transition hover:border-slate-300 hover:bg-white"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-700">{team.team}</span>
                <span className="text-sm font-bold tabular-nums text-slate-900">
                  {team.todayQuantity.toLocaleString('ko-KR')}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${width}%` }} />
              </div>
            </Link>
          )
        })}
      </div>
    </aside>
  )
}

/** 조치 중심 홈 — 납기·자재·출하를 먼저, 생산은 보조 */
export function HomeDashboard({ data }: { data: HomeDashboardData }) {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 rounded-3xl bg-gradient-to-br from-slate-200/60 via-sky-100/30 to-transparent"
        aria-hidden
      />

      <HeadlineCards metrics={data.headline} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden xl:flex-row">
        <AttentionPanel items={data.attention} />
        <TeamProduction teams={data.productionTeams} todayLabel={data.todayLabel} />
      </div>
    </div>
  )
}
