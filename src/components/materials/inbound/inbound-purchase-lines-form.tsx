'use client'

import { type Dispatch, type SetStateAction } from 'react'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import type { PurchaseInboundItemForm } from '@/lib/materials/inbound/form-state'

type InboundPurchaseLinesFormProps = {
  items: PurchaseInboundItemForm[]
  onChange: Dispatch<SetStateAction<PurchaseInboundItemForm[]>>
}

export function InboundPurchaseLinesForm({ items, onChange }: InboundPurchaseLinesFormProps) {
  const inputClassName =
    'w-full min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

  function patchItem(index: number, patch: Partial<PurchaseInboundItemForm>) {
    onChange((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        입고 가능한 발주 라인이 없습니다.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-[920px] w-full border-collapse text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-sm font-semibold text-slate-600">자재코드</th>
            <th className="px-3 py-2 text-left text-sm font-semibold text-slate-600">자재명</th>
            <th className="px-3 py-2 text-right text-sm font-semibold text-slate-600">발주수량</th>
            <th className="px-3 py-2 text-right text-sm font-semibold text-slate-600">기입고</th>
            <th className="px-3 py-2 text-right text-sm font-semibold text-slate-600">잔량</th>
            <th className="px-3 py-2 text-right text-sm font-semibold text-slate-600">입고수량</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.purchaseOrderLineId} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium text-violet-800">{item.materialCode || '-'}</td>
              <td className="px-3 py-2 text-slate-700">{item.materialName || '-'}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                {item.orderedQuantity.toLocaleString('ko-KR')}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                {item.receivedQuantity.toLocaleString('ko-KR')}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium text-amber-700">
                {item.remainingQuantity.toLocaleString('ko-KR')}
              </td>
              <td className="px-3 py-2">
                <QuoteNumericInput
                  min={0}
                  value={String(item.quantity)}
                  onChange={(quantity) => patchItem(index, { quantity })}
                  className={`${inputClassName} min-w-[96px] text-right`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
