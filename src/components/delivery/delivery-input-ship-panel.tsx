'use client'

import { useEffect, useMemo, useState } from 'react'
import { createDeliveryShipment } from '@/lib/delivery/repository'
import {
  buildDeliveryStatementDataFromShipment,
  printDeliveryStatement,
} from '@/lib/delivery/print-delivery-statement'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import { describeDeliveryBlockReason } from '@/lib/delivery/utils'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductName } from '@/lib/production-input/utils'
import type { DeliveryCartLine } from '@/lib/delivery/types'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { useToast } from '@/components/ui/toast-provider'

export type DeliveryShipmentDelta = {
  assemblyGroupId: string
  quantity: number
}

type DeliveryInputShipPanelProps = {
  order: ProductionOrderLine | null
  availability: DeliveryAvailability | null
  cart: DeliveryCartLine[]
  lockedCustomer: string
  onAddToCart: (line: DeliveryCartLine) => void
  onUpdateCartQuantity: (key: string, quantity: number) => void
  onRemoveFromCart: (key: string) => void
  onClearCart: () => void
  onShipped: (deltas: DeliveryShipmentDelta[]) => void
}

function registerMaxFor(availability: DeliveryAvailability | null, cartedForGroup: number) {
  if (!availability) return 0
  const remaining = Math.max(0, availability.targetQuantity - availability.shipped - cartedForGroup)
  const shippableLeft = Math.max(0, availability.shippable - cartedForGroup)
  return Math.min(remaining, shippableLeft)
}

export function DeliveryInputShipPanel({
  order,
  availability,
  cart,
  lockedCustomer,
  onAddToCart,
  onUpdateCartQuantity,
  onRemoveFromCart,
  onClearCart,
  onShipped,
}: DeliveryInputShipPanelProps) {
  const toast = useToast()
  const [recordDate, setRecordDate] = useState(todayYmdSeoul)
  const [addQty, setAddQty] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastShipmentId, setLastShipmentId] = useState<string | null>(null)
  const [lastPrintLines, setLastPrintLines] = useState<DeliveryCartLine[]>([])
  const [lastShipMeta, setLastShipMeta] = useState<{ date: string; customer: string; note: string } | null>(
    null,
  )
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const assemblyGroupId = order?.assemblyGroupId || order?.orderLineId || ''
  const cartedForSelected = useMemo(() => {
    if (!assemblyGroupId) return 0
    return cart
      .filter((line) => line.assemblyGroupId === assemblyGroupId)
      .reduce((sum, line) => sum + line.quantity, 0)
  }, [assemblyGroupId, cart])

  const registerMax = registerMaxFor(availability, cartedForSelected)
  const canAdd = Boolean(order && assemblyGroupId && registerMax > 0 && availability)
  const cartTotalQty = cart.reduce((sum, line) => sum + line.quantity, 0)

  useEffect(() => {
    setAddQty(registerMax > 0 ? String(registerMax) : '')
    setMessage(null)
  }, [order?.uiKey, registerMax])

  function handleAddToCart() {
    if (!order || !availability) return

    if (lockedCustomer && lockedCustomer !== order.customer) {
      const text = `출하목록에 ${lockedCustomer} 품목이 있습니다. 같은 고객사만 추가할 수 있습니다.`
      setMessage({ text, kind: 'err' })
      toast.error('고객사 잠금', '같은 고객사 품목만 추가할 수 있습니다.')
      return
    }

    const value = Math.floor(Number(addQty))
    if (!value || value < 1) {
      setMessage({ text: '추가할 수량을 입력하세요.', kind: 'err' })
      return
    }
    if (value > registerMax) {
      setMessage({
        text:
          registerMax > 0
            ? `추가 가능 수량(${registerMax.toLocaleString('ko-KR')})을 초과할 수 없습니다.`
            : describeDeliveryBlockReason(availability),
        kind: 'err',
      })
      return
    }

    onAddToCart({
      key: assemblyGroupId,
      uiKey: order.uiKey,
      assemblyGroupId,
      orderNumber: order.orderNumber,
      customer: order.customer,
      productCode: order.productCode,
      productName: formatProductionProductName(order),
      productVersion: order.productVersion,
      unitPrice: order.unitPrice,
      quantity: value,
      maxQuantity: Math.min(
        Math.max(0, availability.targetQuantity - availability.shipped),
        availability.shippable,
      ),
    })
    setMessage(null)
    toast.success(
      '출하목록 추가',
      `${formatProductionProductName(order)} ${value.toLocaleString('ko-KR')}개`,
    )
  }

  async function printShipment(
    shipmentId: string,
    shipDate: string,
    customer: string,
    shipNote: string,
    lines: DeliveryCartLine[],
  ) {
    const built = await buildDeliveryStatementDataFromShipment({
      shipmentId,
      shipDate,
      customer,
      note: shipNote,
      shippedLines: lines.map((line) => ({
        orderNumber: line.orderNumber,
        productCode: line.productCode,
        productName: line.productName,
        qty: line.quantity,
        unitPrice: line.unitPrice,
      })),
    })
    if (!built.ok) {
      setMessage({ text: built.detail, kind: 'err' })
      toast.error('거래명세서 생성 실패', built.detail)
      return false
    }
    return printDeliveryStatement(built.data)
  }

  async function handleConfirm(printAfter: boolean) {
    if (!cart.length) {
      setMessage({ text: '출하목록에 품목을 추가해 주세요.', kind: 'err' })
      return
    }

    const shipDate = recordDate.trim()
    if (!shipDate) {
      setMessage({ text: '출하일을 선택하세요.', kind: 'err' })
      return
    }

    const customer = lockedCustomer || cart[0]!.customer
    for (const line of cart) {
      if (line.customer !== customer) {
        setMessage({ text: '같은 고객사만 한 번에 출하할 수 있습니다.', kind: 'err' })
        return
      }
      if (line.quantity < 1 || line.quantity > line.maxQuantity) {
        setMessage({
          text: `${line.productName} 수량을 확인해 주세요. (최대 ${line.maxQuantity.toLocaleString('ko-KR')})`,
          kind: 'err',
        })
        return
      }
    }

    setSaving(true)
    setMessage(null)

    const snapshot = cart.map((line) => ({ ...line }))
    const shipNote = note.trim()
    const result = await createDeliveryShipment({
      customer,
      recordDate: shipDate,
      note: shipNote,
      lines: snapshot.map((line) => ({
        assemblyGroupId: line.assemblyGroupId,
        quantity: line.quantity,
      })),
    })

    setSaving(false)

    if (!result.ok) {
      setMessage({ text: result.detail, kind: 'err' })
      toast.error('출하 확정 실패', result.detail)
      return
    }

    onShipped(
      snapshot.map((line) => ({
        assemblyGroupId: line.assemblyGroupId,
        quantity: line.quantity,
      })),
    )
    onClearCart()
    setLastShipmentId(result.shipmentId)
    setLastPrintLines(snapshot)
    setLastShipMeta({ date: shipDate, customer, note: shipNote })
    setNote('')
    setRecordDate(todayYmdSeoul())
    toast.success(
      '출하 확정 완료',
      `명세서 ${result.shipmentId} · ${snapshot.length}품목 · ${cartTotalQty.toLocaleString('ko-KR')}개`,
    )

    if (printAfter) {
      const printed = await printShipment(result.shipmentId, shipDate, customer, shipNote, snapshot)
      if (!printed) {
        setMessage({
          text: '출하는 등록됐지만 거래명세서를 열 수 없습니다. 팝업 차단을 해제해 주세요.',
          kind: 'err',
        })
        toast.error('거래명세서 인쇄 실패', '출하는 등록됐습니다. 팝업 차단을 확인해 주세요.')
      }
    }
  }

  const shipped = availability?.shipped ?? 0
  const target = availability?.targetQuantity ?? 0
  const shippable = availability?.shippable ?? 0
  const productionCap = availability?.productionCap ?? 0
  const remaining = Math.max(0, target - shipped)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 xl:max-w-6xl">
      {lockedCustomer ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
          고객사 잠금: <span className="font-bold">{lockedCustomer}</span>
          <span className="ml-2 text-sky-700">같은 고객사 품목만 추가할 수 있습니다.</span>
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              선택 품목 · 추가
            </p>
            {order ? (
              <>
                <p className="mt-1 text-sm text-slate-500">
                  {order.customer} · {order.orderNumber}
                </p>
                <h3 className="mt-0.5 text-lg font-bold text-slate-900">
                  {formatProductionProductName(order)}
                </h3>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">왼쪽에서 출하할 품목을 선택하세요.</p>
            )}
          </div>
          {order && availability ? (
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
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-emerald-700">출하가능</p>
                <p className="mt-0.5 text-base font-bold tabular-nums text-emerald-800">
                  {shippable.toLocaleString('ko-KR')}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {order && availability ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">추가 수량</span>
              <input
                type="number"
                min={1}
                step={1}
                value={addQty}
                disabled={!canAdd || saving}
                onChange={(event) => setAddQty(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleAddToCart()
                }}
                className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-lg font-bold tabular-nums disabled:bg-slate-50"
              />
            </label>
            <button
              type="button"
              disabled={!canAdd || saving}
              onClick={() => setAddQty(String(registerMax))}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              전량 ({registerMax.toLocaleString('ko-KR')})
            </button>
            <button
              type="button"
              disabled={!canAdd || saving}
              onClick={handleAddToCart}
              className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              출하목록에 추가
            </button>
            <p className={`text-sm ${canAdd ? 'text-slate-500' : 'text-amber-800'}`}>
              {canAdd
                ? `발주 잔량 ${remaining.toLocaleString('ko-KR')} · 추가 가능 ${registerMax.toLocaleString('ko-KR')}`
                : describeDeliveryBlockReason(availability)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">출하목록</h3>
            <p className="text-xs text-slate-500">
              {cart.length
                ? `${cart.length}품목 · 합계 ${cartTotalQty.toLocaleString('ko-KR')}개`
                : '추가한 품목이 여기에 모입니다. 출하 확정 시 명세서 1장으로 출력됩니다.'}
            </p>
          </div>
          {cart.length ? (
            <button
              type="button"
              disabled={saving}
              onClick={onClearCart}
              className="text-xs font-semibold text-slate-500 hover:text-rose-700"
            >
              목록 비우기
            </button>
          ) : null}
        </div>

        {cart.length ? (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">발주번호</th>
                  <th className="px-3 py-2 text-left">품명</th>
                  <th className="px-3 py-2 text-right">수량</th>
                  <th className="px-3 py-2 text-right">삭제</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((line) => (
                  <tr key={line.key} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-700">{line.orderNumber}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      <span className="block">{line.productName}</span>
                      <span className="text-xs font-normal text-slate-400">{line.productCode}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        max={line.maxQuantity}
                        value={line.quantity}
                        disabled={saving}
                        onChange={(event) => {
                          const next = Math.floor(Number(event.target.value) || 0)
                          onUpdateCartQuantity(line.key, next)
                        }}
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-right tabular-nums"
                      />
                      <span className="ml-1 text-xs text-slate-400">
                        / {line.maxQuantity.toLocaleString('ko-KR')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onRemoveFromCart(line.key)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            아직 추가된 품목이 없습니다.
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">출하일 (명세서 공통)</span>
            <input
              type="date"
              value={recordDate}
              disabled={saving}
              onChange={(event) => setRecordDate(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-50"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">비고 (명세서 공통)</span>
            <input
              value={note}
              disabled={saving}
              onChange={(event) => setNote(event.target.value)}
              placeholder="차량번호, 인수자 등"
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!cart.length || saving}
            onClick={() => void handleConfirm(false)}
            className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-bold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? '출하 중…' : '출하 확정'}
          </button>
          <button
            type="button"
            disabled={!cart.length || saving}
            onClick={() => void handleConfirm(true)}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            확정 후 명세서
          </button>
          {lastShipmentId && lastShipMeta ? (
            <button
              type="button"
              onClick={() =>
                void printShipment(
                  lastShipmentId,
                  lastShipMeta.date,
                  lastShipMeta.customer,
                  lastShipMeta.note,
                  lastPrintLines,
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              최근 명세서 출력
            </button>
          ) : null}
        </div>

        {message?.kind === 'err' ? (
          <p className="mt-3 text-sm font-medium text-red-700">{message.text}</p>
        ) : null}
      </div>
    </div>
  )
}
