import Link from 'next/link'
import type {
  HomeDashboardData,
  HomeHeroMetric,
  HomeSmtLine,
} from '@/lib/dashboard/home-data'
import { HomeTeamPerformanceChart } from '@/components/dashboard/home/home-team-performance-chart'
import { KpiStatCard } from '@/components/ui/kpi-stat-card'

const SMT_LINE_STATUS = {
  idle: { label: '대기', chip: 'bg-slate-100 text-slate-500' },
  planned: { label: '예정', chip: 'bg-sky-50 text-sky-700' },
  running: { label: '생산중', chip: 'bg-amber-50 text-amber-800' },
  done: { label: '완료', chip: 'bg-emerald-50 text-emerald-800' },
} as const

function smtLineProgressPercent(line: HomeSmtLine) {
  if (line.plannedQuantity <= 0) {
    return line.producedQuantity > 0 ? 100 : 0
  }
  return Math.min(100, Math.round((line.producedQuantity / line.plannedQuantity) * 100))
}

const HERO_ACCENT: Record<string, string> = {
  'hero:new-orders': 'border-sky-200 bg-sky-50/70',
  'hero:achievement': 'border-emerald-200 bg-emerald-50/70',
  'hero:shipped': 'border-slate-200 bg-slate-50',
  'hero:alerts': 'border-amber-200 bg-amber-50/70',
}

function HeroCard({ metric }: { metric: HomeHeroMetric }) {
  const accent = HERO_ACCENT[metric.key] ?? 'border-slate-200 bg-white'
  return (
    <Link href={metric.href} className="block transition hover:opacity-95">
      <KpiStatCard
        label={metric.label}
        value={metric.value}
        unit={metric.unit}
        hint={metric.hint}
        tone={metric.tone === 'warn' ? 'amber' : metric.tone === 'danger' ? 'rose' : 'default'}
        className={['transition hover:border-slate-300 hover:shadow-sm', accent].join(' ')}
      />
    </Link>
  )
}

/**
 * 한 화면(스크롤 없음) KPI 보드 — 부서 카드·여백 제거, Hero + SMT + 팀/알림만.
 */
export function HomeDashboard({ data }: { data: HomeDashboardData }) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden lg:max-h-[calc(100dvh-2.5rem)]">
      <section className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-4">
        {data.hero.map((metric) => (
          <HeroCard key={metric.key} metric={metric} />
        ))}
      </section>

      <section className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">SMT 라인</h2>
          <Link
            href="/smt/plan"
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
          >
            계획 →
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {data.smtLines.map((line) => {
            const status = SMT_LINE_STATUS[line.status]
            const percent = smtLineProgressPercent(line)
            return (
              <div
                key={line.lineNo}
                className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-2"
                title={line.jobLabel}
              >
                <div className="mb-1 flex items-center justify-between gap-0.5">
                  <span className="text-xs font-extrabold text-slate-900">L{line.lineNo}</span>
                  <span className={`rounded px-1 py-px text-[9px] font-bold ${status.chip}`}>
                    {status.label}
                  </span>
                </div>
                <div className="mb-1 h-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${line.status === 'done' ? 'bg-emerald-400' : 'bg-sky-400'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="truncate text-[10px] font-medium text-slate-500">{line.jobLabel}</p>
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1.4fr)_minmax(14rem,1fr)]">
        <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">오늘 팀 실적</h2>
            <Link
              href="/production/status"
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
            >
              현황 →
            </Link>
          </div>
          <HomeTeamPerformanceChart teams={data.productionTeams} />
        </section>

        <aside className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
          <h2 className="mb-2 shrink-0 text-sm font-bold text-slate-900">알림</h2>
          {data.alerts.length ? (
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
              {data.alerts.slice(0, 4).map((alert) => (
                <li key={alert.key}>
                  <Link
                    href={alert.href}
                    className={[
                      'block rounded-lg border px-2.5 py-1.5 transition hover:shadow-sm',
                      alert.tone === 'danger'
                        ? 'border-rose-200 bg-rose-50/70'
                        : 'border-amber-200 bg-amber-50/70',
                    ].join(' ')}
                  >
                    <p className="truncate text-xs font-semibold text-slate-800">{alert.label}</p>
                    <p
                      className={`truncate text-[11px] font-medium ${
                        alert.tone === 'danger' ? 'text-rose-700' : 'text-amber-800'
                      }`}
                    >
                      {alert.detail}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs font-medium text-slate-500">
              알림 없음
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
