'use client'

import { useEffect, useState } from 'react'
import { createDeliveryRecord } from '@/lib/delivery/repository'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import { describeDeliveryBlockReason } from '@/lib/delivery/utils'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductName, getProgressPercent } from '@/lib/production-input/utils'

type DeliveryInputPanelProps = {
  order: ProductionOrderLine | null
  availability: DeliveryAvailability | null
  onShipped: (assemblyGroupId: string, cumulative: number, availability: DeliveryAvailability) => void
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
      ? 'text-violet-700'
      : tone === 'muted'
        ? 'text-slate-500'
        : 'text-violet-800'

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
      <span className="block text-xs font-semibold text-slate-500">{label}</span>
      <span className={`mt-1 block text-2xl font-bold leading-none tabular-nums ${valueClass}`}>
        {value}
      </span>
    </div>
  )
}

function presetQuantity(availability: DeliveryAvailability) {
  const remaining = Math.max(0, availability.targetQuantity - availability.shipped)
  const preset = Math.min(remaining, availability.shippable)
  return preset > 0 ? String(preset) : ''
}

export function DeliveryInputPanel({ order, availability, onShipped }: DeliveryInputPanelProps) {
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const assemblyGroupId = order?.assemblyGroupId || order?.orderLineId || ''
  const shipped = availability?.shipped ?? 0
  const target = availability?.targetQuantity ?? 0
  const shippable = availability?.shippable ?? 0
  const remaining = Math.max(0, target - shipped)
  const registerMax = Math.min(remaining, shippable)
  const progress = getProgressPercent(shipped, target)
  const canRegister = Boolean(order && assemblyGroupId && registerMax > 0)

  useEffect(() => {
    setQty(availability ? presetQuantity(availability) : '')
    setMessage(null)
  }, [order?.uiKey, availability])

  async function handleSubmit() {
    if (!order || !availability) return

    const value = Math.floor(Number(qty))
    if (!value || value < 1) {
      setMessage({ text: '출하 수량을 입력하세요.', kind: 'err' })
      return
    }
    if (value > registerMax) {
      setMessage({
        text:
          registerMax > 0
            ? `남은 수량(${registerMax.toLocaleString('ko-KR')})을 초과할 수 없습니다.`
            : describeDeliveryBlockReason(availability),
        kind: 'err',
      })
      return
    }

    setSaving(true)
    setMessage(null)

    const result = await createDeliveryRecord({
      assemblyGroupId,
      quantity: value,
    })

    setSaving(false)

    if (!result.ok) {
      setMessage({ text: result.detail, kind: 'err' })
      return
    }

    const nextAvailability: DeliveryAvailability = {
      ...availability,
      shipped: result.cumulative,
      shippable: Math.max(0, availability.productionCap - result.cumulative),
    }

    onShipped(assemblyGroupId, result.cumulative, nextAvailability)
    setQty(presetQuantity(nextAvailability))
    setMessage({
      text: `출하번호 ${result.record.id} · ${value.toLocaleString('ko-KR')}개 등록 (누적 ${result.cumulative.toLocaleString('ko-KR')}개)`,
      kind: 'ok',
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 px-5 py-5 shadow-[inset_3px_0_0_#7c3aed]">
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        {order && availability ? (
          <>
            <div className="shrink-0">
              <p className="text-sm text-slate-500">
                <span>{order.customer}</span>
                <span className="text-slate-300"> · </span>
                <span>{order.orderNumber}</span>
              </p>
              <h2 className="mt-1 text-xl font-bold leading-snug text-slate-900 break-keep">
                {formatProductionProductName(order)}
              </h2>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                  {order.productKindLabel}
                </span>
              </p>
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-3">
              <StatCard label="누적" value={shipped.toLocaleString('ko-KR')} />
              <StatCard label="목표" value={target.toLocaleString('ko-KR')} tone="muted" />
              <StatCard label="남음" value={remaining.toLocaleString('ko-KR')} tone="accent" />
            </div>

            {target > 0 ? (
              <div className="shrink-0">
                <div className="mb-1.5 flex justify-between text-sm font-medium text-slate-600">
                  <span>진행률</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      shipped >= target ? 'bg-violet-600' : 'bg-violet-500'
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
            order ? 'border-violet-200' : 'border-slate-200'
          }`}
        >
          <label htmlFor="delivery-qty-input" className="mb-3 block text-sm font-bold text-slate-700">
            이번 출하 수량
          </label>
          <div className="flex gap-3">
            <input
              id="delivery-qty-input"
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
              className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 py-4 text-2xl font-bold text-slate-900 tabular-nums outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-400"
            />
            <button
              type="button"
              disabled={!canRegister || saving}
              onClick={handleSubmit}
              className="shrink-0 rounded-xl bg-violet-600 px-6 py-4 text-base font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? '등록 중…' : '등록'}
            </button>
          </div>
          <p className={`mt-3 text-sm ${canRegister ? 'text-slate-500' : 'text-amber-700'}`}>
            {order && availability
              ? canRegister
                ? `현재 출하가능 수량 ${shippable.toLocaleString('ko-KR')}개`
                : describeDeliveryBlockReason(availability)
              : '주문 선택 후 수량을 입력하세요.'}
          </p>
        </div>

        {message ? (
          <p
            className={`text-center text-sm font-medium ${message.kind === 'ok' ? 'text-violet-700' : 'text-red-700'}`}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  )
}
