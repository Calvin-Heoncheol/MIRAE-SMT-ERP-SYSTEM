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
  getStackedProgressWidths,
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
  defectCounts?: Record<string, number>
  config: Pick<ProductionInputConfig, 'qtyInputId' | 'productionModule'>
  onCountUpdated: (countKey: string, cumulative: number, defectCumulative?: number) => void
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
  defectCounts = {},
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
  const [qtyMode, setQtyMode] = useState<'good' | 'defect'>('good')
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)
  const isGoodMode = qtyMode === 'good'
  const qtyModeLabel = isGoodMode ? '양품' : '불량'

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

  const assemblyGroupId = order?.assemblyGroupId || order?.orderLineId || ''
  const orderCumulative = order ? resolveProductionSideCount(order, counts, pcbSide) : 0
  const orderDefectCumulative = order
    ? isPostProcess
      ? Math.max(0, Math.floor(Number(defectCounts[assemblyGroupId] || 0)))
      : resolveProductionSideCount(order, defectCounts, pcbSide)
    : 0
  const orderTarget = order ? Math.max(0, Math.floor(order.quantity)) : 0
  const orderRemaining = Math.max(0, orderTarget - orderCumulative)

  const planTarget = lockToPlan ? Math.max(0, Math.floor(plan!.plannedQuantity)) : 0
  const planDone = lockToPlan ? Math.max(0, Math.floor(planProduced)) : 0
  const planRemaining = lockToPlan ? Math.max(0, planTarget - planDone) : 0

  const cumulative = lockToPlan ? planDone : orderCumulative
  const defectCumulative = lockToPlan ? 0 : orderDefectCumulative
  const target = lockToPlan ? planTarget : orderTarget
  const remaining = lockToPlan ? Math.min(planRemaining, orderRemaining) : orderRemaining
  const stacked = getStackedProgressWidths(cumulative, defectCumulative, target)

  const lineSelected =
    !showLineSelector || lockToPlan || (lineNo != null && lineNo >= 1 && lineNo <= 7)
  const canRegister =
    Boolean(order) &&
    (qtyMode === 'defect' || remaining > 0) &&
    lineSelected &&
    (isPostProcess ? Boolean(assemblyGroupId) : Boolean(order?.orderLineId))

  const qtyNumber = Math.max(0, Math.floor(Number(qty) || 0))
  const sideLabel = pcbSide === 'TOP' || pcbSide === 'BOT' ? pcbSide : null
  const qtyInputDisabled = !canRegister || saving
  const presetDisabled = qtyInputDisabled || (isGoodMode && remaining < 1)
  const bumpPlusDisabled =
    qtyInputDisabled || (isGoodMode && qtyNumber >= remaining)

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
    setQtyMode('good')
    setQty('')
    setMessage(null)
  }, [order?.uiKey, order?.splitPcbSides, lockToPlan, plan?.id, smtPlan?.pcbSide])

  useEffect(() => {
    if (lockToPlan) return
    setQty('')
    setMessage(null)
  }, [activeSide, lockToPlan])

  function setQtyValue(next: number) {
    const floored = Math.max(0, Math.floor(next))
    const value = isGoodMode ? Math.min(remaining, floored) : floored
    setQty(value > 0 ? String(value) : '')
    setMessage(null)
  }

  function bumpQty(delta: number) {
    setQtyValue(qtyNumber + delta)
  }

  function switchQtyMode(next: 'good' | 'defect') {
    if (next === qtyMode) return
    setQtyMode(next)
    setQty('')
    setMessage(null)
  }

  async function handleSubmit() {
    if (!order) return

    if (showLineSelector && !lockToPlan && (lineNo == null || lineNo < 1 || lineNo > 7)) {
      setMessage({ text: 'SMT 라인을 선택하세요.', kind: 'err' })
      return
    }

    const value = Math.max(0, Math.floor(Number(qty) || 0))
    if (value < 1) {
      setMessage({ text: `${qtyModeLabel} 수량을 입력하세요.`, kind: 'err' })
      return
    }

    const goodQuantity = isGoodMode ? value : 0
    const defectQuantity = isGoodMode ? 0 : value

    if (isGoodMode && target > 0 && goodQuantity > remaining) {
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
      return `${qtyModeLabel} ${value.toLocaleString('ko-KR')}개 등록 · ${cumulativeOrPlanText}`
    }

    if (isPostProcess) {
      const result = await createPostProcessProductionRecord({
        assemblyGroupId,
        quantity: goodQuantity,
        defectQuantity,
        recordDate: postProcessPlan?.plannedDate,
        team: postProcessPlan?.team || postProcessTeam,
      })

      setSaving(false)

      if (!result.ok) {
        setMessage({ text: result.detail, kind: 'err' })
        return
      }

      onCountUpdated(assemblyGroupId, result.cumulative, result.defectCumulative)

      if (lockToPlan && postProcessPlan && onPlanProgressUpdated && goodQuantity > 0) {
        const progressKey = buildPostProcessPlanProgressKey(
          postProcessPlan.assemblyGroupId,
          postProcessPlan.plannedDate,
          postProcessPlan.team,
        )
        onPlanProgressUpdated(progressKey, planDone + goodQuantity)
      }

      setQty('')
      setMessage({
        text: formatRegisterOk(
          lockToPlan
            ? `${Math.min(planTarget, planDone + goodQuantity).toLocaleString('ko-KR')}/${planTarget.toLocaleString('ko-KR')}`
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
      quantity: goodQuantity,
      defectQuantity,
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
    onCountUpdated(countKey, result.cumulative, result.defectCumulative)

    if (lockToPlan && smtPlan && onPlanProgressUpdated && goodQuantity > 0) {
      const progressKey = buildSmtPlanProgressKey(
        order.orderLineId,
        pcbSide,
        smtPlan.lineNo,
        smtPlan.plannedDate,
      )
      onPlanProgressUpdated(progressKey, planDone + goodQuantity)
    }

    setQty('')
    setMessage({
      text: formatRegisterOk(
        lockToPlan
          ? `${Math.min(planTarget, planDone + goodQuantity).toLocaleString('ko-KR')}/${planTarget.toLocaleString('ko-KR')}`
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
                ) : !isPostProcess && order.splitPcbSides ? (
                  <span className="inline-flex shrink-0 items-center rounded-lg bg-sky-100 px-2.5 py-0.5 text-lg font-bold leading-none text-sky-800 sm:text-xl">
                    양면
                  </span>
                ) : !isPostProcess ? (
                  <span className="inline-flex shrink-0 items-center rounded-lg bg-slate-100 px-2.5 py-0.5 text-lg font-bold leading-none text-slate-600 sm:text-xl">
                    단면
                  </span>
                ) : null}
              </div>

              {isDual ? (
                <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-slate-100 pt-4">
                  {(['TOP', 'BOT'] as const).map((side) => {
                    const sideCumulative = resolveProductionSideCount(order, counts, side)
                    const sideDefectCumulative = resolveProductionSideCount(order, defectCounts, side)
                    const sideRemaining = Math.max(0, orderTarget - sideCumulative)
                    const selected = activeSide === side
                    const sideStacked = getStackedProgressWidths(
                      sideCumulative,
                      sideDefectCumulative,
                      orderTarget,
                    )
                    const sideComplete = orderTarget > 0 && sideCumulative >= orderTarget
                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setActiveSide(side)}
                        className={[
                          'rounded-xl border p-3.5 text-left transition sm:p-4',
                          selected
                            ? 'border-sky-500 bg-sky-50/50 ring-2 ring-sky-100'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300',
                        ].join(' ')}
                      >
                        <div className="flex flex-wrap items-end justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold tracking-[0.12em] text-slate-400 uppercase">
                              {side}
                            </p>
                            <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
                              {sideCumulative.toLocaleString('ko-KR')}
                              <span className="mx-1 text-xl font-semibold text-slate-300 sm:text-2xl">/</span>
                              <span className="text-xl font-semibold text-slate-500 sm:text-2xl">
                                {orderTarget.toLocaleString('ko-KR')}
                              </span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-slate-400">남은 수량</p>
                            <p className="text-lg font-bold tabular-nums text-sky-700 sm:text-xl">
                              {sideRemaining.toLocaleString('ko-KR')}
                            </p>
                          </div>
                        </div>
                        {orderTarget > 0 ? (
                          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white sm:h-2.5">
                            {sideStacked.goodPercent > 0 ? (
                              <div
                                className={`h-full transition-all ${
                                  sideComplete && sideStacked.defectPercent <= 0
                                    ? 'bg-emerald-500'
                                    : 'bg-sky-500'
                                }`}
                                style={{ width: `${sideStacked.goodPercent}%` }}
                              />
                            ) : null}
                            {sideStacked.defectPercent > 0 ? (
                              <div
                                className="h-full bg-rose-500 transition-all"
                                style={{ width: `${sideStacked.defectPercent}%` }}
                              />
                            ) : null}
                          </div>
                        ) : null}
                        <p className="mt-2 text-xs font-medium text-slate-500">
                          {sideComplete
                            ? '목표 수량을 달성했습니다.'
                            : `${sideStacked.totalPercent}% 진행 · ${sideRemaining.toLocaleString('ko-KR')}대 더 등록 가능`}
                          {sideDefectCumulative > 0
                            ? ` · 불량 ${sideDefectCumulative.toLocaleString('ko-KR')}대`
                            : ''}
                        </p>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 sm:p-4">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold tracking-[0.12em] text-slate-400 uppercase">
                          {progressLabel}
                        </p>
                        <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
                          {cumulative.toLocaleString('ko-KR')}
                          <span className="mx-1 text-xl font-semibold text-slate-300 sm:text-2xl">/</span>
                          <span className="text-xl font-semibold text-slate-500 sm:text-2xl">
                            {target.toLocaleString('ko-KR')}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-400">남은 수량</p>
                        <p className="text-lg font-bold tabular-nums text-sky-700 sm:text-xl">
                          {remaining.toLocaleString('ko-KR')}
                        </p>
                      </div>
                    </div>
                    {target > 0 ? (
                      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white sm:h-2.5">
                        {stacked.goodPercent > 0 ? (
                          <div
                            className={`h-full transition-all ${
                              progressComplete && stacked.defectPercent <= 0
                                ? 'bg-emerald-500'
                                : 'bg-sky-500'
                            }`}
                            style={{ width: `${stacked.goodPercent}%` }}
                          />
                        ) : null}
                        {stacked.defectPercent > 0 ? (
                          <div
                            className="h-full bg-rose-500 transition-all"
                            style={{ width: `${stacked.defectPercent}%` }}
                          />
                        ) : null}
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      {progressComplete
                        ? '목표 수량을 달성했습니다.'
                        : `${stacked.totalPercent}% 진행 · ${remaining.toLocaleString('ko-KR')}대 더 등록 가능`}
                      {defectCumulative > 0
                        ? ` · 불량 ${defectCumulative.toLocaleString('ko-KR')}대`
                        : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-sm font-bold text-slate-800">수량 입력</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {isGoodMode
                  ? '양품은 진행률·남은 수량에 반영됩니다.'
                  : '불량은 게이지에 빨간색으로 표시되며, 남은 수량 제한을 받지 않습니다.'}
              </p>

              <div
                className="mt-3 grid grid-cols-2 gap-2"
                role="tablist"
                aria-label="수량 입력 모드"
              >
                {(
                  [
                    { id: 'good' as const, label: '양품' },
                    { id: 'defect' as const, label: '불량' },
                  ] as const
                ).map((mode) => {
                  const active = qtyMode === mode.id
                  const activeClass =
                    mode.id === 'good'
                      ? 'border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-200'
                      : 'border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-200'
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      disabled={saving}
                      onClick={() => switchQtyMode(mode.id)}
                      className={[
                        'min-h-[2.75rem] rounded-xl border px-3 py-2 text-sm font-bold transition sm:text-base',
                        active
                          ? activeClass
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {mode.label}
                    </button>
                  )
                })}
              </div>

              <p className="mt-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
                {qtyModeLabel}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {([1, 10, 100, 1000] as const).map((step) => (
                  <button
                    key={step}
                    type="button"
                    disabled={presetDisabled}
                    onClick={() => bumpQty(step)}
                    className={[
                      'min-h-[3.25rem] rounded-xl border-2 text-lg font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[3.5rem] sm:text-xl',
                      isGoodMode
                        ? 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800',
                    ].join(' ')}
                  >
                    +{step}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-2">
                <button
                  type="button"
                  disabled={qtyInputDisabled || qtyNumber < 1}
                  onClick={() => bumpQty(-1)}
                  className="flex aspect-square min-h-[3.75rem] w-14 items-center justify-center rounded-xl border-2 border-slate-200 text-3xl font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[4.25rem] sm:w-16 sm:text-4xl"
                  aria-label={`${qtyModeLabel} 수량 1 감소`}
                >
                  −
                </button>
                <input
                  id={config.qtyInputId}
                  type="number"
                  min={0}
                  step={1}
                  value={qty}
                  disabled={qtyInputDisabled}
                  onChange={(event) => {
                    const raw = event.target.value
                    if (raw === '') {
                      setQty('')
                      setMessage(null)
                      return
                    }
                    setQtyValue(Number(raw) || 0)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleSubmit()
                  }}
                  placeholder="0"
                  aria-label={`${qtyModeLabel} 수량`}
                  className={[
                    'min-h-[3.75rem] w-full rounded-xl border-2 bg-slate-50 px-3 text-center text-4xl font-bold text-slate-900 tabular-nums outline-none focus:bg-white disabled:text-slate-400 sm:min-h-[4.25rem] sm:text-5xl',
                    isGoodMode
                      ? 'border-slate-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-100'
                      : 'border-slate-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100',
                  ].join(' ')}
                />
                <button
                  type="button"
                  disabled={bumpPlusDisabled}
                  onClick={() => bumpQty(1)}
                  className="flex aspect-square min-h-[3.75rem] w-14 items-center justify-center rounded-xl border-2 border-slate-200 text-3xl font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[4.25rem] sm:w-16 sm:text-4xl"
                  aria-label={`${qtyModeLabel} 수량 1 증가`}
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={qtyInputDisabled || qtyNumber < 1}
                onClick={() => void handleSubmit()}
                className={[
                  'mt-3 min-h-[3.25rem] w-full rounded-xl text-base font-bold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-h-[3.5rem] sm:text-lg',
                  isGoodMode
                    ? 'bg-slate-800 hover:bg-slate-900'
                    : 'bg-rose-700 hover:bg-rose-800',
                ].join(' ')}
              >
                {saving ? '등록 중…' : `${qtyModeLabel} 등록`}
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
