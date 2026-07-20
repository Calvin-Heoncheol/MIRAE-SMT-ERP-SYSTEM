'use client'

import { useEffect, useState } from 'react'
import { buildPostProcessPlanProgressKey } from '@/lib/post-process/count-keys'
import type { PostProcessPlanBlock } from '@/lib/post-process/plan/types'
import { createPostProcessProductionRecord } from '@/lib/post-process/repository'
import { buildSmtCountKey, buildSmtPlanProgressKey } from '@/lib/smt/count-keys'
import { createSmtProductionRecord } from '@/lib/smt/repository'
import type { SmtPlanBlock } from '@/lib/smt/plan/types'
import type { SmtPcbSide } from '@/lib/smt/types'
import type { ProductionInputConfig, ProductionOrderLine } from '@/lib/production-input/types'
import {
  formatProductionProductName,
  getProgressPercent,
  resolveProductionSideCount,
} from '@/lib/production-input/utils'

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
  plan = null,
  planProduced = 0,
  onPlanProgressUpdated,
}: ProductionInputPanelProps) {
  const [activeSide, setActiveSide] = useState<SmtPcbSide>('SINGLE')
  const [qty, setQty] = useState('')
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
  const canRegister =
    Boolean(order) &&
    remaining > 0 &&
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
    setMessage(null)
  }, [order?.uiKey, order?.splitPcbSides, lockToPlan, plan?.id, smtPlan?.pcbSide])

  useEffect(() => {
    if (lockToPlan) return
    setQty('')
    setMessage(null)
  }, [activeSide, lockToPlan])

  function setQtyClamped(next: number) {
    const value = Math.max(0, Math.min(remaining, Math.floor(next)))
    setQty(value > 0 ? String(value) : '')
    setMessage(null)
  }

  function bumpQty(delta: number) {
    setQtyClamped(qtyNumber + delta)
  }

  async function handleSubmit() {
    if (!order) return

    const value = Math.floor(Number(qty))
    if (!value || value < 1) {
      setMessage({ text: '등록 수량을 입력하세요.', kind: 'err' })
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

    if (isPostProcess) {
      const result = await createPostProcessProductionRecord({
        assemblyGroupId,
        quantity: value,
        recordDate: postProcessPlan?.plannedDate,
        team: postProcessPlan?.team,
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
      setMessage({
        text: lockToPlan
          ? `${value.toLocaleString('ko-KR')}개 등록 · ${Math.min(planTarget, planDone + value).toLocaleString('ko-KR')}/${planTarget.toLocaleString('ko-KR')}`
          : `${value.toLocaleString('ko-KR')}개 등록 · 누적 ${result.cumulative.toLocaleString('ko-KR')}`,
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
    setMessage({
      text: lockToPlan
        ? `${value.toLocaleString('ko-KR')}개 등록 · ${Math.min(planTarget, planDone + value).toLocaleString('ko-KR')}/${planTarget.toLocaleString('ko-KR')}`
        : `${value.toLocaleString('ko-KR')}개 등록 · 누적 ${result.cumulative.toLocaleString('ko-KR')}`,
      kind: 'ok',
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      {order ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-6 py-6 sm:px-8">
          <div className="w-full space-y-5">
            <div>
              <p className="text-base text-slate-500">
                {lineNo != null ? (
                  <>
                    <span className="font-bold text-sky-700">LINE {lineNo}</span>
                    <span className="text-slate-300"> · </span>
                  </>
                ) : null}
                <span>{order.customer || '—'}</span>
                <span className="text-slate-300"> · </span>
                <span>{order.orderNumber}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-bold leading-snug text-slate-900 break-keep sm:text-3xl">
                  {formatProductionProductName(order)}
                </h2>
                {lockToPlan && sideLabel ? (
                  <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white">
                    {sideLabel}
                  </span>
                ) : !isPostProcess && !order.splitPcbSides ? (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    단면
                  </span>
                ) : null}
              </div>
            </div>

            {isDual ? (
              <div className="grid grid-cols-2 gap-2">
                {(['TOP', 'BOT'] as const).map((side) => {
                  const sideCumulative = resolveProductionSideCount(order, counts, side)
                  const sideRemaining = Math.max(0, orderTarget - sideCumulative)
                  const selected = activeSide === side
                  return (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setActiveSide(side)}
                      className={[
                        'rounded-xl border px-3 py-2.5 text-left transition',
                        selected
                          ? 'border-sky-500 bg-white shadow-sm ring-2 ring-sky-100'
                          : 'border-slate-200 bg-white hover:border-slate-300',
                      ].join(' ')}
                    >
                      <span className="block text-xs font-bold text-slate-500">{side}</span>
                      <span className="mt-0.5 block text-base font-bold tabular-nums text-slate-900">
                        {sideCumulative.toLocaleString('ko-KR')}
                        <span className="text-sm font-medium text-slate-400">
                          {' '}
                          / {orderTarget.toLocaleString('ko-KR')}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        남음 {sideRemaining.toLocaleString('ko-KR')}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <p className="text-sm font-semibold tracking-wide text-slate-400 uppercase">
                    {lockToPlan ? '계획 진행' : isDual ? `${pcbSide} 진행` : '진행'}
                  </p>
                  <p className="text-3xl font-bold tabular-nums text-slate-900 sm:text-4xl">
                    {cumulative.toLocaleString('ko-KR')}
                    <span className="mx-1 text-2xl font-semibold text-slate-300">/</span>
                    <span className="text-2xl font-semibold text-slate-500">
                      {target.toLocaleString('ko-KR')}
                    </span>
                  </p>
                </div>
                {target > 0 ? (
                  <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        cumulative >= target ? 'bg-emerald-500' : 'bg-sky-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                ) : null}
              </div>

              <div className="mb-5 grid grid-cols-4 gap-3">
                {([1, 10, 100, 1000] as const).map((step) => (
                  <button
                    key={step}
                    type="button"
                    disabled={!canRegister || saving || remaining < 1}
                    onClick={() => bumpQty(step)}
                    className="h-16 rounded-2xl border-2 border-slate-200 bg-slate-50 text-xl font-bold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:h-[4.5rem] sm:text-2xl"
                  >
                    +{step}
                  </button>
                ))}
              </div>

              <div className="flex items-stretch gap-3">
                <button
                  type="button"
                  disabled={!canRegister || saving || qtyNumber < 1}
                  onClick={() => bumpQty(-1)}
                  className="flex h-20 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 text-4xl font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:h-24 sm:w-20"
                  aria-label="수량 1 감소"
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
                  className="h-20 min-w-0 flex-1 rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 text-center text-5xl font-bold text-slate-900 tabular-nums outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:text-slate-400 sm:h-24 sm:text-6xl"
                />
                <button
                  type="button"
                  disabled={!canRegister || saving || qtyNumber >= remaining}
                  onClick={() => bumpQty(1)}
                  className="flex h-20 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 text-4xl font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:h-24 sm:w-20"
                  aria-label="수량 1 증가"
                >
                  +
                </button>
                <button
                  type="button"
                  disabled={!canRegister || saving || qtyNumber < 1}
                  onClick={() => void handleSubmit()}
                  className="h-20 shrink-0 rounded-2xl bg-slate-800 px-8 text-xl font-bold text-white transition hover:bg-slate-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 sm:h-24 sm:px-10 sm:text-2xl"
                >
                  {saving ? '등록 중…' : '등록'}
                </button>
              </div>

              {message ? (
                <p
                  className={`mt-5 text-base font-medium ${
                    message.kind === 'ok' ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {message.text}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
          <div>
            <p className="text-base font-semibold text-slate-600">주문을 선택하세요</p>
            <p className="mt-1 text-sm text-slate-400">
              {config.productionModule === 'smt'
                ? '위 라인 카드에서 작업 라인을 선택하세요.'
                : config.productionModule === 'post_process'
                  ? '위 계획 카드에서 작업을 선택하세요.'
                  : '왼쪽 목록에서 작업할 주문을 선택합니다.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
