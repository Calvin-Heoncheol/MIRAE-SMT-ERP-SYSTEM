'use client'

import { useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { displayOrderPoNumber, todayYmdSeoul } from '@/lib/orders/utils'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductDisplay } from '@/lib/production-input/utils'
import type {
  MaterialManualHistoryKind,
  MaterialManualOrderMetrics,
} from '@/lib/materials/manual/types'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

export type MaterialManualSaveInput = {
  kind: MaterialManualHistoryKind
  recordDate: string
  quantity: number
}

type MaterialManualInputPanelProps = {
  order: ProductionOrderLine | null
  metrics: MaterialManualOrderMetrics
  kind: MaterialManualHistoryKind
  onKindChange: (kind: MaterialManualHistoryKind) => void
  refreshing?: boolean
  /** 모달 등 임베드 — 제품 헤더 숨김 */
  embedded?: boolean
  onSave: (input: MaterialManualSaveInput) => Promise<boolean>
}

const KIND_OPTIONS: { value: MaterialManualHistoryKind; label: string }[] = [
  { value: 'inbound', label: '입고' },
  { value: 'outbound', label: '불출' },
]

export function MaterialManualInputPanel({
  order,
  metrics,
  kind,
  onKindChange,
  refreshing = false,
  embedded = false,
  onSave,
}: MaterialManualInputPanelProps) {
  const [recordDate, setRecordDate] = useState(() => todayYmdSeoul())
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit() {
    setSaving(true)
    setMessage('')
    const ok = await onSave({
      kind,
      recordDate,
      quantity: Math.floor(Number(quantity) || 0),
    })
    setSaving(false)
    if (ok) {
      setQuantity('')
      setMessage('저장했습니다.')
    }
  }

  function changeKind(next: MaterialManualHistoryKind) {
    if (next === kind) return
    setQuantity('')
    setMessage('')
    onKindChange(next)
  }

  if (!order) {
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center px-6 py-8 text-center">
        <p className="text-sm font-semibold text-slate-700">발주를 선택하세요</p>
        <p className="mt-1 text-xs text-slate-500">
          표에서 입고 또는 불출 셀을 클릭하면 등록할 수 있습니다.
        </p>
      </div>
    )
  }

  const isInbound = kind === 'inbound'
  const remainingInbound = Math.max(0, order.quantity - metrics.inboundSets)
  const outboundAvailable = Math.max(0, metrics.inboundSets - metrics.outboundSets)
  const placeholderQty = isInbound ? remainingInbound : outboundAvailable
  const { name: productName, version: productVersion } = formatProductionProductDisplay(order)

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
      {!embedded ? (
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <p className={`text-xs font-semibold ${isInbound ? 'text-amber-700' : 'text-sky-700'}`}>
              자재 {isInbound ? '입고' : '불출'}
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900">
              <span>{productName}</span>
              {productVersion ? (
                <span className="ml-1.5 text-base font-semibold text-sky-600">{productVersion}</span>
              ) : null}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{order.customer || '—'}</p>
            <p className="font-mono text-xs text-slate-500">
              {displayOrderPoNumber(order.customerPoNumber, order.orderNumber)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto grid max-w-xl gap-4">
          <div className="inline-flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {KIND_OPTIONS.map((option) => {
              const active = option.value === kind
              const activeClass =
                option.value === 'inbound'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-sky-600 text-white shadow-sm'
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => changeKind(option.value)}
                  className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
                    active ? activeClass : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-4 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div>
              <p className="text-[11px] font-semibold text-slate-500">발주</p>
              <p className="mt-0.5 font-bold tabular-nums text-slate-900">
                {order.quantity.toLocaleString('ko-KR')}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500">누적 입고</p>
              <p className="mt-0.5 font-bold tabular-nums text-amber-800">
                {metrics.inboundSets.toLocaleString('ko-KR')}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500">누적 불출</p>
              <p className="mt-0.5 font-bold tabular-nums text-sky-800">
                {metrics.outboundSets.toLocaleString('ko-KR')}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-500">
                {isInbound ? '입고 잔량' : '불출 가능'}
              </p>
              <p className="mt-0.5 font-bold tabular-nums text-slate-900">
                {placeholderQty.toLocaleString('ko-KR')}
              </p>
            </div>
          </div>

          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>일자</span>
            <input
              type="date"
              value={recordDate}
              onChange={(event) => setRecordDate(event.target.value)}
              className={ERP_FIELD_INPUT_CLASS}
            />
          </label>

          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>
              {isInbound ? '입고' : '불출'} 수량 (제품 세트)
            </span>
            <input
              type="number"
              min={0}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder={placeholderQty > 0 ? String(placeholderQty) : '0'}
              className={`${ERP_FIELD_INPUT_CLASS} text-right tabular-nums`}
            />
            <p className="mt-1 text-xs text-slate-500">
              {isInbound
                ? '제품 몇 대분의 자재가 입고됐는지 입력합니다. SMT 생산계획의 자재 가용 수량에 반영됩니다.'
                : '제품 몇 대분의 자재를 생산 라인으로 불출했는지 입력합니다. 누적 입고 수량까지 불출할 수 있습니다.'}
            </p>
          </label>

          {message ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </p>
          ) : null}

          <ErpButton
            type="button"
            onClick={() => void handleSubmit()}
            disabled={saving || refreshing}
            loading={saving}
            className="w-full sm:w-auto"
          >
            {isInbound ? '입고 저장' : '불출 저장'}
          </ErpButton>
        </div>
      </div>
    </div>
  )
}
