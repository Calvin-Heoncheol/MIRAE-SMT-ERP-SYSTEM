import { HomeKpiCard } from './home-kpi-card'

const HOME_KPIS = [
  { value: '–', label: '납기 임박·지연', hint: '3일 이내 납기', tone: 'warn' as const },
  { value: '–', label: '출하 미완료', tone: 'warn' as const },
  { value: '–', label: '미입고 발주', tone: 'warn' as const },
  { value: '–', label: '재고 마이너스', tone: 'danger' as const },
]

const SMT_LINES = Array.from({ length: 7 }, (_, index) => ({
  lineNo: index + 1,
  statusLabel: '대기',
  job: '오늘 계획 없음',
}))

const POST_TEAMS = [
  { name: '수삽', statusLabel: '대기', active: '현재 작업 없음', todayQty: 0 },
  { name: '포장', statusLabel: '대기', active: '현재 작업 없음', todayQty: 0 },
  { name: '검사', statusLabel: '대기', active: '현재 작업 없음', todayQty: 0 },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3.5 flex items-center gap-2 text-[11px] font-bold tracking-widest text-slate-500 uppercase">
      <span className="h-3.5 w-0.5 shrink-0 rounded-sm bg-blue-600" aria-hidden="true" />
      {children}
    </h3>
  )
}

function HomeCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm lg:p-5 ${className}`}
    >
      {children}
    </section>
  )
}

export function HomeDashboard() {
  return (
    <div className="flex min-h-[calc(100vh-60px)] w-full flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {HOME_KPIS.map((kpi) => (
          <HomeKpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <HomeCard className="flex-1">
            <SectionTitle>SMT 라인 · 오늘 계획</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
              {SMT_LINES.map((line) => (
                <div
                  key={line.lineNo}
                  className="rounded-lg border border-slate-200 border-t-[3px] border-t-slate-300 bg-white px-2 py-2.5"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900">L{line.lineNo}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                      {line.statusLabel}
                    </span>
                  </div>
                  <p className="line-clamp-2 min-h-[2.7em] text-[10px] leading-snug font-medium text-slate-700">
                    {line.job}
                  </p>
                </div>
              ))}
            </div>
          </HomeCard>

          <HomeCard>
            <SectionTitle>후공정</SectionTitle>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {POST_TEAMS.map((team) => (
                <div
                  key={team.name}
                  className="rounded-[10px] border border-slate-200 border-t-[3px] border-t-slate-300 bg-white px-3.5 py-3.5"
                >
                  <div className="mb-2.5 flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{team.name}</h4>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                      후공정
                    </span>
                  </div>
                  <p className="mb-2 text-[11px] font-semibold text-slate-500">{team.statusLabel}</p>
                  <p className="line-clamp-2 min-h-[2.9em] text-xs leading-snug text-slate-700">{team.active}</p>
                  <div className="mt-2.5 flex items-baseline justify-between gap-2 border-t border-slate-100 pt-2.5">
                    <span className="text-[11px] font-semibold text-slate-400">오늘</span>
                    <span className="text-xl font-bold text-slate-900 tabular-nums">
                      <em className="text-sm font-semibold text-blue-600 not-italic">{team.todayQty}</em> EA
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </HomeCard>
        </div>

        <aside className="xl:sticky xl:top-[76px] xl:self-start">
          <HomeCard>
            <SectionTitle>주의 · 알림</SectionTitle>
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-[13px] text-slate-400">
              현재 주의할 항목이 없습니다.
            </div>
          </HomeCard>
        </aside>
      </div>
    </div>
  )
}
