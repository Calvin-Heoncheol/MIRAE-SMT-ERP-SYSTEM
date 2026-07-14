'use client'

import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'
import type { SmtPlanExecutionStatus } from '@/lib/smt/plan/utils'

export type SmtInputLinePlanStatus = 'idle' | SmtPlanExecutionStatus

export type SmtInputLineCard = {
  lineNo: number
  statusLabel: string
  jobLabel: string
  hasPlan: boolean
  planStatus: SmtInputLinePlanStatus
}

type SmtLineMachineCardsProps = {
  lines: SmtInputLineCard[]
  selectedLineNo: number | null
  onSelect: (lineNo: number) => void
}

/** 심플 SMT 라인 아이콘 — 본체 + 레일만 */
function SmtLineGlyph({ active }: { active: boolean }) {
  const stroke = active ? '#0284c7' : '#94a3b8'
  const fill = active ? '#e0f2fe' : '#f8fafc'
  const rail = active ? '#38bdf8' : '#cbd5e1'

  return (
    <svg viewBox="0 0 96 36" className="mx-auto h-8 w-full max-w-[5.5rem]" aria-hidden="true">
      <rect x="10" y="8" width="76" height="18" rx="5" fill={fill} stroke={stroke} strokeWidth="2" />
      <line x1="22" y1="17" x2="74" y2="17" stroke={rail} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="28" cy="30" r="2.5" fill={rail} />
      <circle cx="68" cy="30" r="2.5" fill={rail} />
    </svg>
  )
}

function cardSurfaceClass(selected: boolean, planStatus: SmtInputLinePlanStatus) {
  if (selected) return 'border-sky-500 bg-sky-50 shadow-md ring-2 ring-sky-200'
  if (planStatus === 'done') return 'border-emerald-300 bg-emerald-50/80 hover:border-emerald-400 hover:shadow-sm'
  if (planStatus === 'progress') return 'border-amber-300 bg-amber-50/70 hover:border-amber-400 hover:shadow-sm'
  if (planStatus === 'ready') return 'border-cyan-200 bg-white hover:border-sky-300 hover:shadow-sm'
  return 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
}

function topBarClass(selected: boolean, planStatus: SmtInputLinePlanStatus) {
  if (planStatus === 'done') return 'bg-gradient-to-r from-emerald-400 to-emerald-600'
  if (planStatus === 'progress') return 'bg-gradient-to-r from-amber-400 to-orange-500'
  if (selected || planStatus === 'ready') return 'bg-gradient-to-r from-cyan-400 to-sky-500'
  return 'bg-gradient-to-r from-slate-300 to-slate-400'
}

function badgeClass(selected: boolean, planStatus: SmtInputLinePlanStatus) {
  if (selected) return 'bg-sky-100 text-sky-800 ring-sky-200'
  if (planStatus === 'done') return 'bg-emerald-100 text-emerald-800 ring-emerald-200'
  if (planStatus === 'progress') return 'bg-amber-100 text-amber-800 ring-amber-200'
  if (planStatus === 'ready') return 'bg-sky-50 text-sky-700 ring-sky-100'
  return 'bg-white text-slate-500 ring-slate-200'
}

export function buildDefaultSmtInputLineCards(
  overrides: Partial<Record<number, Omit<SmtInputLineCard, 'lineNo'>>> = {},
): SmtInputLineCard[] {
  return SMT_PLAN_LINE_NOS.map((lineNo) => ({
    lineNo,
    statusLabel: overrides[lineNo]?.statusLabel ?? '대기',
    jobLabel: overrides[lineNo]?.jobLabel ?? '오늘 계획 없음',
    hasPlan: overrides[lineNo]?.hasPlan ?? false,
    planStatus: overrides[lineNo]?.planStatus ?? 'idle',
  }))
}

export function SmtLineMachineCards({
  lines,
  selectedLineNo,
  onSelect,
}: SmtLineMachineCardsProps) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
      {lines.map((line) => {
        const selected = selectedLineNo === line.lineNo
        return (
          <button
            key={line.lineNo}
            type="button"
            onClick={() => onSelect(line.lineNo)}
            aria-pressed={selected}
            className={[
              'group relative overflow-hidden rounded-xl border px-2.5 py-3 text-left transition',
              cardSurfaceClass(selected, line.planStatus),
            ].join(' ')}
          >
            <div
              className={[
                'absolute inset-x-0 top-0 h-0.5',
                topBarClass(selected, line.planStatus),
                selected || line.hasPlan ? 'opacity-100' : 'opacity-25',
              ].join(' ')}
            />
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <span className="text-sm font-extrabold tracking-tight text-slate-900">
                L{line.lineNo}
              </span>
              <span
                className={[
                  'rounded-full px-1.5 py-0.5 text-[9px] font-bold ring-1',
                  badgeClass(selected, line.planStatus),
                ].join(' ')}
              >
                {line.statusLabel}
              </span>
            </div>
            <SmtLineGlyph active={selected || line.hasPlan} />
            <p className="mt-1.5 line-clamp-2 min-h-[2.4em] text-[10px] leading-snug font-medium text-slate-600">
              {line.jobLabel}
            </p>
          </button>
        )
      })}
    </div>
  )
}
