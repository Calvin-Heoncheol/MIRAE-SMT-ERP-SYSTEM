'use client'

import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { computeLineAmount } from '@/lib/orders/utils'
import type { OrderItemForm } from '@/lib/orders/form-state'

type OrderItemsFormProps = {
  items: OrderItemForm[]
  onChange: (items: OrderItemForm[]) => void
}

export function OrderItemsForm({ items, onChange }: OrderItemsFormProps) {
  function patchItem(index: number, patch: Partial<OrderItemForm>) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  function addRow() {
    onChange([
      ...items,
      { productCode: '', productName: '', quantity: '0', unitPrice: '0' },
    ])
  }

  function removeRow(index: number) {
    if (items.length <= 1) return
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">제품코드</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">제품명</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">수량</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">단가(원)</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">주문금액(원)</th>
              <th className="w-16 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const amount = computeLineAmount(Number(item.quantity), Number(item.unitPrice))
              return (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <input
                      value={item.productCode}
                      onChange={(event) => patchItem(index, { productCode: event.target.value })}
                      placeholder="코드 (선택)"
                      className="w-full min-w-[100px] rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={item.productName}
                      onChange={(event) => patchItem(index, { productName: event.target.value })}
                      placeholder="제품명"
                      className="w-full min-w-[160px] rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <QuoteNumericInput
                      min={0}
                      value={String(item.quantity)}
                      onChange={(quantity) => patchItem(index, { quantity })}
                      className="w-full min-w-[80px] rounded-lg border border-slate-200 px-2.5 py-2 text-right text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <QuoteNumericInput
                      min={0}
                      value={String(item.unitPrice)}
                      onChange={(unitPrice) => patchItem(index, { unitPrice })}
                      className="w-full min-w-[100px] rounded-lg border border-slate-200 px-2.5 py-2 text-right text-sm"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-medium tabular-nums text-slate-800">
                    {amount.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={items.length <= 1}
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addRow}
        className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-800"
      >
        + 제품 추가
      </button>
    </div>
  )
}
