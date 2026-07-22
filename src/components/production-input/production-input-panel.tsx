'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { buildPostProcessPlanProgressKey } from '@/lib/post-process/count-keys'
import type { PostProcessPlanBlock } from '@/lib/post-process/plan/types'
import { createPostProcessProductionRecord } from '@/lib/post-process/repository'
import type { PostProcessTeam } from '@/lib/post-process/teams'
import { buildSmtCountKey, buildSmtPlanProgressKey } from '@/lib/smt/count-keys'
import { createSmtProductionRecord } from '@/lib/smt/repository'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'
import type { SmtPlanBlock } from '@/lib/smt/plan/types'
import type { SmtPcbSide } from '@/lib/smt/types'
import type { ProductionInputConfig, ProductionOrderLine } from '@/lib/production-input/types'
import {
  formatProductionProductName,
  getProgressPercent,
  resolveProductionSideCount,
} from '@/lib/production-input/utils'
import { ERP_FIELD_INPUT_CLASS } from '@/lib/ui/tokens'

function formatSmtPlanChipLabel(plan: SmtPlanBlock) {
  const side = plan.pcbSide === 'TOP' || plan.pcbSide === 'BOT' ? plan.pcbSide : '단면'
  return `${plan.productSummary || plan.orderNumber} · ${side} · ${plan.plannedQuantity.toLocaleString('ko-KR')}대`
}

function formatPostProcessPlanChipLabel(plan: PostProcessPlanBlock) {
  return `${plan.productSummary || plan.orderNumber} · ${plan.plannedQuantity.toLocaleString('ko-KR')}대`
}

function isSmtPlan(plan: SmtPlanBlock | PostProcessPlanBlock): plan is SmtPlanBlock {
  return 'lineNo' in plan && 'pcbSide' in plan
}

type ProductionInputPanelProps = {
  order: ProductionOrderLine | null
  counts: Record<string, number>
  config: Pick<ProductionInputConfig, 'qtyInputId' | 'productionModule'>
  onCountUpdated: (countKey: string, cumulative: number) => void
  /** SMT 생산입력 — 선택한 라인 번호 */
  lineNo?: number | null
  onLineNoChange?: (lineNo: number | null) => void
  showLineSelector?: boolean
  smtLinePlans?: SmtPlanBlock[]
  showPostProcessPlanSelector?: boolean
  postProcessTeam?: PostProcessTeam
  postProcessPlans?: PostProcessPlanBlock[]
  selectedPlanId?: string | null
  onSelectPlan?: (planId: string) => void
  emptyPlanHint?: string
  planSetupHref?: string
  /** 생산계획에 고정 (계획수량 잠금) */
  plan?: SmtPlanBlock | PostProcessPlanBlock | null
  /** 오늘 해당 계획에 이미 등록한 수량 */
  planProduced?: number
  onPlanProgressUpdated?: (progressKey: string, produced: number) => void
}

export function ProductionInputPanel({
  order,
  counts,
  config,
  onCountUpdated,
  lineNo = null,
  onLineNoChange,
  showLineSelector = false,
  smtLinePlans = [],
  showPostProcessPlanSelector = false,
  postProcessTeam,
  postProcessPlans = [],
  selectedPlanId = null,
  onSelectPlan,
  emptyPlanHint,
  planSetupHref,
  plan = null,
  planProduced = 0,
  onPlanProgressUpdated,
}: ProductionInputPanelProps) {
  const [activeSide, setActiveSide] = useState<SmtPcbSide>('SINGLE')
  const [qty, setQty] = useState('')
  const [defectQty, setDefectQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const isPostProcess = config.productionModule === 'post_process'
  const lockToPlan = Boolean(plan)
  const smtPlan = plan && isSmtPlan(plan) ? plan : null
  const postProcessPlan = plan && !isSmtPlan(plan) ? plan : null
  const isDual = Boolean(order?.splitPcbSides) && !isPostProcess && !lockToPlan

  const pcbSide: SmtPcbSide = smtPlan
    ? smtPlan.pcbSide === 'TOP' || smtPlan.pcbSide === 'BOT'
      ? smtPlan.pcbSide
      : 'SINGLE'
    : isDual
      ? activeSide === 'BOT'
        ? 'BOT'
        : 'TOP'
      : 'SINGLE'

  const orderCumulative = order ? resolveProductionSideCount(order, counts, pcbSide) : 0
  const orderTarget = order ? Math.max(0, Math.floor(order.quantity)) : 0
  const orderRemaining = Math.max(0, orderTarget - orderCumulative)

  const planTarget = lockToPlan ? Math.max(0, Math.floor(plan!.plannedQuantity)) : 0
  const planDone = lockToPlan ? Math.max(0, Math.floor(planProduced)) : 0
  const planRemaining = lockToPlan ? Math.max(0, planTarget - planDone) : 0

  const cumulative = lockToPlan ? planDone : orderCumulative
  const target = lockToPlan ? planTarget : orderTarget
  const remaining = lockToPlan ? Math.min(planRemaining, orderRemaining) : orderRemaining
  const progress = getProgressPercent(cumulative, target)

  const assemblyGroupId = order?.assemblyGroupId || order?.orderLineId || ''
  const lineSelected =
    !showLineSelector || lockToPlan || (lineNo != null && lineNo >= 1 && lineNo <= 7)
  const canRegister =
    Boolean(order) &&
    remaining > 0 &&
    lineSelected &&
    (isPostProcess ? Boolean(assemblyGroupId) : Boolean(order?.orderLineId))

  const qtyNumber = Math.max(0, Math.floor(Number(qty) || 0))
  const sideLabel = pcbSide === 'TOP' || pcbSide === 'BOT' ? pcbSide : null

  useEffect(() => {
    if (smtPlan) {
      setActiveSide(
        smtPlan.pcbSide === 'TOP' || smtPlan.pcbSide === 'BOT' ? smtPlan.pcbSide : 'SINGLE',
      )
    } else if (order?.splitPcbSides) {
      setActiveSide('TOP')
    } else {
      setActiveSide('SINGLE')
    }
    setQty('')
    setDefectQty('')
    setMessage(null)
  }, [order?.uiKey, order?.splitPcbSides, lockToPlan, plan?.id, smtPlan?.pcbSide])

  useEffect(() => {
    if (lockToPlan) return
    setQty('')
    setDefectQty('')
    setMessage(null)
  }, [activeSide, lockToPlan])

  function setQtyClamped(next: number) {
    const value = Math.max(0, Math.min(remaining, Math.floor(next)))
    setQty(value > 0 ? String(value) : '')
    setMessage(null)
  }

  function setDefectQtyValue(next: number) {
    const value = Math.max(0, Math.floor(next))
    setDefectQty(value > 0 ? String(value) : '')
    setMessage(null)
  }

  function bumpQty(delta: number) {
    setQtyClamped(qtyNumber + delta)
  }

  async function handleSubmit() {
    if (!order) return

    if (showLineSelector && !lockToPlan && (lineNo == null || lineNo < 1 || lineNo > 7)) {
      setMessage({ text: 'SMT 라인을 선택하세요.', kind: 'err' })
      return
    }

    const value = Math.floor(Number(qty))
    const defectValue = Math.max(0, Math.floor(Number(defectQty) || 0))
    if (!value || value < 1) {
      setMessage({ text: '양품 수량을 입력하세요.', kind: 'err' })
      return
    }
    if (target > 0 && value > remaining) {
      setMessage({
        text: lockToPlan
          ? `계획 남은 수량(${remaining.toLocaleString('ko-KR')})을 초과할 수 없습니다.`
          : isPostProcess
            ? `남은 수량(${remaining.toLocaleString('ko-KR')})을 초과할 수 없습니다.`
            : `${pcbSide} 면 남은 수량(${remaining.toLocaleString('ko-KR')})을 초과할 수 없습니다.`,
        kind: 'err',
      })
      return
    }

    setSaving(true)
    setMessage(null)

    function formatRegisterOk(cumulativeOrPlanText: string) {
      return defectValue > 0
        ? `양품 ${value.toLocaleString('ko-KR')} · 불량 ${defectValue.toLocaleString('ko-KR')} 등록 · ${cumulativeOrPlanText}`
        : `양품 ${value.toLocaleString('ko-KR')}개 등록 · ${cumulativeOrPlanText}`
    }

    if (isPostProcess) {
      const result = await createPostProcessProductionRecord({
        assemblyGroupId,
        quantity: value,
        defectQuantity: defectValue,
        recordDate: postProcessPlan?.plannedDate,
        team: postProcessPlan?.team || postProcessTeam,
      })

      setSaving(false)

      if (!result.ok) {
        setMessage({ text: result.detail, kind: 'err' })
        return
      }

      onCountUpdated(assemblyGroupId, result.cumulative)

      if (lockToPlan && postProcessPlan && onPlanProgressUpdated) {
        const progressKey = buildPostProcessPlanProgressKey(
          postProcessPlan.assemblyGroupId,
          postProcessPlan.plannedDate,
          postProcessPlan.team,
        )
        onPlanProgressUpdated(progressKey, planDone + value)
      }

      setQty('')
      setDefectQty('')
      setMessage({
        text: formatRegisterOk(
          lockToPlan
            ? `${Math.min(planTarget, planDone + value).toLocaleString('ko-KR')}/${planTarget.toLocaleString('ko-KR')}`
            : `누적 ${result.cumulative.toLocaleString('ko-KR')}`,
        ),
        kind: 'ok',
      })
      return
    }

    const resolvedLineNo =
      smtPlan != null
        ? smtPlan.lineNo
        : lineNo != null && lineNo >= 1 && lineNo <= 7
          ? lineNo
          : null

    const result = await createSmtProductionRecord({
      orderLineId: order.orderLineId,
      quantity: value,
      defectQuantity: defectValue,
      pcbSide,
      lineNo: resolvedLineNo,
      recordDate: smtPlan?.plannedDate,
    })

    setSaving(false)

    if (!result.ok) {
      setMessage({ text: result.detail, kind: 'err' })
      return
    }

    const countKey = buildSmtCountKey(order.orderLineId, pcbSide)
    onCountUpdated(countKey, result.cumulative)

    if (lockToPlan && smtPlan && onPlanProgressUpdated) {
      const progressKey = buildSmtPlanProgressKey(
        order.orderLineId,
        pcbSide,
        smtPlan.lineNo,
        smtPlan.plannedDate,
      )
      onPlanProgressUpdated(progressKey, planDone + value)
    }

    setQty('')
    setDefectQty('')
    setMessage({
      text: formatRegisterOk(
        lockToPlan
          ? `${Math.min(planTarget, planDone + value).toLocaleString('ko-KR')}/${planTarget.toLocaleString('ko-KR')}`
          : `누적 ${result.cumulative.toLocaleString('ko-KR')}`,
      ),
      kind: 'ok',
    })
  }

  const progressLabel = lockToPlan ? '계획 진행' : isDual ? `${pcbSide} 진행` : '진행'
  const progressComplete = target > 0 && cumulative >= target

  /** 본문 인라인: 라인 선택·복수 계획 칩만 (팀 뱃지는 헤더) */
  const showPlanControls =
    showLineSelector || (showPostProcessPlanSelector && postProcessPlans.length > 1)
  /** 주문서 사이드바 모드: 선택 전에는 라인/계획 컨트롤 숨김. 계획 기반만 empty에서 노출 */
  const showEmptyPlanControls = Boolean(planSetupHref) || showPostProcessPlanSelector
  /** SMT=생산1팀, 후공정=생산2/3/4팀 — 주문서 미선택 empty state에서도 표시 */
  const headerTeamBadge = isPostProcess ? (postProcessTeam ?? null) : '생산1팀'
  const showPanelHeader = Boolean(headerTeamBadge || order)
  const headerTeamBadgeClass = isPostProcess
    ? 'rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200'
    : 'rounded-lg bg-sky-50 px-3 py-1.5 text-sm font-bold text-sky-800 ring-1 ring-sky-200'

  const planControls = showPlanControls ? (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {showLineSelector ? (
        <select
          value={lineNo ?? ''}
          onChange={(event) => {
            const raw = event.target.value
            onLineNoChange?.(raw === '' ? null : Number(raw))
          }}
          aria-label="SMT 라인"
          className={`${ERP_FIELD_INPUT_CLASS} w-auto min-w-[8rem] font-bold text-sky-800`}
        >
          <option value="">라인 선택</option>
          {SMT_PLAN_LINE_NOS.map((no) => (
            <option key={no} value={no}>
              LINE {no}
            </option>
          ))}
        </select>
      ) : null}
      {showLineSelector && smtLinePlans.length > 1 ? (
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5">
          {smtLinePlans.map((planItem) => {
            const active = planItem.id === selectedPlanId
            return (
              <button
                key={planItem.id}
                type="button"
                onClick={() => onSelectPlan?.(planItem.id)}
                className={[
                  'shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition sm:text-sm',
                  active
                    ? 'border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {formatSmtPlanChipLabel(planItem)}
              </button>
            )
          })}
        </div>
      ) : null}
      {showPostProcessPlanSelector && postProcessPlans.length > 1 ? (
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5">
          {postProcessPlans.map((planItem) => {
            const active = planItem.id === selectedPlanId
            return (
              <button
                key={planItem.id}
                type="button"
                onClick={() => onSelectPlan?.(planItem.id)}
                className={[
                  'shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition sm:text-sm',
                  active
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-200'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {formatPostProcessPlanChipLabel(planItem)}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  ) : null

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-slate-100">
      {showPanelHeader ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4">
          {headerTeamBadge ? (
            <span className={headerTeamBadgeClass}>{headerTeamBadge}</span>
          ) : (
            <span className="min-w-0" aria-hidden />
          )}
          {order ? (
            <span className="truncate text-xs font-medium text-slate-400">{order.orderNumber}</span>
          ) : null}
        </div>
      ) : null}

      {order ? (
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain p-3 sm:p-4">
          <section className="mx-auto w-full max-w-3xl shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            {planControls ? (
              <div className="border-b border-slate-100 pb-3">{planControls}</div>
            ) : null}

            <div className={planControls ? 'mt-4' : undefined}>
              <p className="text-sm text-slate-500">
                <span className="font-medium text-slate-700">{order.customer || '—'}</span>
                <span className="mx-2 text-slate-300">·</span>
                <span className="font-mono text-slate-600">{order.orderNumber}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold leading-snug text-slate-900 break-keep sm:text-2xl">
                  {formatProductionProductName(order)}
                </h2>
                {lockToPlan && sideLabel ? (
                  <span className="inline-flex shrink-0 items-center rounded-lg bg-slate-900 px-2.5 py-0.5 text-lg font-bold leading-none tracking-wide text-white sm:text-xl">
                    {sideLabel}
                  </span>
                ) : !isPostProcess && !order.splitPcbSides ? (
                  <span className="inline-flex shrink-0 items-center rounded-lg bg-slate-100 px-2.5 py-0.5 text-lg font-bold leading-none text-slate-600 sm:text-xl">
                    단면
                  </span>
                ) : null}
              </div>

              {isDual ? (
                <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4">
                  {(['TOP', 'BOT'] as const).map((side) => {
                    const sideCumulative = resolveProductionSideCount(order, counts, side)
                    const sideRemaining = Math.max(0, orderTarget - sideCumulative)
                    const selected = activeSide === side
                    const sideProgress = getProgressPercent(sideCumulative, orderTarget)
                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setActiveSide(side)}
                        className={[
                          'rounded-xl border p-3 text-left transition',
                          selected
                            ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-100'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300',
                        ].join(' ')}
                      >
                        <span className="block text-xs font-bold text-slate-500">{side}</span>
                        <span className="mt-1.5 block text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">
                          {sideCumulative.toLocaleString('ko-KR')}
                          <span className="text-base font-semibold text-slate-400 sm:text-lg">
                            {' '}
                            / {orderTarget.toLocaleString('ko-KR')}
                          </span>
                        </span>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                          <div
                            className={`h-full rounded-full ${sideCumulative >= orderTarget && orderTarget > 0 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                            style={{ width: `${sideProgress}%` }}
                          />
                        </div>
                        <span className="mt-1.5 block text-xs text-slate-500">
                          남음{' '}
                          <span className="font-bold tabular-nums text-slate-800">
                            {sideRemaining.toLocaleString('ko-KR')}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null}

              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold tracking-[0.12em] text-slate-400 uppercase">
                      {progressLabel}
                    </p>
                    <p className="mt-1.5 text-3xl font-bold tabular-nums text-slate-900 sm:text-4xl">
                      {cumulative.toLocaleString('ko-KR')}
                      <span className="mx-1.5 text-2xl font-semibold text-slate-300">/</span>
                      <span className="text-2xl font-semibold text-slate-500">
                        {target.toLocaleString('ko-KR')}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-400">남은 수량</p>
                    <p className="text-xl font-bold tabular-nums text-sky-700 sm:text-2xl">
                      {remaining.toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>
                {target > 0 ? (
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 sm:h-3.5">
                    <div
                      className={`h-full rounded-full transition-all ${
                        progressComplete ? 'bg-emerald-500' : 'bg-sky-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ) : null}
                <p className="mt-2 text-xs font-medium text-slate-500 sm:text-sm">
                  {progressComplete
                    ? '목표 수량을 달성했습니다.'
                    : `${progress}% 진행 · ${remaining.toLocaleString('ko-KR')}대 더 등록 가능`}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-sm font-bold text-slate-800">수량 입력</p>
              <p className="mt-0.5 text-xs text-slate-500">
                양품은 진행률·남은 수량에 반영됩니다. 불량은 이력에만 기록됩니다.
              </p>

              <p className="mt-3 text-xs font-bold tracking-wide text-slate-500 uppercase">양품</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([1, 10, 100, 1000] as const).map((step) => (
                  <button
                    key={step}
                    type="button"
                    disabled={!canRegister || saving || remaining < 1}
                    onClick={() => bumpQty(step)}
                    className="min-h-[3.25rem] rounded-xl border-2 border-slate-200 bg-slate-50 text-lg font-bold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[3.5rem] sm:text-xl"
                  >
                    +{step}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-2">
                <button
                  type="button"
                  disabled={!canRegister || saving || qtyNumber < 1}
                  onClick={() => bumpQty(-1)}
                  className="flex aspect-square min-h-[3.75rem] w-14 items-center justify-center rounded-xl border-2 border-slate-200 text-3xl font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[4.25rem] sm:w-16 sm:text-4xl"
                  aria-label="양품 수량 1 감소"
                >
                  −
                </button>
                <input
                  id={config.qtyInputId}
                  type="number"
                  min={0}
                  step={1}
                  value={qty}
                  disabled={!canRegister || saving}
                  onChange={(event) => {
                    const raw = event.target.value
                    if (raw === '') {
                      setQty('')
                      setMessage(null)
                      return
                    }
                    setQtyClamped(Number(raw) || 0)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleSubmit()
                  }}
                  placeholder="0"
                  aria-label="양품 수량"
                  className="min-h-[3.75rem] w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-center text-4xl font-bold text-slate-900 tabular-nums outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:text-slate-400 sm:min-h-[4.25rem] sm:text-5xl"
                />
                <button
                  type="button"
                  disabled={!canRegister || saving || qtyNumber >= remaining}
                  onClick={() => bumpQty(1)}
                  className="flex aspect-square min-h-[3.75rem] w-14 items-center justify-center rounded-xl border-2 border-slate-200 text-3xl font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[4.25rem] sm:w-16 sm:text-4xl"
                  aria-label="양품 수량 1 증가"
                >
                  +
                </button>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <label
                  htmlFor={`${config.qtyInputId}-defect`}
                  className="shrink-0 text-xs font-bold tracking-wide text-slate-500 uppercase"
                >
                  불량
                </label>
                <input
                  id={`${config.qtyInputId}-defect`}
                  type="number"
                  min={0}
                  step={1}
                  value={defectQty}
                  disabled={!canRegister || saving}
                  onChange={(event) => {
                    const raw = event.target.value
                    if (raw === '') {
                      setDefectQty('')
                      setMessage(null)
                      return
                    }
                    setDefectQtyValue(Number(raw) || 0)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleSubmit()
                  }}
                  placeholder="0"
                  aria-label="불량 수량"
                  className="min-h-[2.75rem] w-full max-w-[12rem] rounded-xl border-2 border-slate-200 bg-slate-50 px-3 text-center text-2xl font-bold text-slate-900 tabular-nums outline-none focus:border-rose-300 focus:bg-white focus:ring-2 focus:ring-rose-100 disabled:text-slate-400"
                />
              </div>

              <button
                type="button"
                disabled={!canRegister || saving || qtyNumber < 1}
                onClick={() => void handleSubmit()}
                className="mt-3 min-h-[3.25rem] w-full rounded-xl bg-slate-800 text-base font-bold text-white transition hover:bg-slate-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-h-[3.5rem] sm:text-lg"
              >
                {saving ? '등록 중…' : '등록'}
              </button>

              {message ? (
                <p
                  className={`mt-3 rounded-lg px-3 py-2.5 text-center text-sm font-medium ${
                    message.kind === 'ok'
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {message.text}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain p-3 sm:p-4">
          {showEmptyPlanControls && planControls ? (
            <section className="mx-auto mb-3 w-full max-w-3xl shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              {planControls}
            </section>
          ) : null}
          <div className="flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-8 text-center">
            <div>
              <p className="text-sm font-semibold text-slate-600 sm:text-base">
                {emptyPlanHint ||
                  (showEmptyPlanControls && showPostProcessPlanSelector && postProcessTeam
                    ? `오늘 ${postProcessTeam} · 등록할 계획이 없습니다`
                    : showEmptyPlanControls && showLineSelector && lineNo == null
                      ? '라인을 선택하세요'
                      : showEmptyPlanControls && showLineSelector && lineNo != null
                        ? `LINE ${lineNo} · 등록할 계획이 없습니다`
                        : '주문서를 선택하세요')}
              </p>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                {showEmptyPlanControls && showPostProcessPlanSelector && postProcessTeam
                  ? `오늘 ${postProcessTeam}에 배정된 생산계획이 없습니다. 생산계획에서 일정을 먼저 배치해 주세요.`
                  : showEmptyPlanControls && showLineSelector && lineNo == null
                    ? '위에서 SMT 라인을 고른 뒤 오늘 배정된 계획을 등록합니다.'
                    : showEmptyPlanControls && showLineSelector
                      ? '오늘 이 라인에 배정된 생산계획이 없습니다. 생산계획에서 일정을 먼저 배치해 주세요.'
                      : '왼쪽 목록에서 작업할 주문서를 선택합니다.'}
              </p>
              {(showPostProcessPlanSelector ||
                (showEmptyPlanControls && showLineSelector && lineNo != null)) &&
              planSetupHref ? (
                <Link
                  href={planSetupHref}
                  className="mt-4 inline-flex rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
                >
                  생산계획 열기
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
