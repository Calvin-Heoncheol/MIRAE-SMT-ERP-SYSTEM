'use client'

import { useState } from 'react'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import type { PostProcessPlanBlock, PostProcessPlanOrderCandidate } from '@/lib/post-process/plan/types'
import type { PostProcessTeam } from '@/lib/post-process/teams'

export type PostProcessPlanFormValues = {
  id?: string
  orderId: string
  assemblyGroupId: string
  plannedDate: string
  team: PostProcessTeam
  plannedQuantity: number
  note: string
}

type PostProcessPlanFormModalProps = {
  open: boolean
  title: string
  order: PostProcessPlanOrderCandidate | PostProcessPlanBlock | null
  initialValues: PostProcessPlanFormValues
  maxQuantity?: number
  saving?: boolean
  deleting?: boolean
  onClose: () => void
  onSubmit: (values: PostProcessPlanFormValues) => void
  onDelete?: () => void
}

type BodyProps = {
  order: PostProcessPlanOrderCandidate | PostProcessPlanBlock
  initialValues: PostProcessPlanFormValues
  maxQuantity?: number
  saving: boolean
  deleting: boolean
  onClose: () => void
  onSubmit: (values: PostProcessPlanFormValues) => void
  onDelete?: () => void
}

function resolveMax(
  order: PostProcessPlanOrderCandidate | PostProcessPlanBlock,
  fallbackMax: number | undefined,
  editingPlanId?: string,
  editingQuantity?: number,
) {
  if ('unplannedRemaining' in order) {
    let remaining = Math.max(0, order.unplannedRemaining)
    if (editingPlanId && editingQuantity != null) {
      remaining += editingQuantity
    }
    return remaining
  }
  return fallbackMax
}

function FormBody({
  order,
  initialValues,
  maxQuantity,
  saving,
  deleting,
  onClose,
  onSubmit,
  onDelete,
}: BodyProps) {
  const [values, setValues] = useState(initialValues)
  const sideMax = resolveMax(
    order,
    maxQuantity,
    initialValues.id,
    initialValues.id ? initialValues.plannedQuantity : undefined,
  )

  return (
    <form
      className="space-y-4 px-5 py-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(values)
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-600">계획일</span>
        <input
          type="date"
          value={values.plannedDate}
          onChange={(event) => setValues((current) => ({ ...current, plannedDate: event.target.value }))}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          required
        />
      </label>

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

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div>
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={saving || deleting}
              className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              {deleting ? '삭제 중…' : '삭제'}
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving || deleting || (sideMax != null && sideMax < 1)}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </form>
  )
}

export function PostProcessPlanFormModal({
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
}: PostProcessPlanFormModalProps) {
  if (!open || !order) return null

  const formKey = [
    initialValues.id ?? 'new',
    initialValues.assemblyGroupId || initialValues.orderId,
    initialValues.plannedDate,
    initialValues.team,
    initialValues.plannedQuantity,
  ].join(':')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-process-plan-modal-title"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 id="post-process-plan-modal-title" className="text-base font-bold text-slate-900">
            {title}
          </h3>
          <p className="mt-1 font-mono text-xs text-slate-500">
            {formatInternalCodeLabel(order.orderNumber)}
          </p>
          <p className="text-sm text-slate-600">{order.customer || '—'}</p>
          <p className="text-sm font-medium text-slate-800">{order.productSummary}</p>
        </div>

        <FormBody
          key={formKey}
          order={order}
          initialValues={initialValues}
          maxQuantity={maxQuantity}
          saving={saving}
          deleting={deleting}
          onClose={onClose}
          onSubmit={onSubmit}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}
