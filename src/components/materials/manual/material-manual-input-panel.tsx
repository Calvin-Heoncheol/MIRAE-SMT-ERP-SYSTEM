'use client'

import { useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { displayOrderPoNumber, todayYmdSeoul } from '@/lib/orders/utils'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductDisplay } from '@/lib/production-input/utils'
import type { MaterialManualOrderMetrics } from '@/lib/materials/manual/types'
import { ERP_FIELD_INPUT_CLASS, ERP_FIELD_LABEL_CLASS } from '@/lib/ui/tokens'

type MaterialManualInputPanelProps = {
  order: ProductionOrderLine | null
  metrics: MaterialManualOrderMetrics
  refreshing?: boolean
  /** 모달 등 임베드 — 제품 헤더 숨김 */
  embedded?: boolean
  onSave: (input: {
    recordDate: string
    inboundQty: number
    outboundQty: number
  }) => Promise<boolean>
}

export function MaterialManualInputPanel({
  order,
  metrics,
  refreshing = false,
  embedded = false,
  onSave,
}: MaterialManualInputPanelProps) {
  const [recordDate, setRecordDate] = useState(() => todayYmdSeoul())
  const [inboundQty, setInboundQty] = useState('')
  const [outboundQty, setOutboundQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSubmit() {
    setSaving(true)
    setMessage('')
    const ok = await onSave({
      recordDate,
      inboundQty: Math.floor(Number(inboundQty) || 0),
      outboundQty: Math.floor(Number(outboundQty) || 0),
    })
    setSaving(false)
    if (ok) {
      setInboundQty('')
      setOutboundQty('')
      setMessage('저장했습니다.')
    }
  }

  if (!order) {
    return (
      <div className="flex min-h-[12rem] flex-col items-center justify-center px-6 py-8 text-center">
        <p className="text-sm font-semibold text-slate-700">발주를 선택하세요</p>
        <p className="mt-1 text-xs text-slate-500">표에서 입고·불출 셀을 클릭하면 등록할 수 있습니다.</p>
      </div>
    )
  }

  const remainingInbound = Math.max(0, order.quantity - metrics.inboundSets)
  const remainingOutbound = Math.max(0, metrics.inboundSets - metrics.outboundSets)
  const { name: productName, version: productVersion } = formatProductionProductDisplay(order)

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
      {!embedded ? (
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-amber-700">입고 및 불출</p>
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
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-4">
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
              <p className="text-[11px] font-semibold text-slate-500">입고 잔량</p>
              <p className="mt-0.5 font-bold tabular-nums text-slate-900">
                {remainingInbound.toLocaleString('ko-KR')}
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
            <span className={ERP_FIELD_LABEL_CLASS}>입고 수량</span>
            <input
              type="number"
              min={0}
              step={1}
              value={inboundQty}
              onChange={(event) => setInboundQty(event.target.value)}
              placeholder={remainingInbound > 0 ? String(remainingInbound) : '0'}
              className={`${ERP_FIELD_INPUT_CLASS} text-right tabular-nums`}
            />
            <p className="mt-1 text-xs text-slate-500">
              이번에 입고할 수량입니다. SMT 생산계획의 자재 가용 수량에 반영됩니다.
            </p>
          </label>

          <label className="block text-sm">
            <span className={ERP_FIELD_LABEL_CLASS}>불출 수량</span>
            <input
              type="number"
              min={0}
              step={1}
              value={outboundQty}
              onChange={(event) => setOutboundQty(event.target.value)}
              placeholder={remainingOutbound > 0 ? String(remainingOutbound) : '0'}
              className={`${ERP_FIELD_INPUT_CLASS} text-right tabular-nums`}
            />
            <p className="mt-1 text-xs text-slate-500">
              이번에 불출할 수량입니다. 누적 불출에 더해집니다.
              {metrics.inboundSets <= 0 ? ' (입고 기록 후 불출 가능)' : ''}
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
            저장
          </ErpButton>
        </div>
      </div>
    </div>
  )
}
