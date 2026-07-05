'use client'

import { useEffect, useState } from 'react'
import { formatProductPcbSideModeLabel } from '@/lib/products/utils'
import { createPostProcessProductionRecord } from '@/lib/post-process/repository'
import { buildSmtCountKey } from '@/lib/smt/count-keys'
import { createSmtProductionRecord } from '@/lib/smt/repository'
import type { SmtPcbSide } from '@/lib/smt/types'
import type { ProductionInputConfig, ProductionOrderLine } from '@/lib/production-input/types'
import {
  formatProductionProductName,
  getProgressPercent,
  resolveProductionSideCount,
} from '@/lib/production-input/utils'

type ProductionInputPanelProps = {
  order: ProductionOrderLine | null
  counts: Record<string, number>
  config: Pick<ProductionInputConfig, 'qtyInputId' | 'productionModule'>
  onCountUpdated: (countKey: string, cumulative: number) => void
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'accent' | 'muted'
}) {
  const valueClass =
    tone === 'accent'
      ? 'text-sky-700'
      : tone === 'muted'
        ? 'text-slate-500'
        : 'text-emerald-700'

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
      <span className="block text-xs font-semibold text-slate-500">{label}</span>
      <span className={`mt-1 block text-2xl font-bold leading-none tabular-nums ${valueClass}`}>
        {value}
      </span>
    </div>
  )
}

export function ProductionInputPanel({
  order,
  counts,
  config,
  onCountUpdated,
}: ProductionInputPanelProps) {
  const [activeSide, setActiveSide] = useState<SmtPcbSide>('SINGLE')
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const isPostProcess = config.productionModule === 'post_process'
  const isDual = Boolean(order?.splitPcbSides) && !isPostProcess
  const pcbSide: SmtPcbSide = isDual ? (activeSide === 'BOT' ? 'BOT' : 'TOP') : 'SINGLE'
  const cumulative = order ? resolveProductionSideCount(order, counts, pcbSide) : 0
  const target = order ? Math.max(0, Math.floor(order.quantity)) : 0
  const progress = getProgressPercent(cumulative, target)
  const remaining = Math.max(0, target - cumulative)
  const assemblyGroupId = order?.assemblyGroupId || order?.orderLineId || ''
  const canRegister =
    Boolean(order) &&
    remaining > 0 &&
    (isPostProcess ? Boolean(assemblyGroupId) : Boolean(order?.orderLineId))

  useEffect(() => {
    setActiveSide(order?.splitPcbSides ? 'TOP' : 'SINGLE')
    setQty('')
    setMessage(null)
  }, [order?.uiKey, order?.splitPcbSides])

  useEffect(() => {
    setQty('')
    setMessage(null)
  }, [activeSide])

  async function handleSubmit() {
    if (!order) return

    const value = Math.floor(Number(qty))
    if (!value || value < 1) {
      setMessage({ text: '등록 수량을 입력하세요.', kind: 'err' })
      return
    }
    if (target > 0 && value > remaining) {
      setMessage({
        text: isPostProcess
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
      })

      setSaving(false)

      if (!result.ok) {
        setMessage({ text: result.detail, kind: 'err' })
        return
      }

      onCountUpdated(assemblyGroupId, result.cumulative)
      setQty('')
      setMessage({
        text: `${value.toLocaleString('ko-KR')}개가 등록되었습니다. (누적 ${result.cumulative.toLocaleString('ko-KR')}개)`,
        kind: 'ok',
      })
      return
    }

    const result = await createSmtProductionRecord({
      orderLineId: order.orderLineId,
      quantity: value,
      pcbSide,
    })

    setSaving(false)

    if (!result.ok) {
      setMessage({ text: result.detail, kind: 'err' })
      return
    }

    const countKey = buildSmtCountKey(order.orderLineId, pcbSide)
    onCountUpdated(countKey, result.cumulative)
    setQty('')
    setMessage({
      text: `${pcbSide} 면 ${value.toLocaleString('ko-KR')}개가 등록되었습니다. (누적 ${result.cumulative.toLocaleString('ko-KR')}개)`,
      kind: 'ok',
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 px-5 py-5 shadow-[inset_3px_0_0_#0284c7]">
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        {order ? (
          <>
            <div className="shrink-0">
              <h2 className="text-xl font-bold leading-snug text-slate-900 break-keep">
                {formatProductionProductName(order)}
              </h2>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                <span>{order.orderNumber}</span>
                <span className="text-slate-300">·</span>
                <span>{order.customer}</span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                  {order.productKindLabel}
                </span>
                {!isPostProcess ? (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      isDual
                        ? 'border-violet-200 bg-violet-50 text-violet-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    {isDual ? formatProductPcbSideModeLabel('dual') : formatProductPcbSideModeLabel('single')}
                  </span>
                ) : null}
              </p>
            </div>

            {isDual ? (
              <div className="grid shrink-0 grid-cols-2 gap-2">
                {(['TOP', 'BOT'] as const).map((side) => {
                  const sideCumulative = resolveProductionSideCount(order, counts, side)
                  const sideRemaining = Math.max(0, target - sideCumulative)
                  const selected = activeSide === side
                  return (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setActiveSide(side)}
                      className={[
                        'rounded-xl border px-3 py-3 text-left transition',
                        selected
                          ? 'border-sky-400 bg-white shadow-sm ring-2 ring-sky-100'
                          : 'border-slate-200 bg-white/80 hover:border-slate-300',
                      ].join(' ')}
                    >
                      <span className="block text-xs font-bold text-slate-500">{side} 면</span>
                      <span className="mt-1 block text-lg font-bold tabular-nums text-slate-900">
                        {sideCumulative.toLocaleString('ko-KR')}
                        <span className="text-sm font-medium text-slate-400">
                          {' '}
                          / {target.toLocaleString('ko-KR')}
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

            <div className="grid shrink-0 grid-cols-3 gap-3">
              <StatCard
                label={isDual ? `${pcbSide} 누적` : '누적'}
                value={cumulative.toLocaleString('ko-KR')}
              />
              <StatCard
                label="목표"
                value={target.toLocaleString('ko-KR')}
                tone="muted"
              />
              <StatCard
                label={isDual ? `${pcbSide} 남음` : '남음'}
                value={remaining.toLocaleString('ko-KR')}
                tone="accent"
              />
            </div>

            {target > 0 ? (
              <div className="shrink-0">
                <div className="mb-1.5 flex justify-between text-sm font-medium text-slate-600">
                  <span>{isDual ? `${pcbSide} 면 진행률` : '진행률'}</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      cumulative >= target ? 'bg-emerald-600' : 'bg-sky-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div>
              <p className="text-base font-semibold text-slate-600">주문을 선택하세요</p>
              <p className="mt-1 text-sm text-slate-400">왼쪽 목록에서 작업할 주문을 선택합니다.</p>
            </div>
          </div>
        )}

        <div
          className={`mt-auto shrink-0 rounded-2xl border-2 bg-white p-5 shadow-sm ${
            order ? 'border-emerald-200' : 'border-slate-200'
          }`}
        >
          <label htmlFor={config.qtyInputId} className="mb-3 block text-sm font-bold text-slate-700">
            {isDual ? `${pcbSide} 면 등록 수량` : '이번 등록 수량'}
          </label>
          <div className="flex gap-3">
            <input
              id={config.qtyInputId}
              type="number"
              min={1}
              step={1}
              value={qty}
              disabled={!canRegister || saving}
              onChange={(event) => setQty(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSubmit()
              }}
              placeholder="0"
              className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 py-4 text-2xl font-bold text-slate-900 tabular-nums outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              type="button"
              disabled={!canRegister || saving}
              onClick={handleSubmit}
              className="shrink-0 rounded-xl bg-emerald-600 px-6 py-4 text-base font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? '등록 중…' : '등록'}
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            {order
              ? remaining > 0
                ? isDual
                  ? `${pcbSide} 면 최대 ${remaining.toLocaleString('ko-KR')}개까지 등록할 수 있습니다.`
                  : `최대 ${remaining.toLocaleString('ko-KR')}개까지 등록할 수 있습니다.`
                : isDual
                  ? `${pcbSide} 면 목표 수량에 도달했습니다.`
                  : '목표 수량에 도달했습니다.'
              : '주문 선택 후 수량을 입력하세요.'}
          </p>
        </div>

        {message ? (
          <p
            className={`text-center text-sm font-medium ${message.kind === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  )
}
