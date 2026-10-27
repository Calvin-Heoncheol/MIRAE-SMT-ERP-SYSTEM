'use client'

import { useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { ErpNumericInput } from '@/components/ui/erp-numeric-input'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import { isWeekendYmd } from '@/lib/production-plan/calendar'
import type { ProductionPlanEvent } from '@/lib/production-plan/events'
import { PLAN_BADGE_GROUP_STYLE, PLAN_BADGE_META } from '@/lib/production-plan/plan-badges'

export type ProductionPlanEventValues = {
  plannedDate: string
  plannedEndDate: string
  plannedQuantity: number | null
  note: string
}

type ProductionPlanEventModalProps = {
  event: ProductionPlanEvent
  saving?: boolean
  deleting?: boolean
  onClose: () => void
  onSubmit: (values: ProductionPlanEventValues) => void
  onDelete: () => void
}

export function ProductionPlanEventModal({
  event,
  saving = false,
  deleting = false,
  onClose,
  onSubmit,
  onDelete,
}: ProductionPlanEventModalProps) {
  const [values, setValues] = useState<ProductionPlanEventValues>({
    plannedDate: event.plannedDate,
    plannedEndDate: event.plannedEndDate || event.plannedDate,
    plannedQuantity: event.plannedQuantity,
    note: event.note,
  })
  const meta = PLAN_BADGE_META[event.kind]
  const busy = saving || deleting
  const weekendPicked = isWeekendYmd(values.plannedDate) || isWeekendYmd(values.plannedEndDate)
  const invalid = weekendPicked || !values.plannedDate || values.plannedEndDate < values.plannedDate

  function patch(next: Partial<ProductionPlanEventValues>) {
    setValues((current) => {
      const merged = { ...current, ...next }
      if (merged.plannedEndDate < merged.plannedDate) merged.plannedEndDate = merged.plannedDate
      return merged
    })
  }

  return (
    <ErpModal open title={`${meta.label} 일정`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${PLAN_BADGE_GROUP_STYLE[meta.group].dot}`} aria-hidden />
          <span className="font-mono text-xs text-slate-500">
            {displayOrderPoNumber(event.customerPoNumber, event.orderNumber) || event.orderNumber}
          </span>
          <span className="text-slate-600">{event.customer}</span>
          <span className="font-bold text-slate-900">{event.productName}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-500">시작일</span>
            <input
              type="date"
              value={values.plannedDate}
              onChange={(e) => patch({ plannedDate: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-500">종료일</span>
            <input
              type="date"
              value={values.plannedEndDate}
              min={values.plannedDate || undefined}
              onChange={(e) => patch({ plannedEndDate: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-500">수량</span>
            <ErpNumericInput
              min={1}
              value={values.plannedQuantity ?? 0}
              onValueChange={(plannedQuantity) =>
                patch({ plannedQuantity: plannedQuantity > 0 ? plannedQuantity : null })
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm tabular-nums"
            />
          </label>
        </div>

        <label className="block text-xs">
          <span className="mb-1 block font-medium text-slate-500">메모</span>
          <input
            type="text"
            value={values.note}
            onChange={(e) => patch({ note: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
          />
        </label>

        {weekendPicked ? (
          <p className="text-xs font-semibold text-rose-600">
            토요일·일요일은 시작일이나 종료일로 배정할 수 없습니다.
          </p>
        ) : null}

        <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
          <ErpButton type="button" variant="danger" onClick={onDelete} disabled={busy}>
            {deleting ? '삭제 중…' : '삭제'}
          </ErpButton>
          <div className="ml-auto flex gap-2">
            <ErpButton type="button" variant="secondary" onClick={onClose} disabled={busy}>
              취소
            </ErpButton>
            <ErpButton type="button" disabled={busy || invalid} onClick={() => onSubmit(values)}>
              {saving ? '저장 중…' : '저장'}
            </ErpButton>
          </div>
        </div>
      </div>
    </ErpModal>
  )
}
