import Link from 'next/link'
import { HomeKpiCard } from '@/components/dashboard/home/home-kpi-card'
import { PageShell } from '@/components/ui/page-shell'
import { APP_SHORT_NAME } from '@/lib/app-config'
import type { HomeDashboardData, HomeSmtLine } from '@/lib/dashboard/home-data'

const TEAM_TINTS = [
  'from-sky-50 to-white',
  'from-emerald-50 to-white',
  'from-amber-50 to-white',
  'from-violet-50 to-white',
]

function todayLabel() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date())
}

function formatCount(value: number | null) {
  return value == null ? '–' : value.toLocaleString('ko-KR')
}

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

function SectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string
  href: string
  linkLabel: string
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-bold tracking-tight text-slate-900">{title}</h2>
      <Link
        href={href}
        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        {linkLabel} →
      </Link>
    </div>
  )
}

export function HomeDashboard({ data }: { data: HomeDashboardData }) {
  const kpis = [
    {
      value: formatCount(data.kpis.dueSoonOrders),
      label: '납기 임박',
      hint: '3일 이내',
      tone: 'warn' as const,
      href: '/production/status',
    },
    {
      value: formatCount(data.kpis.unshippedOrders),
      label: '출하 미완료',
      tone: 'warn' as const,
      href: '/delivery',
    },
    {
      value: formatCount(data.kpis.pendingPurchaseOrders),
      label: '미입고 발주',
      tone: 'warn' as const,
      href: '/materials/purchase-orders',
    },
    {
      value: formatCount(data.kpis.negativeStockMaterials),
      label: '재고 마이너스',
      tone: 'danger' as const,
      href: '/materials/inventory',
    },
  ]

  return (
    <PageShell className="gap-5">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 px-5 py-5 text-white shadow-sm sm:px-6 sm:py-6">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-400/20 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-1/3 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-300 uppercase">
              {APP_SHORT_NAME}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">오늘의 생산 현황</h1>
            <p className="mt-2 text-sm text-slate-300">{todayLabel()}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/production/status"
              className="rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15"
            >
              주문별 현황
            </Link>
            <Link
              href="/smt/plan"
              className="rounded-xl bg-sky-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-400"
            >
              SMT 계획
            </Link>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="block">
            <HomeKpiCard value={kpi.value} label={kpi.label} hint={kpi.hint} tone={kpi.tone} />
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <SectionHeader title="SMT 라인현황" href="/smt/plan" linkLabel="계획 보기" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
          {data.smtLines.map((line) => {
            const status = SMT_LINE_STATUS[line.status]
            const percent = smtLineProgressPercent(line)
            return (
              <div
                key={line.lineNo}
                className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white px-3 py-3 transition hover:border-sky-200 hover:shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between gap-1">
                  <span className="text-sm font-extrabold text-slate-900">L{line.lineNo}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.chip}`}>
                    {status.label}
                  </span>
                </div>
                <div className="mb-2 h-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${line.status === 'done' ? 'bg-emerald-400' : 'bg-sky-400'}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="truncate text-[11px] font-medium text-slate-500" title={line.jobLabel}>
                  {line.jobLabel}
                </p>
                {line.plannedQuantity > 0 ? (
                  <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
                    {line.producedQuantity.toLocaleString('ko-KR')} /{' '}
                    {line.plannedQuantity.toLocaleString('ko-KR')}
                  </p>
                ) : line.producedQuantity > 0 ? (
                  <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
                    오늘 {line.producedQuantity.toLocaleString('ko-KR')} EA
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(16rem,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeader title="오늘 생산실적" href="/production/status" linkLabel="주문별 현황" />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {data.productionTeams.map((team, index) => (
              <Link
                key={team.team}
                href={team.href}
                className={`rounded-xl border border-slate-200 bg-gradient-to-br ${TEAM_TINTS[index % TEAM_TINTS.length]} px-4 py-4 transition hover:border-emerald-200 hover:shadow-sm`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{team.team}</h3>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                    {team.todayQuantity > 0 ? '가동' : '대기'}
                  </span>
                </div>
                <p className="mt-4 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                  오늘 실적
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {team.todayQuantity.toLocaleString('ko-KR')}
                  <span className="ml-1 text-sm font-semibold text-slate-500">EA</span>
                </p>
              </Link>
            ))}
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-[15px] font-bold tracking-tight text-slate-900">알림</h2>
          {data.alerts.length ? (
            <ul className="mt-4 space-y-2">
              {data.alerts.map((alert) => (
                <li key={alert.key}>
                  <Link
                    href={alert.href}
                    className={[
                      'block rounded-xl border px-3.5 py-2.5 transition hover:shadow-sm',
                      alert.tone === 'danger'
                        ? 'border-rose-200 bg-rose-50/60 hover:border-rose-300'
                        : 'border-amber-200 bg-amber-50/60 hover:border-amber-300',
                    ].join(' ')}
                  >
                    <p className="truncate text-sm font-semibold text-slate-800">{alert.label}</p>
                    <p
                      className={`mt-0.5 truncate text-xs font-medium ${
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
            <div className="mt-4 flex min-h-[11rem] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                OK
              </div>
              <p className="text-sm font-semibold text-slate-800">표시할 알림 없음</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                납기 임박 주문과 재고 마이너스
                <br />
                자재가 여기에 표시됩니다
              </p>
            </div>
          )}
        </aside>
      </div>
    </PageShell>
  )
}
