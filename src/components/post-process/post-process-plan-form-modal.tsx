'use client'

import { useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import type { ProductionPlanStatus } from '@/lib/production-plan/schedule'
import type { PostProcessPlanBlock, PostProcessPlanOrderCandidate } from '@/lib/post-process/plan/types'
import type { PostProcessTeam } from '@/lib/post-process/teams'

export type PostProcessPlanFormValues = {
  id?: string
  orderId: string
  assemblyGroupId: string
  plannedDate: string
  plannedEndDate: string
  planStatus: ProductionPlanStatus
  team: PostProcessTeam
  plannedQuantity: number
  note: string
}

type PostProcessPlanFormModalProps = {
  open: boolean
  title: string
  order: PostProcessPlanOrderCandidate | PostProcessPlanBlock | null
  candidates?: PostProcessPlanOrderCandidate[]
  onPickCandidate?: (candidate: PostProcessPlanOrderCandidate) => void
  initialValues: PostProcessPlanFormValues
  maxQuantity?: number
  saving?: boolean
  deleting?: boolean
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

function PostProcessPlanFormModalInner({
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
  order: PostProcessPlanOrderCandidate | PostProcessPlanBlock
  initialValues: PostProcessPlanFormValues
  maxQuantity?: number
  saving: boolean
  deleting: boolean
  onClose: () => void
  onSubmit: (values: PostProcessPlanFormValues) => void
  onDelete?: () => void
}) {
  const [values, setValues] = useState(initialValues)
  const sideMax = resolveMax(
    order,
    maxQuantity,
    initialValues.id,
    initialValues.id ? initialValues.plannedQuantity : undefined,
  )
  const busy = saving || deleting
  const formId = 'post-process-plan-form'

  return (
    <ErpModal
      open
      size="form"
      title={title}
      description={[
        formatInternalCodeLabel(order.orderNumber),
        order.customer || '—',
        order.productSummary,
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
          onSubmit(values)
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">후공정 시작일</span>
            <input
              type="date"
              value={values.plannedDate}
              onChange={(event) =>
                setValues((current) => {
                  const plannedDate = event.target.value
                  const plannedEndDate =
                    current.plannedEndDate && current.plannedEndDate < plannedDate
                      ? plannedDate
                      : current.plannedEndDate || plannedDate
                  return { ...current, plannedDate, plannedEndDate }
                })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">후공정 종료일</span>
            <input
              type="date"
              value={values.plannedEndDate || values.plannedDate}
              min={values.plannedDate}
              onChange={(event) =>
                setValues((current) => ({ ...current, plannedEndDate: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              required
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">계획 상태</span>
          <select
            value={values.planStatus || 'confirmed'}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                planStatus: event.target.value === 'draft' ? 'draft' : 'confirmed',
              }))
            }
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          >
            <option value="draft">가계획</option>
            <option value="confirmed">확정</option>
          </select>
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
      </form>
    </ErpModal>
  )
}

export function PostProcessPlanFormModal({
  open,
  title,
  order,
  candidates = [],
  onPickCandidate,
  initialValues,
  maxQuantity,
  saving = false,
  deleting = false,
  onClose,
  onSubmit,
  onDelete,
}: PostProcessPlanFormModalProps) {
  if (!open) return null

  const unplanned = candidates.filter((c) => c.unplannedRemaining > 0)

  if (!order) {
    return (
      <ErpModal
        open
        size="form"
        title={title || '생산계획 등록'}
        description="캘린더에 넣을 미배정 발주서를 선택하세요."
        onClose={onClose}
        footer={
          <ErpButton variant="secondary" onClick={onClose}>
            취소
          </ErpButton>
        }
      >
        {unplanned.length === 0 ? (
          <p className="text-sm text-slate-600">미배정 발주서가 없습니다.</p>
        ) : (
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">발주서 / 품목</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              defaultValue=""
              onChange={(event) => {
                const candidate = unplanned.find(
                  (item) => item.assemblyGroupId === event.target.value,
                )
                if (candidate) onPickCandidate?.(candidate)
              }}
            >
              <option value="" disabled>
                선택하세요
              </option>
              {unplanned.map((candidate) => (
                <option key={candidate.assemblyGroupId} value={candidate.assemblyGroupId}>
                  {formatInternalCodeLabel(candidate.orderNumber)} · {candidate.customer} ·{' '}
                  {candidate.productSummary} (미배정 {candidate.unplannedRemaining})
                </option>
              ))}
            </select>
          </label>
        )}
      </ErpModal>
    )
  }

  const formKey = [
    initialValues.id ?? 'new',
    initialValues.assemblyGroupId || initialValues.orderId,
    initialValues.plannedDate,
    initialValues.team,
    initialValues.plannedQuantity,
  ].join(':')

  return (
    <PostProcessPlanFormModalInner
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
