'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { ErpNumericInput } from '@/components/ui/erp-numeric-input'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import {
  PRODUCTION_PLAN_DAY_CAPACITY_HOURS,
  estimateBoardRowLoad,
  formatCellLoadLabel,
  formatPlanLoadDetail,
  summarizeLoadEstimates,
} from '@/lib/production-plan/capacity'
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
  plannedEndDate: string
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

  const rowLoad = useMemo(() => {
    if (!row || row.scope === 'material') return null
    return estimateBoardRowLoad(row, values.plannedQuantity, values.pcbSide)
  }, [row, values.plannedQuantity, values.pcbSide])

  const cellLoadPreview = useMemo(() => {
    if (!row || row.scope === 'material') return null
    const peers = allRows.filter((entry) => {
      if (entry.scope !== row.scope) return false
      if (!isProductionPlanScheduleRow(entry)) return false
      if (entry.key === row.key) return false
      const start = entry.plannedDate.slice(0, 10)
      const end = (entry.plannedEndDate || entry.plannedDate).slice(0, 10)
      if (values.plannedDate < start || values.plannedDate > end) return false
      if (row.scope === 'smt') {
        return entry.lineNo === values.lineNo
      }
      return String(entry.team || '').trim() === String(values.team || '').trim()
    })
    const estimates = [
      ...peers.map((entry) => estimateBoardRowLoad(entry)),
      estimateBoardRowLoad(row, values.plannedQuantity, values.pcbSide),
    ]
    return summarizeLoadEstimates(estimates)
  }, [row, allRows, values.plannedDate, values.lineNo, values.team, values.plannedQuantity, values.pcbSide])

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

  const endBeforeStart =
    Boolean(values.plannedEndDate) &&
    Boolean(values.plannedDate) &&
    values.plannedEndDate < values.plannedDate

  const selectedSideDone =
    sideOptions.find((option) => option.value === values.pcbSide)?.done === true &&
    row.status !== 'confirmed'

  const showScheduleExtras = row.scope === 'smt' || row.scope === 'post'

  function trySubmit() {
    const plannedQuantity = Math.min(
      maxQuantity,
      Math.max(1, Math.floor(values.plannedQuantity) || 1),
    )
    const plannedEndDate = (values.plannedEndDate || values.plannedDate).slice(0, 10)

    if (rowLoad?.missingStd) {
      const ok = window.confirm(
        '품목에 Tech Time(장비 패널 초)이 없어 시간 부하를 계산할 수 없습니다.\n그래도 저장할까요?',
      )
      if (!ok) return
    } else if (cellLoadPreview?.overCapacity) {
      const ok = window.confirm(
        `해당 칸 부하가 일 ${PRODUCTION_PLAN_DAY_CAPACITY_HOURS}시간을 초과합니다 (${formatCellLoadLabel(cellLoadPreview)}).\n그래도 저장할까요?`,
      )
      if (!ok) return
    }

    onSubmit({
      ...values,
      plannedQuantity,
      plannedEndDate,
    })
  }

  return (
    <ErpModal open={open} title={title} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <p className="font-mono text-xs text-slate-500">{formatInternalCodeLabel(row.orderNumber)}</p>
          <p className="mt-1 font-bold text-slate-900">{row.productName}</p>
          <p className="text-slate-600">{row.customer}</p>
          <p className="mt-2 text-xs text-slate-500">
            {sideUnplanned ? (
              <>
                TOP 잔량 {sideUnplanned.top.toLocaleString('ko-KR')}
                <span className="mx-1.5 text-slate-300">·</span>
                BOT 잔량 {sideUnplanned.bot.toLocaleString('ko-KR')}
              </>
            ) : (
              <>잔량 {row.remainingQty.toLocaleString('ko-KR')}</>
            )}
            {(row.plannedTotalQty ?? 0) > 0
              ? ` · 계획됨 ${row.plannedTotalQty!.toLocaleString('ko-KR')}`
              : ''}
            {!sideUnplanned && (row.unplannedQty ?? 0) > 0
              ? ` · 미계획 ${row.unplannedQty!.toLocaleString('ko-KR')}`
              : ''}
            {row.deliveryDate ? ` · 납기 ${row.deliveryDate}` : ''}
          </p>
          {rowLoad ? (
            <p
              className={`mt-2 text-xs font-semibold ${
                rowLoad.missingStd
                  ? 'text-amber-700'
                  : cellLoadPreview?.overCapacity
                    ? 'text-rose-700'
                    : 'text-slate-700'
              }`}
            >
              {formatPlanLoadDetail(rowLoad)}
              {cellLoadPreview && !cellLoadPreview.quantityOnly ? (
                <span className="mt-1 block font-medium text-slate-500">
                  해당 칸 합계 {formatCellLoadLabel(cellLoadPreview)}
                  {cellLoadPreview.overCapacity
                    ? ` · 일 ${PRODUCTION_PLAN_DAY_CAPACITY_HOURS}시간 초과`
                    : ''}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className={`grid gap-3 ${showScheduleExtras ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">
              {row.scope === 'material' ? '입고일' : '시작일'}
            </span>
            <input
              type="date"
              value={values.plannedDate}
              onChange={(event) => {
                const plannedDate = event.target.value
                setValues((current) => ({
                  ...current,
                  plannedDate,
                  plannedEndDate:
                    !current.plannedEndDate || current.plannedEndDate < plannedDate
                      ? plannedDate
                      : current.plannedEndDate,
                }))
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          {showScheduleExtras ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">종료일</span>
              <input
                type="date"
                value={values.plannedEndDate || values.plannedDate}
                min={values.plannedDate || undefined}
                onChange={(event) =>
                  setValues((current) => ({ ...current, plannedEndDate: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          ) : null}
        </div>
        {endBeforeStart ? (
          <p className="text-xs font-semibold text-rose-600">종료일은 시작일 이후여야 합니다.</p>
        ) : null}

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
            onClick={trySubmit}
            disabled={
              saving ||
              deleting ||
              !values.plannedDate ||
              endBeforeStart ||
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
  const start = (isEditing ? row.plannedDate : plannedDate).slice(0, 10)
  const end = isEditing
    ? (row.plannedEndDate || row.plannedDate || plannedDate).slice(0, 10)
    : start

  return {
    plannedDate: start,
    plannedEndDate: end,
    plannedQuantity: isEditing
      ? Math.max(1, Math.min(Math.max(1, maxQuantity), row.plannedQuantity || 1))
      : Math.max(1, maxQuantity),
    lineNo: row.lineNo && row.lineNo >= 1 ? row.lineNo : 1,
    team: row.team || POST_PROCESS_TEAMS[0],
    pcbSide,
    note: String(row.note || '').trim(),
  }
}
