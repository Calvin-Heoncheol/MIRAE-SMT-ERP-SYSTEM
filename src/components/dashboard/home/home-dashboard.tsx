import Link from 'next/link'
import type {
  HomeAttentionItem,
  HomeDashboardData,
  HomePipelineStage,
  HomeProductionTeam,
  HomeSmtLine,
} from '@/lib/dashboard/home-data'

const SMT_LINE_STATUS = {
  idle: { label: '대기', chip: 'bg-slate-100 text-slate-600' },
  planned: { label: '예정', chip: 'bg-sky-100 text-sky-800' },
  running: { label: '가동', chip: 'bg-amber-100 text-amber-900' },
  done: { label: '완료', chip: 'bg-teal-100 text-teal-800' },
} as const

const KIND_LABEL = {
  delivery: '납기',
  material: '자재',
  quality: '품질',
} as const

const MAX_VISIBLE_ATTENTION = 8

function smtLineProgressPercent(line: HomeSmtLine) {
  if (line.plannedQuantity <= 0) {
    return line.producedQuantity > 0 ? 100 : 0
  }
  return Math.min(100, Math.round((line.producedQuantity / line.plannedQuantity) * 100))
}

function pipelineToneClass(tone: HomePipelineStage['tone']) {
  if (tone === 'danger') return 'border-rose-300/80 bg-rose-50/90'
  if (tone === 'warn') return 'border-amber-300/80 bg-amber-50/90'
  if (tone === 'ok') return 'border-teal-300/70 bg-teal-50/80'
  return 'border-white/70 bg-white/90'
}

function attentionToneClass(tone: HomeAttentionItem['tone']) {
  if (tone === 'danger') return 'border-l-rose-500 bg-rose-50/50'
  return 'border-l-amber-500 bg-amber-50/40'
}

function PipelineFlow({ stages }: { stages: HomePipelineStage[] }) {
  return (
    <div className="grid h-full grid-cols-4 gap-2">
      {stages.map((stage, index) => (
        <div key={stage.key} className="relative flex min-w-0 items-stretch">
          <Link
            href={stage.href}
            className={[
              'flex min-w-0 flex-1 flex-col justify-center rounded-xl border px-3 py-2 shadow-sm transition hover:shadow-md',
              pipelineToneClass(stage.tone),
            ].join(' ')}
          >
            <p className="text-[10px] font-bold tracking-wide text-slate-500">{stage.label}</p>
            <p className="truncate text-lg font-black tracking-tight text-slate-900 tabular-nums xl:text-xl">
              {stage.primary}
            </p>
            {stage.secondary ? (
              <p className="mt-0.5 truncate text-[10px] font-medium text-slate-600">
                {stage.secondary}
              </p>
            ) : null}
          </Link>
          {index < stages.length - 1 ? (
            <span
              className="pointer-events-none absolute top-1/2 -right-1 z-10 hidden -translate-y-1/2 text-xs font-bold text-slate-400 xl:block"
              aria-hidden
            >
              →
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function AttentionPanel({ items }: { items: HomeAttentionItem[] }) {
  const visible = items.slice(0, MAX_VISIBLE_ATTENTION)
  const hiddenCount = Math.max(0, items.length - visible.length)

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 shadow-sm">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-bold text-slate-900">조치가 필요한 것</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-700">
          {items.length}건
        </span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-2">
        {!visible.length ? (
          <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 text-center text-xs text-slate-500">
            지금 당장 볼 이슈가 없습니다
          </p>
        ) : (
          <>
            <ul className="flex min-h-0 flex-1 flex-col gap-1">
              {visible.map((item) => (
                <li key={item.key} className="min-h-0 flex-1">
                  <Link
                    href={item.href}
                    className={[
                      'flex h-full min-h-0 items-center gap-2 rounded-lg border border-transparent border-l-4 px-2.5 py-1.5 transition hover:border-slate-200 hover:bg-white hover:shadow-sm',
                      attentionToneClass(item.tone),
                    ].join(' ')}
                  >
                    <span className="shrink-0 rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200/80">
                      {KIND_LABEL[item.kind]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900">{item.title}</p>
                      <p className="truncate text-[10px] text-slate-500">{item.detail}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {hiddenCount > 0 ? (
              <p className="shrink-0 px-1 text-[10px] font-medium text-slate-400">외 {hiddenCount}건</p>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}

function FloorBoard({ lines }: { lines: HomeSmtLine[] }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 shadow-sm">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-bold text-slate-900">SMT 라인</h2>
        <Link
          href="/production/plan?tab=smt"
          className="text-[10px] font-semibold text-sky-700 hover:text-sky-600"
        >
          계획 →
        </Link>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-1.5 p-2">
        {lines.map((line) => {
          const status = SMT_LINE_STATUS[line.status]
          const percent = smtLineProgressPercent(line)
          return (
            <div
              key={line.lineNo}
              className="flex min-h-0 min-w-0 flex-col rounded-lg border border-slate-200 bg-slate-50/80 px-1.5 py-1.5"
              title={line.jobLabel}
            >
              <div className="mb-1 flex items-center justify-between gap-0.5">
                <span className="text-xs font-black text-slate-800">L{line.lineNo}</span>
                <span className={`rounded px-1 py-px text-[8px] font-bold ${status.chip}`}>
                  {status.label}
                </span>
              </div>
              <div className="mb-1 h-1 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${line.status === 'done' ? 'bg-teal-500' : 'bg-sky-500'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="line-clamp-2 min-h-0 flex-1 text-[9px] font-medium leading-snug text-slate-600">
                {line.jobLabel}
              </p>
              <p className="mt-1 truncate text-[9px] tabular-nums text-slate-500">
                {line.producedQuantity.toLocaleString('ko-KR')}
                {line.plannedQuantity > 0
                  ? `/${line.plannedQuantity.toLocaleString('ko-KR')}`
                  : ''}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function TeamStrip({ teams }: { teams: HomeProductionTeam[] }) {
  const max = Math.max(...teams.map((team) => team.todayQuantity), 1)
  const total = teams.reduce((sum, team) => sum + team.todayQuantity, 0)

  return (
    <section className="flex shrink-0 flex-col justify-center rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">팀별 오늘 실적</h2>
        <p className="text-xs font-bold tabular-nums text-slate-700">
          합계 {total.toLocaleString('ko-KR')} EA
        </p>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {teams.map((team) => {
          const width = total <= 0 ? 0 : Math.round((team.todayQuantity / max) * 100)
          return (
            <Link
              key={team.team}
              href={team.href}
              className="rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5 transition hover:bg-white"
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="truncate text-[10px] font-bold text-slate-600">{team.team}</span>
                <span className="text-xs font-extrabold tabular-nums text-slate-900">
                  {team.todayQuantity.toLocaleString('ko-KR')}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${width}%` }} />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/** 현황판 — 뷰포트 한 화면, 페이지 스크롤 없음 */
export function HomeDashboard({ data }: { data: HomeDashboardData }) {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col gap-2.5 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-36 rounded-3xl bg-gradient-to-br from-slate-200/70 via-sky-100/35 to-transparent"
        aria-hidden
      />

      <section className="h-[4.75rem] shrink-0 xl:h-[5.25rem]">
        <PipelineFlow stages={data.pipeline} />
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 overflow-hidden xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <AttentionPanel items={data.attention} />
        <FloorBoard lines={data.smtLines} />
      </div>

      <TeamStrip teams={data.productionTeams} />
    </div>
  )
}
