'use client'

import { useEffect, useState } from 'react'
import { applyMetalMaskUsage } from '@/lib/metal-masks/repository'
import { buildPostProcessPlanProgressKey } from '@/lib/post-process/count-keys'
import type { PostProcessPlanBlock } from '@/lib/post-process/plan/types'
import { createPostProcessProductionRecord } from '@/lib/post-process/repository'
import { applySqueegeeUsage } from '@/lib/squeegees/repository'
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
  const [maskBarcode, setMaskBarcode] = useState('')
  const [squeegeeBarcode, setSqueegeeBarcode] = useState('')
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
    setMaskBarcode('')
    setSqueegeeBarcode('')
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

    if (!result.ok) {
      setSaving(false)
      setMessage({ text: result.detail, kind: 'err' })
      return
    }

    const toolingNotes: string[] = []
    const maskCode = maskBarcode.trim()
    if (maskCode) {
      const maskResult = await applyMetalMaskUsage({
        barcode: maskCode,
        pcbSide,
        deltaQty: value,
        smtProductionRecordId: result.record.id,
        recordDate: smtPlan?.plannedDate,
      })
      if (!maskResult.ok) {
        toolingNotes.push(`마스크: ${maskResult.detail}`)
      }
    }

    const squeegeeCode = squeegeeBarcode.trim()
    if (squeegeeCode) {
      const squeegeeResult = await applySqueegeeUsage({
        barcode: squeegeeCode,
        deltaQty: value,
        smtProductionRecordId: result.record.id,
        recordDate: smtPlan?.plannedDate,
      })
      if (!squeegeeResult.ok) {
        toolingNotes.push(`스퀴즈: ${squeegeeResult.detail}`)
      }
    }

    setSaving(false)

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
    setMaskBarcode('')
    setSqueegeeBarcode('')
    const baseText = lockToPlan
      ? `${value.toLocaleString('ko-KR')}개 등록 · ${Math.min(planTarget, planDone + value).toLocaleString('ko-KR')}/${planTarget.toLocaleString('ko-KR')}`
      : `${value.toLocaleString('ko-KR')}개 등록 · 누적 ${result.cumulative.toLocaleString('ko-KR')}`
    setMessage({
      text: toolingNotes.length ? `${baseText} · ${toolingNotes.join(' / ')}` : baseText,
      kind: toolingNotes.length ? 'err' : 'ok',
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        {order ? (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-slate-500">
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
                <h2 className="text-xl font-bold leading-snug text-slate-900 break-keep">
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

            <div>
              <div className="mb-2 flex items-end justify-between gap-3">
                <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  {lockToPlan ? '계획 진행' : isDual ? `${pcbSide} 진행` : '진행'}
                </p>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {cumulative.toLocaleString('ko-KR')}
                  <span className="mx-1 text-lg font-semibold text-slate-300">/</span>
                  <span className="text-lg font-semibold text-slate-500">
                    {target.toLocaleString('ko-KR')}
                  </span>
                </p>
              </div>
              {target > 0 ? (
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      cumulative >= target ? 'bg-emerald-500' : 'bg-sky-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[12rem] items-center justify-center text-center">
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

      <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.04)]">
        {!isPostProcess && order ? (
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              메탈마스크 바코드
              <input
                type="text"
                value={maskBarcode}
                disabled={!canRegister || saving}
                onChange={(event) => setMaskBarcode(event.target.value)}
                placeholder="스캔 (선택)"
                autoComplete="off"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:opacity-50"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              스퀴즈 바코드
              <input
                type="text"
                value={squeegeeBarcode}
                disabled={!canRegister || saving}
                onChange={(event) => setSqueegeeBarcode(event.target.value)}
                placeholder="스캔 (선택)"
                autoComplete="off"
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:opacity-50"
              />
            </label>
          </div>
        ) : null}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={!canRegister || saving || qtyNumber < 1}
            onClick={() => bumpQty(-1)}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-2xl font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
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
            className="h-14 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-3xl font-bold text-slate-900 tabular-nums outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:text-slate-400"
          />
          <button
            type="button"
            disabled={!canRegister || saving || qtyNumber >= remaining}
            onClick={() => bumpQty(1)}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-2xl font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="수량 1 증가"
          >
            +
          </button>
          <button
            type="button"
            disabled={!canRegister || saving || qtyNumber < 1}
            onClick={() => void handleSubmit()}
            className="h-14 shrink-0 rounded-xl bg-slate-800 px-6 text-base font-bold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? '등록 중…' : '등록'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {([1, 10, 50, 100] as const).map((step) => (
            <button
              key={step}
              type="button"
              disabled={!canRegister || saving || remaining < 1}
              onClick={() => bumpQty(step)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              +{step}
            </button>
          ))}
          <button
            type="button"
            disabled={!canRegister || saving || remaining < 1}
            onClick={() => setQtyClamped(remaining)}
            className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            남은 {remaining.toLocaleString('ko-KR')}
          </button>
        </div>

        {message ? (
          <p
            className={`mt-3 text-sm font-medium ${
              message.kind === 'ok' ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  )
}
