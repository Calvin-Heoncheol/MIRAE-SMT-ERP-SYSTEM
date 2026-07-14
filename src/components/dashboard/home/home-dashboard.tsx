import { HomeKpiCard } from '@/components/dashboard/home/home-kpi-card'

const HOME_KPIS = [
  { value: '–', label: '납기 임박·지연', hint: '3일 이내', tone: 'warn' as const },
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
  { name: '수삽', statusLabel: '대기', active: '현재 작업 없음', todayQty: 0, accent: 'from-emerald-500 to-teal-600' },
  { name: '포장', statusLabel: '대기', active: '현재 작업 없음', todayQty: 0, accent: 'from-blue-500 to-indigo-600' },
  { name: '검사', statusLabel: '대기', active: '현재 작업 없음', todayQty: 0, accent: 'from-violet-500 to-purple-600' },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[13px] font-bold text-slate-800">
      <span className="h-4 w-1 rounded-full bg-gradient-to-b from-blue-500 to-blue-700" aria-hidden="true" />
      {children}
    </h2>
  )
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </section>
  )
}

export function HomeDashboard() {
  return (
    <div className="flex w-full flex-col gap-5 pb-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {HOME_KPIS.map((kpi) => (
          <HomeKpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel>
            <SectionTitle>SMT 라인 · 오늘 계획</SectionTitle>
            <p className="mt-1 mb-4 text-xs text-slate-400">생산 스케줄 연동 후 자동 반영</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
              {SMT_LINES.map((line) => (
                <div
                  key={line.lineNo}
                  className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/50 px-2.5 py-3 transition hover:border-cyan-200 hover:bg-cyan-50/30"
                >
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-40 group-hover:opacity-100" />
                  <div className="mb-2 flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold text-slate-900">L{line.lineNo}</span>
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-500 ring-1 ring-slate-200/80">
                      {line.statusLabel}
                    </span>
                  </div>
                  <p className="line-clamp-2 min-h-[2.4em] text-[10px] leading-snug font-medium text-slate-600">
                    {line.job}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionTitle>후공정</SectionTitle>
            <p className="mt-1 mb-4 text-xs text-slate-400">팀별 오늘 실적 · placeholder</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {POST_TEAMS.map((team) => (
                <div
                  key={team.name}
                  className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 p-4"
                >
                  <div className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${team.accent}`} />
                  <div className="flex items-start justify-between gap-2 pl-2">
                    <h3 className="text-sm font-bold text-slate-900">{team.name}</h3>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                      {team.statusLabel}
                    </span>
                  </div>
                  <p className="mt-2 pl-2 text-xs text-slate-600">{team.active}</p>
                  <div className="mt-3 flex items-end justify-between border-t border-slate-200/60 pt-3 pl-2">
                    <span className="text-[11px] font-semibold text-slate-400">오늘</span>
                    <span className="text-lg font-bold tabular-nums text-slate-900">
                      {team.todayQty}
                      <span className="ml-1 text-xs font-semibold text-blue-600">EA</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <aside className="xl:sticky xl:top-[76px] xl:self-start">
          <Panel>
            <SectionTitle>주의 · 알림</SectionTitle>
            <p className="mt-1 mb-4 text-xs text-slate-400">납기 · 재고 · 발주</p>
            <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-10 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-lg text-emerald-700">
                ✓
              </div>
              <p className="text-sm font-semibold text-slate-700">주의할 항목 없음</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">연동 후 알림이 표시됩니다</p>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
