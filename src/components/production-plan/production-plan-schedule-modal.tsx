'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { ErpNumericInput } from '@/components/ui/erp-numeric-input'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import { validatePostPlanDate } from '@/lib/production-plan/pipeline'
import {
  isProductionPlanScheduleRow,
  resolveScheduleMaxQuantity,
  computeSmtSideUnplannedQty,
} from '@/lib/production-plan/utils'
import {
  PRODUCTION_PLAN_SCOPE_LABELS,
  type ProductionPlanBoardRow,
  type ProductionPlanPcbSide,
} from '@/lib/production-plan/types'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'

export type ProductionPlanScheduleFormValues = {
  plannedDate: string
  plannedQuantity: number
  lineNo: number
  team: string
  pcbSide: ProductionPlanPcbSide
  note: string
}

type ProductionPlanScheduleModalProps = {
  open: boolean
  row: ProductionPlanBoardRow | null
  allRows?: ProductionPlanBoardRow[]
  initialValues: ProductionPlanScheduleFormValues
  saving?: boolean
  deleting?: boolean
  onClose: () => void
  onSubmit: (values: ProductionPlanScheduleFormValues) => void
  onUnassign?: () => void
}

function resolveDefaultPcbSide(
  row: ProductionPlanBoardRow,
  allRows: ProductionPlanBoardRow[],
): ProductionPlanPcbSide {
  if (!row.splitPcbSides) return 'SINGLE'
  if (row.status === 'confirmed' && row.pcbSide && row.pcbSide !== 'SINGLE') {
    // BOTH는 더 이상 선택하지 않음 — 수정 시 TOP으로 표시
    if (row.pcbSide === 'BOTH') return 'TOP'
    return row.pcbSide
  }
  const sides = computeSmtSideUnplannedQty(allRows, row.targetId, row.orderQty, {
    excludePlanKey: isProductionPlanScheduleRow(row) ? row.key : undefined,
  })
  if (sides.top > 0) return 'TOP'
  if (sides.bot > 0) return 'BOT'
  return 'TOP'
}

export function ProductionPlanScheduleModal({
  open,
  row,
  allRows = [],
  initialValues,
  saving = false,
  deleting = false,
  onClose,
  onSubmit,
  onUnassign,
}: ProductionPlanScheduleModalProps) {
  const [values, setValues] = useState(initialValues)

  useEffect(() => {
    setValues(initialValues)
  }, [initialValues, row?.key, open])

  const sideUnplanned = useMemo(() => {
    if (!row?.splitPcbSides || row.scope !== 'smt') return null
    return computeSmtSideUnplannedQty(allRows, row.targetId, row.orderQty, {
      excludePlanKey: isProductionPlanScheduleRow(row) ? row.key : undefined,
    })
  }, [row, allRows])

  const maxQuantity = row
    ? resolveScheduleMaxQuantity(row, values.pcbSide, allRows)
    : 1

  const sideOptions = useMemo(() => {
    if (!sideUnplanned) return []
    return [
      {
        value: 'TOP' as const,
        label: 'TOP',
        remaining: sideUnplanned.top,
        done: sideUnplanned.top <= 0,
      },
      {
        value: 'BOT' as const,
        label: 'BOT',
        remaining: sideUnplanned.bot,
        done: sideUnplanned.bot <= 0,
      },
    ]
  }, [sideUnplanned])

  function applyPcbSide(nextSide: ProductionPlanPcbSide) {
    if (!row) return
    const nextMax = resolveScheduleMaxQuantity(row, nextSide, allRows)
    setValues((current) => ({
      ...current,
      pcbSide: nextSide,
      plannedQuantity: Math.max(1, nextMax),
    }))
  }

  if (!open || !row) return null

  const title =
    row.status === 'confirmed'
      ? '생산계획 수정'
      : `${PRODUCTION_PLAN_SCOPE_LABELS[row.scope]} 생산계획 배정`

  const postDateHint =
    row.scope === 'post'
      ? validatePostPlanDate(row, values.plannedDate, allRows)
      : { ok: true as const }

  const selectedSideDone =
    sideOptions.find((option) => option.value === values.pcbSide)?.done === true &&
    row.status !== 'confirmed'

  return (
    <ErpModal open={open} title={title} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-mono text-xs text-slate-500">{formatInternalCodeLabel(row.orderNumber)}</p>
          <p className="mt-1 font-bold text-slate-900">{row.productName}</p>
          <p className="text-slate-600">{row.customer}</p>
          <p className="mt-2 text-xs text-slate-500">
            잔량 {row.remainingQty.toLocaleString('ko-KR')}
            {(row.plannedTotalQty ?? 0) > 0
              ? ` · 계획됨 ${row.plannedTotalQty!.toLocaleString('ko-KR')}`
              : ''}
            {(row.unplannedQty ?? 0) > 0
              ? ` · 미계획 ${row.unplannedQty!.toLocaleString('ko-KR')}`
              : ''}
            {row.deliveryDate ? ` · 납기 ${row.deliveryDate}` : ''}
          </p>
          {sideUnplanned ? (
            <p className="mt-1.5 text-xs font-semibold text-slate-700">
              TOP 잔량 {sideUnplanned.top.toLocaleString('ko-KR')}
              <span className="mx-1.5 text-slate-300">·</span>
              BOT 잔량 {sideUnplanned.bot.toLocaleString('ko-KR')}
            </p>
          ) : null}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">
            {row.scope === 'material' ? '입고일' : '계획일'}
          </span>
          <input
            type="date"
            value={values.plannedDate}
            onChange={(event) => setValues((current) => ({ ...current, plannedDate: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">
            {row.scope === 'material' ? '입고 수량' : '계획 수량'}
          </span>
          <ErpNumericInput
            min={1}
            max={maxQuantity}
            value={values.plannedQuantity}
            onValueChange={(plannedQuantity) =>
              setValues((current) => ({ ...current, plannedQuantity }))
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums"
          />
          <span className="mt-1 block text-xs text-slate-400">최대 {maxQuantity.toLocaleString('ko-KR')}</span>
          {row.scope === 'post' && row.smtPlannedEndDate ? (
            <span className="mt-1 block text-xs text-violet-600">
              SMD 종료 {row.smtPlannedEndDate} 이후부터 배정 가능
            </span>
          ) : null}
          {!postDateHint.ok ? (
            <span className="mt-1 block text-xs font-semibold text-rose-600">{postDateHint.detail}</span>
          ) : null}
        </label>

        {row.scope === 'smt' ? (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">SMT 라인</span>
              <select
                value={values.lineNo}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    lineNo: Math.max(1, Math.floor(Number(event.target.value) || 1)),
                  }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                {SMT_PLAN_LINE_NOS.map((lineNo) => (
                  <option key={lineNo} value={lineNo}>
                    라인 {lineNo}
                  </option>
                ))}
              </select>
            </label>
            {row.splitPcbSides ? (
              <div className="block text-sm">
                <span className="mb-1.5 block font-medium text-slate-600">PCB 면</span>
                <div className="grid grid-cols-2 gap-2">
                  {sideOptions.map((option) => {
                    const selected = values.pcbSide === option.value
                    const disabled = option.done && !selected
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => applyPcbSide(option.value)}
                        className={[
                          'rounded-lg border px-2 py-2 text-center text-xs font-bold transition',
                          selected
                            ? 'border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-200'
                            : option.done
                              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50/60',
                        ].join(' ')}
                        title={
                          option.done
                            ? `${option.label} 이미 계획 완료`
                            : `${option.label} 잔량 ${option.remaining.toLocaleString('ko-KR')}`
                        }
                      >
                        <span className={option.done && !selected ? 'line-through' : undefined}>
                          {option.label}
                        </span>
                        <span
                          className={`mt-0.5 block text-[11px] font-semibold tabular-nums ${
                            option.done ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {option.done ? '완료' : `잔량 ${option.remaining.toLocaleString('ko-KR')}`}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <span className="mt-1.5 block text-xs text-slate-400">
                  면별로 나눠 계획합니다. 완료된 면은 선택할 수 없습니다.
                </span>
                {selectedSideDone ? (
                  <span className="mt-1 block text-xs font-semibold text-amber-700">
                    선택한 면은 이미 계획이 끝난 상태입니다. 다른 면을 선택해 주세요.
                  </span>
                ) : null}
              </div>
            ) : null}
          </>
        ) : row.scope === 'post' ? (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">후공정 팀</span>
            <select
              value={values.team}
              onChange={(event) => setValues((current) => ({ ...current, team: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {POST_PROCESS_TEAMS.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">메모</span>
          <textarea
            value={values.note}
            onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
            placeholder="선택 사항"
          />
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          {onUnassign ? (
            <ErpButton type="button" variant="danger" onClick={onUnassign} disabled={saving || deleting}>
              {deleting ? '삭제 중…' : '삭제'}
            </ErpButton>
          ) : null}
          <ErpButton type="button" variant="secondary" onClick={onClose} disabled={saving || deleting}>
            취소
          </ErpButton>
          <ErpButton
            type="button"
            onClick={() => {
              const plannedQuantity = Math.min(
                maxQuantity,
                Math.max(1, Math.floor(values.plannedQuantity) || 1),
              )
              onSubmit({ ...values, plannedQuantity })
            }}
            disabled={
              saving ||
              deleting ||
              !values.plannedDate ||
              !postDateHint.ok ||
              selectedSideDone ||
              maxQuantity <= 0
            }
          >
            {saving ? '저장 중…' : '저장'}
          </ErpButton>
        </div>
      </div>
    </ErpModal>
  )
}

export function buildScheduleFormValues(
  row: ProductionPlanBoardRow,
  plannedDate: string,
  allRows: ProductionPlanBoardRow[] = [],
): ProductionPlanScheduleFormValues {
  const pcbSide = resolveDefaultPcbSide(row, allRows)
  const maxQuantity = resolveScheduleMaxQuantity(row, pcbSide, allRows)
  const isEditing =
    Boolean(row.plannedQuantity && row.plannedQuantity > 0 && row.status === 'confirmed')

  return {
    plannedDate,
    plannedQuantity: isEditing
      ? Math.max(1, Math.min(Math.max(1, maxQuantity), row.plannedQuantity || 1))
      : Math.max(1, maxQuantity),
    lineNo: row.lineNo && row.lineNo >= 1 ? row.lineNo : 1,
    team: row.team || POST_PROCESS_TEAMS[0],
    pcbSide,
    note: String(row.note || '').trim(),
  }
}
