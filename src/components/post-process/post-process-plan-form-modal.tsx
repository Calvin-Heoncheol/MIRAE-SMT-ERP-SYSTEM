'use client'

import { useMemo, useState } from 'react'
import { MaterialInboundStatusBadge } from '@/components/materials/material-inbound-status-badge'
import { filterPostProcessPlanOrderCandidates } from '@/components/post-process/post-process-plan-order-sidebar'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { ProductionPlanStatus } from '@/lib/production-plan/schedule'
import type { PostProcessPlanBlock, PostProcessPlanOrderCandidate } from '@/lib/post-process/plan/types'
import {
  formatCalendarDayLabel,
  formatDeliveryCountdown,
  getDeliveryUrgencyTone,
} from '@/lib/post-process/plan/utils'
import type { PostProcessTeam } from '@/lib/post-process/teams'
import { ERP_BADGE_COMPACT_CLASS } from '@/lib/ui/tokens'

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

function urgencyBadgeClass(daysUntilDelivery: number | null) {
  const tone = getDeliveryUrgencyTone(daysUntilDelivery)
  if (tone === 'overdue') return 'bg-rose-100 text-rose-700'
  if (tone === 'urgent') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

function SmtStatusChip({
  smt,
}: {
  smt: NonNullable<PostProcessPlanOrderCandidate['smt']>
}) {
  const base = ERP_BADGE_COMPACT_CLASS
  if (smt.status === 'done') {
    return <span className={`${base} bg-emerald-50 text-emerald-700 ring-emerald-200`}>SMT 완료</span>
  }
  if (smt.status === 'planned') {
    return (
      <span className={`${base} bg-sky-50 text-sky-700 ring-sky-200`}>
        SMT {smt.lastPlannedDate ? `${formatCalendarDayLabel(smt.lastPlannedDate)} ` : ''}완료예정
      </span>
    )
  }
  if (smt.status === 'partial') {
    return (
      <span className={`${base} bg-amber-50 text-amber-800 ring-amber-200 tabular-nums`}>
        SMT 일부 {smt.coveredQuantity.toLocaleString('ko-KR')}/
        {smt.targetQuantity.toLocaleString('ko-KR')}
      </span>
    )
  }
  return <span className={`${base} bg-rose-50 text-rose-700 ring-rose-200`}>SMT 미계획</span>
}

function PostProcessPlanCandidatePicker({
  title,
  description,
  candidates,
  onPick,
  onClose,
}: {
  title: string
  description?: string
  candidates: PostProcessPlanOrderCandidate[]
  onPick: (candidate: PostProcessPlanOrderCandidate) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(
    () => filterPostProcessPlanOrderCandidates(candidates, search),
    [candidates, search],
  )

  return (
    <ErpModal
      open
      size="lg"
      title={title || '생산계획 등록'}
      description={description || '생산할 발주서 카드를 선택한 뒤 계획 수량을 입력합니다.'}
      onClose={onClose}
      contentClassName="flex min-h-[min(68dvh,720px)] flex-1 flex-col overflow-hidden px-5 py-4"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-slate-500">
            미배정 {candidates.length.toLocaleString('ko-KR')}건
            {search.trim() ? ` · 검색 ${filtered.length.toLocaleString('ko-KR')}건` : ''}
          </span>
          <ErpButton variant="secondary" onClick={onClose}>
            취소
          </ErpButton>
        </div>
      }
    >
      <div className="mb-3 shrink-0">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="발주번호, 고객사, 제품명 검색…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          autoFocus
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {search.trim() ? '검색 결과가 없습니다.' : '지금 계획할 발주서가 없습니다.'}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((candidate) => {
              const dueLabel = formatDeliveryCountdown(candidate.daysUntilDelivery)
              return (
                <button
                  key={candidate.assemblyGroupId}
                  type="button"
                  onClick={() => onPick(candidate)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-sm transition hover:border-slate-400 hover:bg-slate-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[11px] text-slate-500">
                      {candidate.customer || '—'} ·{' '}
                      {displayOrderPoNumber(candidate.customerPoNumber, candidate.orderNumber)}
                    </p>
                    {dueLabel ? (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${urgencyBadgeClass(candidate.daysUntilDelivery)}`}
                      >
                        {dueLabel}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 text-sm font-bold leading-snug text-slate-900">
                    {candidate.productSummary}
                  </p>

                  <p className="mt-2 text-[12px] tabular-nums text-slate-600">
                    목표{' '}
                    <span className="font-semibold text-slate-800">
                      {candidate.target.toLocaleString('ko-KR')}
                    </span>
                    <span className="mx-1 text-slate-300">·</span>
                    기계획{' '}
                    <span className="font-semibold text-slate-800">
                      {candidate.plannedTotal.toLocaleString('ko-KR')}
                    </span>
                    <span className="mx-1 text-slate-300">·</span>
                    미배정{' '}
                    <span className="font-bold text-sky-700">
                      {candidate.unplannedRemaining.toLocaleString('ko-KR')}
                    </span>
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {candidate.smt ? <SmtStatusChip smt={candidate.smt} /> : null}
                    {candidate.materialStatus ? (
                      <MaterialInboundStatusBadge
                        status={candidate.materialStatus}
                        expectedReadyDate={candidate.materialExpectedReadyDate}
                      />
                    ) : null}
                  </div>

                  <span className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-slate-800 px-2.5 py-1.5 text-[12px] font-bold text-white">
                    선택 · 계획수량 입력
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </ErpModal>
  )
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
        displayOrderPoNumber(order.customerPoNumber, order.orderNumber),
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
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
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
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
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            required
            autoFocus
          />
          {sideMax != null ? (
            <span className="mt-1 block text-xs text-slate-400">
              최대 {sideMax.toLocaleString('ko-KR')}대
              {'unplannedRemaining' in order ? (
                <>
                  {' '}
                  · 목표 {order.target.toLocaleString('ko-KR')} · 기계획{' '}
                  {order.plannedTotal.toLocaleString('ko-KR')}
                </>
              ) : null}
            </span>
          ) : null}
          {sideMax != null && sideMax > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                Math.min(sideMax, Math.max(1, Math.floor(sideMax * 0.25))),
                Math.min(sideMax, Math.max(1, Math.floor(sideMax * 0.5))),
                sideMax,
              ]
                .filter((qty, index, list) => list.indexOf(qty) === index)
                .map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setValues((current) => ({ ...current, plannedQuantity: qty }))}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                  >
                    {qty === sideMax ? `전량 ${qty.toLocaleString('ko-KR')}` : qty.toLocaleString('ko-KR')}
                  </button>
                ))}
            </div>
          ) : null}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">메모</span>
          <input
            type="text"
            value={values.note}
            onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
            placeholder="선택 입력"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
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
    const cellHint = initialValues.plannedDate ? `일자 ${initialValues.plannedDate}` : null
    return (
      <PostProcessPlanCandidatePicker
        title={title || '생산계획 등록'}
        description={
          cellHint
            ? `${cellHint} · 발주서 카드를 선택한 뒤 계획 수량을 입력합니다.`
            : '발주서 카드를 선택한 뒤 계획 수량을 입력합니다.'
        }
        candidates={unplanned}
        onPick={(candidate) => onPickCandidate?.(candidate)}
        onClose={onClose}
      />
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
