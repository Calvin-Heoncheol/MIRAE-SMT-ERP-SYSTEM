'use client'

import { type Dispatch, type SetStateAction } from 'react'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { ProductCombobox } from '@/components/orders/product-combobox'
import type { OrderItemForm } from '@/lib/orders/form-state'
import { computeLineAmount } from '@/lib/orders/utils'
import type { Product } from '@/lib/products/types'

type OrderItemsFormProps = {
  items: OrderItemForm[]
  customer: string
  products: Product[]
  onChange: Dispatch<SetStateAction<OrderItemForm[]>>
}

function applyProductToItem(item: OrderItemForm, product: Product): OrderItemForm {
  return {
    ...item,
    productId: product.id,
    productCode: product.productCode,
    productName: product.productName,
    unitPrice: String(product.defaultUnitPrice),
  }
}

export function OrderItemsForm({ items, customer, products, onChange }: OrderItemsFormProps) {
  function patchItem(index: number, patch: Partial<OrderItemForm>) {
    onChange((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  function addRow() {
    onChange([
      ...items,
      { productId: '', productCode: '', productName: '', quantity: '0', unitPrice: '0' },
    ])
  }

  function removeRow(index: number) {
    if (items.length <= 1) return
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  function selectProduct(index: number, product: Product) {
    onChange((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? applyProductToItem(item, product) : item,
      ),
    )
  }

  const inputClassName =
    'w-full min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100'

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200">
        <table className="min-w-[640px] w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="min-w-[280px] px-3 py-2 text-left text-sm font-semibold text-slate-600">
                제품명
              </th>
              <th className="min-w-[72px] whitespace-nowrap px-3 py-2 text-right text-sm font-semibold text-slate-600">
                수량
              </th>
              <th className="min-w-[96px] whitespace-nowrap px-3 py-2 text-right text-sm font-semibold text-slate-600">
                단가 (원)
              </th>
              <th className="min-w-[104px] whitespace-nowrap px-3 py-2 text-right text-sm font-semibold text-slate-600">
                금액 (원)
              </th>
              <th className="w-16 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const amount = computeLineAmount(Number(item.quantity), Number(item.unitPrice))
              return (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-3 py-2 align-top">
                    <ProductCombobox
                      value={item.productName}
                      products={products}
                      customer={customer}
                      field="name"
                      placeholder="제품명 입력 또는 검색"
                      ariaLabel={`${index + 1}행 제품명`}
                      inputClassName={`${inputClassName} min-w-[280px]`}
                      onValueChange={(productName) =>
                        patchItem(index, { productName, productId: '', productCode: '' })
                      }
                      onProductSelect={(product) => selectProduct(index, product)}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <QuoteNumericInput
                      min={0}
                      value={String(item.quantity)}
                      onChange={(quantity) => patchItem(index, { quantity })}
                      className={`${inputClassName} min-w-[80px] text-right`}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <QuoteNumericInput
                      min={0}
                      value={String(item.unitPrice)}
                      onChange={(unitPrice) => patchItem(index, { unitPrice })}
                      className={`${inputClassName} min-w-[100px] text-right`}
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-medium tabular-nums text-slate-800 align-top">
                    {amount.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-3 py-2 text-center align-top">
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
      <p className="text-xs text-slate-500">
        제품명은 등록된 제품 목록과 정확히 일치해야 저장됩니다. 선택 후 제품명을 수정·삭제하면 저장되지
        않습니다.
      </p>
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
