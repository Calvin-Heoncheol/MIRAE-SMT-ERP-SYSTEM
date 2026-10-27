'use client'

import { useMemo, useState } from 'react'
import type { PlanCalendarItem } from '@/components/production-plan/production-plan-plan-bars'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { ErpNumericInput } from '@/components/ui/erp-numeric-input'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import { isWeekendYmd } from '@/lib/production-plan/calendar'
import {
  PLAN_BADGE_GROUPS,
  PLAN_BADGE_GROUP_STYLE,
  PLAN_BADGE_META,
  PLAN_BADGE_RANK,
  type PlanBadgeKind,
} from '@/lib/production-plan/plan-badges'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'

export type PlanBadgeValues = {
  kind: PlanBadgeKind
  plannedDate: string
  plannedEndDate: string
  plannedQuantity: number
  lineNo: number
  team: string
}

type ProductionPlanBadgeAssignModalProps = {
  row: ProductionPlanBoardRow
  seedDate: string
  existingItems: PlanCalendarItem[]
  saving?: boolean
  onClose: () => void
  onSubmit: (badges: PlanBadgeValues[]) => void
}

function formatShortRange(start: string, end: string) {
  const s = start.slice(5, 10).replace('-', '/')
  const e = end.slice(5, 10).replace('-', '/')
  return s === e ? s : `${s}–${e}`
}

export function ProductionPlanBadgeAssignModal({
  row,
  seedDate,
  existingItems,
  saving = false,
  onClose,
  onSubmit,
}: ProductionPlanBadgeAssignModalProps) {
  const targetQty = Math.max(1, Math.round(row.remainingQty || row.orderQty || 1))
  const [selected, setSelected] = useState<PlanBadgeValues[]>([])

  function badgeLabel(kind: PlanBadgeKind) {
    if (kind === 'smd_first' && !row.splitPcbSides) return 'SMD 생산'
    return PLAN_BADGE_META[kind].label
  }

  function badgeUnavailable(kind: PlanBadgeKind) {
    if (kind === 'smd_second') return !row.splitPcbSides
    if (kind === 'post') return !row.postTargetId
    return false
  }

  const existingByKind = useMemo(() => {
    const map = new Map<PlanBadgeKind, PlanCalendarItem[]>()
    for (const item of existingItems) {
      map.set(item.kind, [...(map.get(item.kind) ?? []), item])
    }
    return map
  }, [existingItems])

  function toggle(kind: PlanBadgeKind) {
    setSelected((current) =>
      current.some((badge) => badge.kind === kind)
        ? current.filter((badge) => badge.kind !== kind)
        : [
            ...current,
            {
              kind,
              plannedDate: seedDate,
              plannedEndDate: seedDate,
              plannedQuantity: targetQty,
              lineNo: SMT_PLAN_LINE_NOS[0],
              team: POST_PROCESS_TEAMS[0],
            },
          ].sort((a, b) => PLAN_BADGE_RANK[a.kind] - PLAN_BADGE_RANK[b.kind]),
    )
  }

  function update(kind: PlanBadgeKind, patch: Partial<PlanBadgeValues>) {
    setSelected((current) =>
      current.map((badge) => {
        if (badge.kind !== kind) return badge
        const next = { ...badge, ...patch }
        if (next.plannedEndDate < next.plannedDate) next.plannedEndDate = next.plannedDate
        return next
      }),
    )
  }

  const weekendPicked = selected.some(
    (badge) => isWeekendYmd(badge.plannedDate) || isWeekendYmd(badge.plannedEndDate),
  )
  const invalid =
    weekendPicked ||
    selected.some(
      (badge) =>
        !badge.plannedDate || badge.plannedEndDate < badge.plannedDate || badge.plannedQuantity < 1,
    )

  const orderLabel = displayOrderPoNumber(row.customerPoNumber, row.orderNumber) || row.orderNumber

  return (
    <ErpModal open title="생산계획 배정" onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span className="font-mono text-xs text-slate-500">{orderLabel}</span>
          <span className="text-slate-600">{row.customer}</span>
          <span className="font-bold text-slate-900">{row.productName}</span>
          <span className="ml-auto text-slate-600">
            목표{' '}
            <strong className="text-base tabular-nums text-slate-900">
              {Math.round(row.orderQty || 0).toLocaleString('ko-KR')}
            </strong>
            EA
          </span>
        </div>

        <div className="space-y-2">
          {PLAN_BADGE_GROUPS.map(({ group, label, kinds }) => {
            const style = PLAN_BADGE_GROUP_STYLE[group]
            return (
              <div key={group} className="flex flex-wrap items-center gap-2">
                <span className="flex w-16 shrink-0 items-center gap-1.5 text-sm font-bold text-slate-700">
                  <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} aria-hidden />
                  {label}
                </span>
                {kinds
                  .filter((kind) => !(kind === 'smd_second' && !row.splitPcbSides))
                  .map((kind) => {
                    const on = selected.some((badge) => badge.kind === kind)
                    const unavailable = badgeUnavailable(kind)
                    const existingCount = existingByKind.get(kind)?.length ?? 0
                    return (
                      <button
                        key={kind}
                        type="button"
                        disabled={unavailable}
                        onClick={() => toggle(kind)}
                        title={unavailable ? '후공정이 없는 품목입니다' : undefined}
                        className={`rounded-full border px-3 py-1 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          on ? style.chipOn : style.chipOff
                        }`}
                      >
                        {badgeLabel(kind)}
                        {existingCount ? (
                          <span className="ml-1 text-[11px] font-medium opacity-75">
                            ✓{existingCount > 1 ? existingCount : ''}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
              </div>
            )
          })}
        </div>

        {selected.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[7rem_1fr_1fr_6.5rem_6.5rem] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
              <span>일정</span>
              <span>시작일</span>
              <span>종료일</span>
              <span>수량</span>
              <span>라인·팀</span>
            </div>
            {selected.map((badge) => {
              const meta = PLAN_BADGE_META[badge.kind]
              const existing = existingByKind.get(badge.kind) ?? []
              return (
                <div key={badge.kind} className="border-b border-slate-100 px-3 py-2 last:border-b-0">
                  <div className="grid grid-cols-[7rem_1fr_1fr_6.5rem_6.5rem] items-center gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${PLAN_BADGE_GROUP_STYLE[meta.group].dot}`}
                        aria-hidden
                      />
                      {badgeLabel(badge.kind)}
                    </span>
                    <input
                      type="date"
                      value={badge.plannedDate}
                      onChange={(event) => update(badge.kind, { plannedDate: event.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                    />
                    <input
                      type="date"
                      value={badge.plannedEndDate}
                      min={badge.plannedDate || undefined}
                      onChange={(event) => update(badge.kind, { plannedEndDate: event.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                    />
                    <ErpNumericInput
                      min={1}
                      value={badge.plannedQuantity}
                      onValueChange={(plannedQuantity) => update(badge.kind, { plannedQuantity })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm tabular-nums"
                    />
                    {meta.group === 'smd' ? (
                      <select
                        value={badge.lineNo}
                        onChange={(event) =>
                          update(badge.kind, { lineNo: Number(event.target.value) || 1 })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      >
                        {SMT_PLAN_LINE_NOS.map((lineNo) => (
                          <option key={lineNo} value={lineNo}>
                            {lineNo}라인
                          </option>
                        ))}
                      </select>
                    ) : meta.group === 'post' ? (
                      <select
                        value={badge.team}
                        onChange={(event) => update(badge.kind, { team: event.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      >
                        {POST_PROCESS_TEAMS.map((team) => (
                          <option key={team} value={team}>
                            {team}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-center text-xs text-slate-300">—</span>
                    )}
                  </div>
                  {existing.length ? (
                    <p className="mt-1 pl-[7.5rem] text-[11px] text-slate-400">
                      이미 배정:{' '}
                      {existing
                        .map(
                          (item) =>
                            `${formatShortRange(item.plannedDate, item.plannedEndDate)}${
                              item.quantity != null ? ` ${item.quantity.toLocaleString('ko-KR')}EA` : ''
                            }`,
                        )
                        .join(', ')}
                    </p>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
            배정할 일정 뱃지를 선택하세요.
          </p>
        )}

        {weekendPicked ? (
          <p className="text-xs font-semibold text-rose-600">
            토요일·일요일은 시작일이나 종료일로 배정할 수 없습니다.
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <ErpButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </ErpButton>
          <ErpButton
            type="button"
            disabled={saving || invalid || selected.length === 0}
            onClick={() =>
              onSubmit(
                selected.map((badge) => ({
                  ...badge,
                  plannedQuantity: Math.max(1, Math.floor(badge.plannedQuantity)),
                })),
              )
            }
          >
            {saving ? '저장 중…' : `배정 (${selected.length})`}
          </ErpButton>
        </div>
      </div>
    </ErpModal>
  )
}
