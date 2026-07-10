'use client'

import { useEffect, useState } from 'react'
import { createDeliveryRecord, fetchOrderLineUnitPrice } from '@/lib/delivery/repository'
import {
  buildDeliveryStatementData,
  printDeliveryStatement,
} from '@/lib/delivery/print-delivery-statement'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import { describeDeliveryBlockReason } from '@/lib/delivery/utils'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductName } from '@/lib/production-input/utils'
import type { DeliveryRecord } from '@/lib/delivery/types'

type DeliveryInputShipPanelProps = {
  order: ProductionOrderLine | null
  availability: DeliveryAvailability | null
  embedded?: boolean
  onShipped: (assemblyGroupId: string, cumulative: number, availability: DeliveryAvailability) => void
}

function presetQuantity(availability: DeliveryAvailability) {
  const remaining = Math.max(0, availability.targetQuantity - availability.shipped)
  const preset = Math.min(remaining, availability.shippable)
  return preset > 0 ? String(preset) : ''
}

export function DeliveryInputShipPanel({
  order,
  availability,
  embedded = false,
  onShipped,
}: DeliveryInputShipPanelProps) {
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastRecord, setLastRecord] = useState<DeliveryRecord | null>(null)
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const assemblyGroupId = order?.assemblyGroupId || order?.orderLineId || ''
  const shipped = availability?.shipped ?? 0
  const target = availability?.targetQuantity ?? 0
  const shippable = availability?.shippable ?? 0
  const productionCap = availability?.productionCap ?? 0
  const remaining = Math.max(0, target - shipped)
  const registerMax = Math.min(remaining, shippable)
  const canRegister = Boolean(order && assemblyGroupId && registerMax > 0)

  useEffect(() => {
    setQty(availability ? presetQuantity(availability) : '')
    setNote('')
    setLastRecord(null)
    setMessage(null)
  }, [order?.uiKey, availability])

  function applyFullQuantity() {
    if (!availability || registerMax <= 0) return
    setQty(String(registerMax))
  }

  async function handlePrintStatement(record: DeliveryRecord, quantity: number) {
    if (!order) return false

    const priceResult = await fetchOrderLineUnitPrice(order.orderNumber, order.productCode)
    const unitPrice = priceResult.ok ? priceResult.unitPrice : 0

    return printDeliveryStatement(
      buildDeliveryStatementData({
        row: {
          docNo: record.id,
          shipDate: record.recordDate,
          orderNumber: order.orderNumber,
          customer: order.customer,
          productName: order.productName,
          productCode: order.productCode,
          qty: quantity,
          note,
        },
        unitPrice,
      }),
    )
  }

  async function handleSubmit(printAfter = false) {
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
      note: note.trim(),
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
    setLastRecord(result.record)
    setQty(presetQuantity(nextAvailability))
    setMessage({
      text: `출하번호 ${result.record.id} · ${value.toLocaleString('ko-KR')}개 등록 (누적 ${result.cumulative.toLocaleString('ko-KR')}개)`,
      kind: 'ok',
    })

    if (printAfter) {
      const printed = await handlePrintStatement(result.record, value)
      if (!printed) {
        setMessage({
          text: '출하는 등록됐지만 거래명세서를 열 수 없습니다. 팝업 차단을 해제해 주세요.',
          kind: 'err',
        })
      }
    }
  }

  if (!order || !availability) {
    if (embedded) return null
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-8 text-center">
        <p className="text-sm font-semibold text-slate-600">위 목록에서 출하할 주문을 선택하세요.</p>
        <p className="mt-1 text-xs text-slate-400">선택 후 수량을 입력하고 출하를 등록할 수 있습니다.</p>
      </div>
    )
  }

  const shellClass = embedded
    ? 'space-y-4'
    : 'rounded-xl border border-blue-200 bg-gradient-to-b from-blue-50/60 to-white p-5 shadow-sm'

  return (
    <div className={shellClass}>
      {!embedded ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 pb-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">
              {order.customer} · {order.orderNumber}
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{formatProductionProductName(order)}</h3>
          </div>
          <div className="flex flex-wrap gap-2 text-center">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-500">생산완료</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-slate-800">
                {productionCap.toLocaleString('ko-KR')}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-500">출하누적</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-slate-800">
                {shipped.toLocaleString('ko-KR')}
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-blue-700">출하가능</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-blue-800">
                {shippable.toLocaleString('ko-KR')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-slate-500">생산완료</p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-slate-800">
              {productionCap.toLocaleString('ko-KR')}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-slate-500">출하누적</p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-slate-800">
              {shipped.toLocaleString('ko-KR')}
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-blue-700">출하가능</p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-blue-800">
              {shippable.toLocaleString('ko-KR')}
            </p>
          </div>
        </div>
      )}

      <div className={embedded ? 'space-y-4' : 'mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end'}>
        <div className="space-y-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="delivery-qty-input" className="text-sm font-bold text-slate-700">
                이번 출하 수량
              </label>
              <button
                type="button"
                disabled={!canRegister || saving}
                onClick={applyFullQuantity}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 disabled:opacity-40"
              >
                전량 출하 ({registerMax.toLocaleString('ko-KR')})
              </button>
            </div>
            <input
              id="delivery-qty-input"
              type="number"
              min={1}
              step={1}
              value={qty}
              disabled={!canRegister || saving}
              onChange={(event) => setQty(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleSubmit(false)
              }}
              placeholder="0"
              className="w-full max-w-xs rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-2xl font-bold tabular-nums text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">비고 (선택)</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="차량번호, 인수자 등"
              className="w-full max-w-lg rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <p className={`text-sm ${canRegister ? 'text-slate-500' : 'text-amber-800'}`}>
            {canRegister ? `주문 잔량 ${remaining.toLocaleString('ko-KR')}개` : describeDeliveryBlockReason(availability)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canRegister || saving}
            onClick={() => void handleSubmit(false)}
            className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-bold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? '등록 중…' : '출하 등록'}
          </button>
          <button
            type="button"
            disabled={!canRegister || saving}
            onClick={() => void handleSubmit(true)}
            className="rounded-xl border border-blue-300 bg-white px-5 py-3 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            등록 후 명세서
          </button>
          {lastRecord ? (
            <button
              type="button"
              onClick={() => void handlePrintStatement(lastRecord, lastRecord.quantity)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              거래명세서 출력
            </button>
          ) : null}
        </div>
      </div>

      {message ? (
        <p
          className={`text-sm font-medium ${message.kind === 'ok' ? 'text-blue-700' : 'text-red-700'}`}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
