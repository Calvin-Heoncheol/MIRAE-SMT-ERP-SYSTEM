'use client'

import { useMemo, useState } from 'react'
import { ErpModal } from '@/components/ui/erp-modal'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  materialInboundFilterLabel,
  type MaterialInboundState,
} from '@/lib/materials/manual/utils'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import {
  lineUnplannedQty,
  pickPlanningRowForLine,
  type UnifiedPlanSheetLine,
} from '@/lib/production-plan/unified-plan-lines'
import type { PostProcessTeam } from '@/lib/post-process/teams'
import { formatCalendarDayLabel, formatWeekdayLabel } from '@/lib/smt/plan/utils'
import { ERP_BADGE_COMPACT_CLASS } from '@/lib/ui/tokens'

export type ProductionPlanAssignTarget =
  | { scope: 'smt'; plannedDate: string; lineNo: number }
  | { scope: 'post'; plannedDate: string; team: PostProcessTeam }

type ProductionPlanAssignModalProps = {
  open: boolean
  target: ProductionPlanAssignTarget | null
  pendingLines: UnifiedPlanSheetLine[]
  onClose: () => void
  onSelectRow: (row: ProductionPlanBoardRow) => void
}

function resolveInboundState(row: ProductionPlanBoardRow): MaterialInboundState {
  const target = Math.max(0, Math.floor(row.orderQty))
  const inbound = Math.max(0, Math.floor(row.materialReadyQty))
  if (inbound <= 0) return 'none'
  if (target > 0 && inbound >= target) return 'full'
  return 'partial'
}

function inboundBadgeClass(state: MaterialInboundState) {
  if (state === 'full') return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
  if (state === 'partial') return 'bg-amber-50 text-amber-800 ring-amber-200'
  return 'bg-slate-100 text-slate-600 ring-slate-200'
}

function targetTitle(target: ProductionPlanAssignTarget) {
  const day = `${formatWeekdayLabel(target.plannedDate)} ${formatCalendarDayLabel(target.plannedDate)}`
  if (target.scope === 'smt') return `라인 ${target.lineNo} · ${day}`
  return `${target.team} · ${day}`
}

export function ProductionPlanAssignModal({
  open,
  target,
  pendingLines,
  onClose,
  onSelectRow,
}: ProductionPlanAssignModalProps) {
  const [search, setSearch] = useState('')

  const scope = target?.scope ?? 'smt'

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pendingLines.filter((line) => {
      const row = pickPlanningRowForLine(line, scope)
      if (!row) return false
      if (!q) return true
      const haystack = [
        line.rep.orderNumber,
        line.rep.customerPoNumber,
        line.rep.customer,
        line.rep.productName,
        line.rep.deliveryDate,
        materialInboundFilterLabel(resolveInboundState(line.rep)),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [pendingLines, scope, search])

  if (!open || !target) return null

  return (
    <ErpModal
      open={open}
      title="생산계획 배정"
      description={`${targetTitle(target)} · 일부입고·입고완료만 배정 가능`}
      onClose={() => {
        setSearch('')
        onClose()
      }}
      size="xl"
      fitContent
      dialogClassName="!max-w-[min(920px,96vw)]"
      contentClassName="min-h-0 overflow-hidden p-0"
    >
      <div className="flex max-h-[min(40rem,78dvh)] flex-col">
        <div className="shrink-0 border-b border-slate-200 px-4 py-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="발주번호, 고객사, 제품명 검색…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!filtered.length ? (
            <p className="py-10 text-center text-sm text-slate-400">배정할 발주가 없습니다.</p>
          ) : (
            <>
              <div className="sticky top-0 z-[1] grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_5rem_5.5rem_5.5rem] gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold text-slate-500">
                <span>고객사</span>
                <span>제품</span>
                <span className="text-right">수량</span>
                <span className="text-right">자재입고</span>
                <span className="text-right">상태</span>
              </div>
              <div className="space-y-1.5 p-3">
                {filtered.map((line) => {
                  const planRow = pickPlanningRowForLine(line, scope)
                  if (!planRow) return null
                  const inboundState = resolveInboundState(line.rep)
                  const canAssign = inboundState === 'partial' || inboundState === 'full'
                  const unplanned = lineUnplannedQty(line)
                  return (
                    <button
                      key={line.key}
                      type="button"
                      disabled={!canAssign}
                      title={
                        canAssign ? '클릭하여 배정' : '자재 입고 후 배정할 수 있습니다'
                      }
                      onClick={() => {
                        if (!canAssign) return
                        setSearch('')
                        onSelectRow(planRow)
                      }}
                      className={`grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_5rem_5.5rem_5.5rem] items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                        canAssign
                          ? scope === 'post'
                            ? 'border-violet-200 bg-violet-50 text-violet-900 hover:brightness-95'
                            : 'border-sky-200 bg-sky-50 text-sky-900 hover:brightness-95'
                          : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                      }`}
                    >
                      <p className="min-w-0 truncate text-xs font-semibold">
                        {line.rep.customer || '—'}
                      </p>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{line.rep.productName || '—'}</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] opacity-70">
                          {displayOrderPoNumber(line.rep.customerPoNumber, line.rep.orderNumber) ||
                            '—'}
                        </p>
                      </div>
                      <p className="text-right text-sm font-bold tabular-nums">
                        {unplanned.toLocaleString('ko-KR')}
                      </p>
                      <p className="text-right text-sm font-semibold tabular-nums opacity-80">
                        {Math.max(0, line.rep.materialReadyQty).toLocaleString('ko-KR')}
                      </p>
                      <div className="flex justify-end">
                        <StatusBadge
                          label={materialInboundFilterLabel(inboundState)}
                          className={`${ERP_BADGE_COMPACT_CLASS} ${inboundBadgeClass(inboundState)} ${
                            canAssign ? '' : '!opacity-80'
                          }`}
                        />
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </ErpModal>
  )
}
