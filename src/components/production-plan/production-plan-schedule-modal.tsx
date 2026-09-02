'use client'

import { useEffect, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { suggestPlanQuantityFromMaterial } from '@/lib/materials/material-inbound-status'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import { validatePostPlanDate, canPlanSmt } from '@/lib/production-plan/pipeline'
import { isProductionPlanRemainderRow, isProductionPlanScheduleRow } from '@/lib/production-plan/utils'
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

  const maxQuantity = row
    ? (() => {
        if (isProductionPlanRemainderRow(row)) {
          return Math.max(1, row.unplannedQty ?? row.remainingQty)
        }
        if (isProductionPlanScheduleRow(row) && row.plannedQuantity) {
          const cap = Math.min(
            row.remainingQty,
            row.plannedQuantity + (row.unplannedQty ?? 0),
          )
          if (row.materialShort && row.materialReadyQty > 0) {
            return Math.min(cap, row.materialReadyQty)
          }
          return Math.max(1, cap)
        }
        if (row.materialShort && row.materialReadyQty > 0) {
          return Math.min(row.remainingQty, row.materialReadyQty)
        }
        return Math.max(1, row.unplannedQty ?? row.remainingQty)
      })()
    : 1

  if (!open || !row) return null

  const title =
    row.status === 'confirmed'
      ? '생산계획 수정'
      : `${PRODUCTION_PLAN_SCOPE_LABELS[row.scope]} 생산계획 배정`

  const postDateHint =
    row.scope === 'post'
      ? validatePostPlanDate(row, values.plannedDate, allRows)
      : { ok: true as const }

  const materialWarning =
    row.scope === 'smt' && !canPlanSmt(row)
      ? '자재 입고가 완료되지 않았습니다. 생산 전 자재 준비를 확인해 주세요.'
      : ''

  return (
    <ErpModal open={open} title={title} onClose={onClose} size="md">
      <div className="space-y-4">
        {materialWarning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            {materialWarning}
          </div>
        ) : null}
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
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">계획일</span>
          <input
            type="date"
            value={values.plannedDate}
            onChange={(event) => setValues((current) => ({ ...current, plannedDate: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">계획 수량</span>
          <input
            type="number"
            min={1}
            max={maxQuantity}
            value={values.plannedQuantity}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                plannedQuantity: Math.max(1, Math.floor(Number(event.target.value) || 0)),
              }))
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
                  setValues((current) => ({ ...current, lineNo: Number(event.target.value) }))
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
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">PCB 면</span>
                <select
                  value={values.pcbSide}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      pcbSide: event.target.value as ProductionPlanPcbSide,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="TOP">TOP</option>
                  <option value="BOT">BOT</option>
                  <option value="BOTH">TOP + BOT</option>
                </select>
              </label>
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
            onClick={() => onSubmit(values)}
            disabled={saving || deleting || !values.plannedDate || !postDateHint.ok}
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
): ProductionPlanScheduleFormValues {
  const baseQty = row.unplannedQty ?? row.remainingQty
  const suggestedQty = suggestPlanQuantityFromMaterial(baseQty, row.materialReadyQty)

  return {
    plannedDate,
    plannedQuantity:
      row.plannedQuantity && row.plannedQuantity > 0 && row.status === 'confirmed'
        ? row.plannedQuantity
        : Math.max(1, suggestedQty),
    lineNo: row.lineNo && row.lineNo >= 1 ? row.lineNo : 1,
    team: row.team || POST_PROCESS_TEAMS[0],
    pcbSide: row.splitPcbSides ? row.pcbSide === 'SINGLE' ? 'TOP' : row.pcbSide : 'SINGLE',
    note: '',
  }
}
