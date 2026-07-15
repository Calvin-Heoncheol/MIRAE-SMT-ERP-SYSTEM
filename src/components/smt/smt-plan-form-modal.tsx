'use client'

import { useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'
import type { SmtPlanBlock, SmtPlanOrderCandidate } from '@/lib/smt/plan/types'
import { getUnplannedRemainingForSide } from '@/lib/smt/plan/utils'
import type { SmtPcbSide } from '@/lib/smt/types'

export type SmtPlanFormValues = {
  id?: string
  orderId: string
  orderLineId: string
  plannedDate: string
  lineNo: number
  pcbSide: SmtPcbSide
  plannedQuantity: number
  note: string
}

type SmtPlanFormModalProps = {
  open: boolean
  title: string
  order: SmtPlanOrderCandidate | SmtPlanBlock | null
  initialValues: SmtPlanFormValues
  maxQuantity?: number
  saving?: boolean
  deleting?: boolean
  onClose: () => void
  onSubmit: (values: SmtPlanFormValues) => void
  onDelete?: () => void
}

function resolveSplitPcbSides(order: SmtPlanOrderCandidate | SmtPlanBlock) {
  if ('splitPcbSides' in order) return Boolean(order.splitPcbSides)
  return false
}

function resolveMaxForSide(
  order: SmtPlanOrderCandidate | SmtPlanBlock,
  pcbSide: SmtPcbSide,
  fallbackMax: number | undefined,
  editingPlanId?: string,
  editingQuantity?: number,
) {
  if ('unplannedBySide' in order) {
    let remaining = getUnplannedRemainingForSide(order, pcbSide)
    if (editingPlanId && editingQuantity != null) {
      // 수정 시 현재 계획 수량을 다시 허용
      remaining += editingQuantity
    }
    return remaining
  }
  return fallbackMax
}

function SmtPlanFormModalInner({
  title,
  order,
  initialValues,
  maxQuantity,
  saving,
  deleting,
  onClose,
  onSubmit,
  onDelete,
}: {
  title: string
  order: SmtPlanOrderCandidate | SmtPlanBlock
  initialValues: SmtPlanFormValues
  maxQuantity?: number
  saving: boolean
  deleting: boolean
  onClose: () => void
  onSubmit: (values: SmtPlanFormValues) => void
  onDelete?: () => void
}) {
  const splitPcbSides = resolveSplitPcbSides(order)
  const [values, setValues] = useState(initialValues)
  const sideMax = resolveMaxForSide(
    order,
    values.pcbSide,
    maxQuantity,
    initialValues.id,
    initialValues.id && values.pcbSide === initialValues.pcbSide
      ? initialValues.plannedQuantity
      : undefined,
  )
  const busy = saving || deleting
  const formId = 'smt-plan-form'

  function setPcbSide(nextSide: SmtPcbSide) {
    const nextMax = resolveMaxForSide(
      order,
      nextSide,
      maxQuantity,
      initialValues.id,
      initialValues.id && initialValues.pcbSide === nextSide
        ? initialValues.plannedQuantity
        : undefined,
    )
    setValues((current) => ({
      ...current,
      pcbSide: nextSide,
      plannedQuantity: Math.max(1, nextMax || 1),
    }))
  }

  return (
    <ErpModal
      open
      size="form"
      title={title}
      description={[
        formatInternalCodeLabel(order.orderNumber),
        order.customer || '—',
        `${order.productSummary}${splitPcbSides ? ' · 양면' : ''}`,
      ].join(' · ')}
      onClose={onClose}
      closeOnEscape={!busy}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div>
            {onDelete ? (
              <ErpButton variant="danger" onClick={onDelete} disabled={busy}>
                {deleting ? '삭제 중…' : '삭제'}
              </ErpButton>
            ) : (
              <span />
            )}
          </div>
          <div className="flex gap-2">
            <ErpButton variant="secondary" onClick={onClose} disabled={busy}>
              취소
            </ErpButton>
            <ErpButton
              type="submit"
              form={formId}
              disabled={busy || (sideMax != null && sideMax < 1)}
            >
              {saving ? '저장 중…' : '저장'}
            </ErpButton>
          </div>
        </div>
      }
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit({
            ...values,
            pcbSide: splitPcbSides
              ? values.pcbSide === 'BOT'
                ? 'BOT'
                : 'TOP'
              : 'SINGLE',
          })
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">계획일</span>
          <input
            type="date"
            value={values.plannedDate}
            onChange={(event) =>
              setValues((current) => ({ ...current, plannedDate: event.target.value }))
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">SMT 라인</span>
          <select
            value={values.lineNo}
            onChange={(event) =>
              setValues((current) => ({ ...current, lineNo: Number(event.target.value) }))
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            {SMT_PLAN_LINE_NOS.map((lineNo) => (
              <option key={lineNo} value={lineNo}>
                라인 {lineNo}
              </option>
            ))}
          </select>
        </label>

        {splitPcbSides ? (
          <fieldset className="block text-sm">
            <legend className="mb-1 block font-medium text-slate-600">면구분</legend>
            <div className="grid grid-cols-2 gap-2">
              {(['TOP', 'BOT'] as const).map((side) => {
                const active = values.pcbSide === side
                return (
                  <button
                    key={side}
                    type="button"
                    onClick={() => setPcbSide(side)}
                    className={[
                      'rounded-lg border px-3 py-2 text-sm font-semibold transition',
                      active
                        ? 'border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    {side}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">계획 수량</span>
          <input
            type="number"
            min={1}
            max={sideMax}
            value={values.plannedQuantity}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                plannedQuantity: Math.max(1, Math.floor(Number(event.target.value) || 1)),
              }))
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            required
          />
          {sideMax != null ? (
            <span className="mt-1 block text-xs text-slate-400">
              {splitPcbSides ? `${values.pcbSide === 'BOT' ? 'BOT' : 'TOP'} 면 ` : ''}
              최대 {sideMax.toLocaleString('ko-KR')}대
            </span>
          ) : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">메모</span>
          <input
            type="text"
            value={values.note}
            onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
            placeholder="선택 입력"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </label>
      </form>
    </ErpModal>
  )
}

export function SmtPlanFormModal({
  open,
  title,
  order,
  initialValues,
  maxQuantity,
  saving = false,
  deleting = false,
  onClose,
  onSubmit,
  onDelete,
}: SmtPlanFormModalProps) {
  if (!open || !order) return null

  const formKey = [
    initialValues.id ?? 'new',
    initialValues.orderLineId || initialValues.orderId,
    initialValues.pcbSide,
    initialValues.plannedDate,
    initialValues.lineNo,
    initialValues.plannedQuantity,
  ].join(':')

  return (
    <SmtPlanFormModalInner
      key={formKey}
      title={title}
      order={order}
      initialValues={initialValues}
      maxQuantity={maxQuantity}
      saving={saving}
      deleting={deleting}
      onClose={onClose}
      onSubmit={onSubmit}
      onDelete={onDelete}
    />
  )
}
