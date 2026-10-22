'use client'

import { useMemo, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { ErpNumericInput } from '@/components/ui/erp-numeric-input'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import type { ProductionPlanBoardRow, ProductionPlanScope } from '@/lib/production-plan/types'
import { isProductionPlanScheduleRow } from '@/lib/production-plan/utils'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'

export type ProductionPlanStageValues = {
  scope: ProductionPlanScope
  plannedDate: string
  plannedEndDate: string
  plannedQuantity: number
  team: string
  lineNo: number
}

type StageState = ProductionPlanStageValues & { enabled: boolean }

type ProductionPlanStageScheduleModalProps = {
  row: ProductionPlanBoardRow | null
  seedDate: string
  defaultLineNo?: number
  defaultTeam?: string
  allRows: ProductionPlanBoardRow[]
  saving?: boolean
  onClose: () => void
  onSubmit: (stages: ProductionPlanStageValues[]) => void
}

export const PRODUCTION_PLAN_STAGE_META: Record<
  ProductionPlanScope,
  { label: string; dot: string; ring: string }
> = {
  material: { label: '자재', dot: 'bg-emerald-500', ring: 'border-emerald-200 bg-emerald-50/50' },
  smt: { label: 'SMD', dot: 'bg-sky-500', ring: 'border-sky-200 bg-sky-50/50' },
  post: { label: '후공정', dot: 'bg-violet-500', ring: 'border-violet-200 bg-violet-50/50' },
}

const STAGE_ORDER: ProductionPlanScope[] = ['material', 'smt', 'post']

function stageTargetId(row: ProductionPlanBoardRow, scope: ProductionPlanScope) {
  return scope === 'post' ? row.postTargetId || '' : row.targetId
}

function formatShortRange(start: string, end?: string) {
  const s = start.slice(5, 10).replace('-', '/')
  const e = (end || start).slice(5, 10).replace('-', '/')
  return s === e ? s : `${s}–${e}`
}

export function ProductionPlanStageScheduleModal({
  row,
  seedDate,
  defaultLineNo,
  defaultTeam,
  allRows,
  saving = false,
  onClose,
  onSubmit,
}: ProductionPlanStageScheduleModalProps) {
  const existingByStage = useMemo(() => {
    const map = new Map<ProductionPlanScope, ProductionPlanBoardRow[]>()
    if (!row) return map
    for (const scope of STAGE_ORDER) {
      const targetId = stageTargetId(row, scope)
      map.set(
        scope,
        targetId
          ? allRows.filter(
              (entry) =>
                entry.scope === scope &&
                entry.targetId === targetId &&
                isProductionPlanScheduleRow(entry),
            )
          : [],
      )
    }
    return map
  }, [row, allRows])

  const [stages, setStages] = useState<StageState[]>(() =>
    STAGE_ORDER.map((scope) => {
      const existing = existingByStage.get(scope) ?? []
      const target = row ? Math.max(0, Math.round(row.remainingQty || row.orderQty || 0)) : 0
      const planned =
        scope === 'smt' && row?.splitPcbSides
          ? Math.max(
              ...['TOP', 'BOT'].map((side) =>
                existing
                  .filter((entry) => entry.pcbSide === side || entry.pcbSide === 'BOTH')
                  .reduce((sum, entry) => sum + (entry.plannedQuantity ?? 0), 0),
              ),
            )
          : existing.reduce((sum, entry) => sum + (entry.plannedQuantity ?? 0), 0)
      const unplanned = Math.max(0, target - planned)
      const available = scope !== 'post' || Boolean(row?.postTargetId)
      return {
        scope,
        enabled: available && unplanned > 0,
        plannedDate: seedDate,
        plannedEndDate: seedDate,
        plannedQuantity: Math.max(1, unplanned || target),
        team: defaultTeam || POST_PROCESS_TEAMS[0],
        lineNo: defaultLineNo ?? SMT_PLAN_LINE_NOS[0],
      }
    }),
  )

  if (!row) return null

  function updateStage(scope: ProductionPlanScope, patch: Partial<StageState>) {
    setStages((current) =>
      current.map((stage) => {
        if (stage.scope !== scope) return stage
        const next = { ...stage, ...patch }
        if (next.plannedEndDate < next.plannedDate) next.plannedEndDate = next.plannedDate
        return next
      }),
    )
  }

  const enabledStages = stages.filter((stage) => stage.enabled)
  const invalid = enabledStages.some(
    (stage) =>
      !stage.plannedDate || stage.plannedEndDate < stage.plannedDate || stage.plannedQuantity < 1,
  )
  const smtStage = stages.find((stage) => stage.scope === 'smt')
  const postStage = stages.find((stage) => stage.scope === 'post')
  const postBeforeSmt =
    Boolean(smtStage?.enabled && postStage?.enabled) &&
    postStage!.plannedDate < smtStage!.plannedDate

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

        <div className="space-y-2.5">
          {stages.map((stage) => {
            const meta = PRODUCTION_PLAN_STAGE_META[stage.scope]
            const existing = existingByStage.get(stage.scope) ?? []
            const unavailable = stage.scope === 'post' && !row.postTargetId
            return (
              <div
                key={stage.scope}
                className={`rounded-xl border px-4 py-3 ${stage.enabled ? meta.ring : 'border-slate-200 bg-white'}`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={stage.enabled}
                      disabled={unavailable}
                      onChange={(event) => updateStage(stage.scope, { enabled: event.target.checked })}
                      className="h-4 w-4"
                    />
                    <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden />
                    {meta.label}
                  </label>
                  {unavailable ? (
                    <span className="text-xs text-slate-400">후공정이 없는 품목입니다</span>
                  ) : existing.length ? (
                    <span className="text-xs text-slate-500">
                      이미 배정:{' '}
                      {existing
                        .map(
                          (entry) =>
                            `${formatShortRange(entry.plannedDate, entry.plannedEndDate)} ${(entry.plannedQuantity ?? 0).toLocaleString('ko-KR')}EA${
                              entry.pcbSide === 'TOP' || entry.pcbSide === 'BOT' ? ` ${entry.pcbSide}` : ''
                            }`,
                        )
                        .join(', ')}
                    </span>
                  ) : null}
                </div>

                {stage.enabled ? (
                  <div
                    className={`mt-2.5 grid gap-2.5 ${stage.scope === 'material' ? 'grid-cols-3' : 'grid-cols-4'}`}
                  >
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium text-slate-500">시작일</span>
                      <input
                        type="date"
                        value={stage.plannedDate}
                        onChange={(event) =>
                          updateStage(stage.scope, { plannedDate: event.target.value })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium text-slate-500">종료일</span>
                      <input
                        type="date"
                        value={stage.plannedEndDate}
                        min={stage.plannedDate || undefined}
                        onChange={(event) =>
                          updateStage(stage.scope, { plannedEndDate: event.target.value })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                      />
                    </label>
                    <label className="block text-xs">
                      <span className="mb-1 block font-medium text-slate-500">수량</span>
                      <ErpNumericInput
                        min={1}
                        value={stage.plannedQuantity}
                        onValueChange={(plannedQuantity) =>
                          updateStage(stage.scope, { plannedQuantity })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm tabular-nums"
                      />
                    </label>
                    {stage.scope === 'smt' ? (
                      <label className="block text-xs">
                        <span className="mb-1 block font-medium text-slate-500">라인</span>
                        <select
                          value={stage.lineNo}
                          onChange={(event) =>
                            updateStage(stage.scope, { lineNo: Number(event.target.value) || 1 })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                        >
                          {SMT_PLAN_LINE_NOS.map((lineNo) => (
                            <option key={lineNo} value={lineNo}>
                              {lineNo}라인
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {stage.scope === 'post' ? (
                      <label className="block text-xs">
                        <span className="mb-1 block font-medium text-slate-500">팀</span>
                        <select
                          value={stage.team}
                          onChange={(event) => updateStage(stage.scope, { team: event.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                        >
                          {POST_PROCESS_TEAMS.map((team) => (
                            <option key={team} value={team}>
                              {team}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {postBeforeSmt ? (
          <p className="text-xs font-semibold text-amber-700">
            후공정 시작일이 SMD 시작일보다 빠릅니다.
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <ErpButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </ErpButton>
          <ErpButton
            type="button"
            disabled={saving || invalid || enabledStages.length === 0}
            onClick={() =>
              onSubmit(
                enabledStages.map(
                  ({ scope, plannedDate, plannedEndDate, plannedQuantity, team, lineNo }) => ({
                    scope,
                    plannedDate,
                    plannedEndDate,
                    plannedQuantity: Math.max(1, Math.floor(plannedQuantity)),
                    team,
                    lineNo,
                  }),
                ),
              )
            }
          >
            {saving ? '저장 중…' : `배정 (${enabledStages.length})`}
          </ErpButton>
        </div>
      </div>
    </ErpModal>
  )
}
