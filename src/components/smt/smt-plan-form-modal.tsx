'use client'

import { useMemo, useState } from 'react'
import { SmtPlanMaterialStatusBadge } from '@/components/materials/material-inbound-status-badge'
import { filterSmtPlanOrderCandidates } from '@/components/smt/smt-plan-order-sidebar'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { suggestPlanQuantityFromMaterial } from '@/lib/materials/material-inbound-status'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import type { ProductionPlanStatus } from '@/lib/production-plan/schedule'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'
import type { SmtPlanBlock, SmtPlanOrderCandidate } from '@/lib/smt/plan/types'
import {
  formatDeliveryCountdown,
  getDeliveryUrgencyTone,
  getUnplannedRemainingForSide,
} from '@/lib/smt/plan/utils'
import type { SmtPcbSide } from '@/lib/smt/types'

export type SmtPlanFormValues = {
  id?: string
  orderId: string
  orderLineId: string
  plannedDate: string
  plannedEndDate: string
  planStatus: ProductionPlanStatus
  lineNo: number
  pcbSide: SmtPcbSide
  plannedQuantity: number
  note: string
}

type SmtPlanFormModalProps = {
  open: boolean
  title: string
  order: SmtPlanOrderCandidate | SmtPlanBlock | null
  /** 신규 시 미배정 주문 선택 */
  candidates?: SmtPlanOrderCandidate[]
  onPickCandidate?: (candidate: SmtPlanOrderCandidate) => void
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

function resolveReadyUnits(order: SmtPlanOrderCandidate | SmtPlanBlock) {
  if ('materialReadyUnits' in order) {
    return Math.max(0, Math.floor(Number(order.materialReadyUnits) || 0))
  }
  return 0
}

function resolveScheduledUnits(order: SmtPlanOrderCandidate | SmtPlanBlock) {
  if ('materialScheduledUnits' in order) {
    return Math.max(0, Math.floor(Number(order.materialScheduledUnits) || 0))
  }
  return 0
}

function resolveOrderBreakdown(order: SmtPlanOrderCandidate | SmtPlanBlock) {
  if (!('smtTarget' in order)) return null
  return {
    orderQty: order.smtTarget,
    planned: order.plannedTotal,
    unplanned: order.unplannedRemaining,
  }
}

function formatCandidateQty(candidate: SmtPlanOrderCandidate) {
  if (candidate.splitPcbSides) {
    const top = candidate.unplannedBySide.TOP ?? 0
    const bot = candidate.unplannedBySide.BOT ?? 0
    return {
      orderLabel: candidate.smtTarget.toLocaleString('ko-KR'),
      plannedLabel: candidate.plannedTotal.toLocaleString('ko-KR'),
      unplannedLabel: `TOP ${top.toLocaleString('ko-KR')} · BOT ${bot.toLocaleString('ko-KR')}`,
    }
  }
  const unplanned = candidate.unplannedBySide.SINGLE ?? candidate.unplannedRemaining
  return {
    orderLabel: candidate.smtTarget.toLocaleString('ko-KR'),
    plannedLabel: candidate.plannedTotal.toLocaleString('ko-KR'),
    unplannedLabel: unplanned.toLocaleString('ko-KR'),
  }
}

function urgencyBadgeClass(daysUntilDelivery: number | null) {
  const tone = getDeliveryUrgencyTone(daysUntilDelivery)
  if (tone === 'overdue') return 'bg-rose-100 text-rose-700'
  if (tone === 'urgent') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

function SmtPlanCandidatePicker({
  title,
  description,
  candidates,
  onPick,
  onClose,
}: {
  title: string
  description?: string
  candidates: SmtPlanOrderCandidate[]
  onPick: (candidate: SmtPlanOrderCandidate) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(
    () => filterSmtPlanOrderCandidates(candidates, search),
    [candidates, search],
  )

  return (
    <ErpModal
      open
      size="lg"
      title={title || '이번 차 등록'}
      description={description || '주문서 카드를 선택하면 이번 차 수량을 등록합니다.'}
      onClose={onClose}
      contentClassName="flex min-h-[min(68dvh,720px)] flex-1 flex-col overflow-hidden px-5 py-4"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs text-slate-500 tabular-nums">
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
          placeholder="주문번호 · 고객사 · 제품명 검색"
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          autoFocus
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {search.trim() ? '검색 결과가 없습니다.' : '미배정 주문이 없습니다.'}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((candidate) => {
              const qty = formatCandidateQty(candidate)
              const readyUnits = Math.max(0, Math.floor(candidate.materialReadyUnits ?? 0))
              const scheduledUnits = Math.max(0, Math.floor(candidate.materialScheduledUnits ?? 0))
              const dueLabel = formatDeliveryCountdown(candidate.daysUntilDelivery)

              return (
                <button
                  key={candidate.orderLineId}
                  type="button"
                  onClick={() => onPick(candidate)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left shadow-sm transition hover:border-sky-400 hover:bg-sky-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[11px] text-slate-500">
                      {candidate.customer || '—'} · {formatInternalCodeLabel(candidate.orderNumber)}
                    </p>
                    {dueLabel ? (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${urgencyBadgeClass(candidate.daysUntilDelivery)}`}
                      >
                        {dueLabel}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-bold leading-snug text-slate-900">
                      {candidate.productSummary}
                    </p>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {candidate.splitPcbSides ? '양면' : '단면'}
                    </span>
                  </div>

                  <p className="mt-2 text-[12px] tabular-nums text-slate-600">
                    주문{' '}
                    <span className="font-semibold text-slate-800">{qty.orderLabel}</span>
                    <span className="mx-1 text-slate-300">·</span>
                    기계획{' '}
                    <span className="font-semibold text-slate-800">{qty.plannedLabel}</span>
                    <span className="mx-1 text-slate-300">·</span>
                    미배정{' '}
                    <span className="font-bold text-sky-700">{qty.unplannedLabel}</span>
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <SmtPlanMaterialStatusBadge
                      status={candidate.materialStatus}
                      expectedReadyDate={candidate.materialExpectedReadyDate}
                      readyUnits={readyUnits}
                      scheduledUnits={scheduledUnits}
                    />
                  </div>

                  <span className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-sky-700 px-2.5 py-1.5 text-[12px] font-bold text-white">
                    이번 차 등록
                    {readyUnits > 0 && readyUnits < candidate.unplannedRemaining
                      ? ` · ${readyUnits.toLocaleString('ko-KR')}대`
                      : ''}
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
      remaining += editingQuantity
    }
    return remaining
  }
  return fallbackMax
}

function QuantityQuickFill({
  sideMax,
  readyUnits,
  onPick,
}: {
  sideMax: number | undefined
  readyUnits: number
  onPick: (qty: number) => void
}) {
  if (sideMax == null || sideMax < 1) return null
  const half = Math.max(1, Math.floor(sideMax / 2))
  const ready = readyUnits > 0 ? Math.min(readyUnits, sideMax) : 0
  const options = [
    ready > 0 && ready < sideMax
      ? { label: `자재 ${ready.toLocaleString('ko-KR')}대분`, value: ready }
      : null,
    half < sideMax ? { label: `절반 ${half.toLocaleString('ko-KR')}`, value: half } : null,
    { label: `미배정 전체 ${sideMax.toLocaleString('ko-KR')}`, value: sideMax },
  ].filter(Boolean) as { label: string; value: number }[]

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onPick(option.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
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
  const readyUnits = resolveReadyUnits(order)
  const scheduledUnits = resolveScheduledUnits(order)
  const breakdown = resolveOrderBreakdown(order)
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
    const suggested = initialValues.id
      ? Math.min(values.plannedQuantity, Math.max(1, nextMax || 1))
      : suggestPlanQuantityFromMaterial(nextMax || 1, readyUnits)
    setValues((current) => ({
      ...current,
      pcbSide: nextSide,
      plannedQuantity: Math.max(1, suggested),
    }))
  }

  return (
    <ErpModal
      open
      size="md"
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
        {breakdown ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            <p className="tabular-nums">
              주문{' '}
              <span className="font-semibold text-slate-800">
                {breakdown.orderQty.toLocaleString('ko-KR')}
              </span>
              <span className="mx-1.5 text-slate-300">·</span>
              기계획{' '}
              <span className="font-semibold text-slate-800">
                {breakdown.planned.toLocaleString('ko-KR')}
              </span>
              <span className="mx-1.5 text-slate-300">·</span>
              미배정{' '}
              <span className="font-bold text-sky-700">
                {breakdown.unplanned.toLocaleString('ko-KR')}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <SmtPlanMaterialStatusBadge
                status={'materialStatus' in order ? order.materialStatus : undefined}
                expectedReadyDate={
                  'materialExpectedReadyDate' in order ? order.materialExpectedReadyDate : null
                }
                readyUnits={readyUnits}
                scheduledUnits={scheduledUnits}
              />
            </div>
            {readyUnits > 0 ? (
              <p className="mt-1.5 font-semibold tabular-nums text-emerald-700">
                현재고로 {readyUnits.toLocaleString('ko-KR')}대분 가능
                {readyUnits < (sideMax ?? breakdown.unplanned)
                  ? ' — 부분 배치 권장'
                  : ''}
              </p>
            ) : (
              <p className="mt-1.5 text-slate-500">
                자재 현재고 0대분 — 이번 차 대수를 직접 입력하세요.
              </p>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">SMT 시작일</span>
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
            <span className="mb-1 block font-medium text-slate-600">SMT 종료일</span>
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
            <option value="draft">가계획 (입고예정 기준)</option>
            <option value="confirmed">확정 (이번 주 실행)</option>
          </select>
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

        <div className="block text-sm">
          <label className="block">
            <span className="mb-1 block font-medium text-slate-600">계획 수량 (이번 차)</span>
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
          </label>
          {sideMax != null ? (
            <span className="mt-1 block text-xs text-slate-400">
              {splitPcbSides ? `${values.pcbSide === 'BOT' ? 'BOT' : 'TOP'} 면 ` : ''}
              최대 {sideMax.toLocaleString('ko-KR')}대 · 1·2차로 나눠 등록 가능
            </span>
          ) : null}
          {!initialValues.id ? (
            <QuantityQuickFill
              sideMax={sideMax}
              readyUnits={readyUnits}
              onPick={(qty) => setValues((current) => ({ ...current, plannedQuantity: qty }))}
            />
          ) : null}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">메모</span>
          <input
            type="text"
            value={values.note}
            onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
            placeholder="예: 1차 / 자재 대기"
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
  candidates = [],
  onPickCandidate,
  initialValues,
  maxQuantity,
  saving = false,
  deleting = false,
  onClose,
  onSubmit,
  onDelete,
}: SmtPlanFormModalProps) {
  if (!open) return null

  const unplanned = candidates.filter((c) => c.unplannedRemaining > 0)

  if (!order) {
    const cellHint = [
      initialValues.plannedDate ? `일자 ${initialValues.plannedDate}` : null,
      initialValues.lineNo ? `라인 ${initialValues.lineNo}` : null,
    ]
      .filter(Boolean)
      .join(' · ')

    return (
      <SmtPlanCandidatePicker
        title={title || '이번 차 등록'}
        description={
          cellHint
            ? `${cellHint} · 주문서 카드를 선택하면 이번 차 수량을 등록합니다.`
            : '주문서 카드를 선택하면 이번 차 수량을 등록합니다.'
        }
        candidates={unplanned}
        onPick={(candidate) => onPickCandidate?.(candidate)}
        onClose={onClose}
      />
    )
  }

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
