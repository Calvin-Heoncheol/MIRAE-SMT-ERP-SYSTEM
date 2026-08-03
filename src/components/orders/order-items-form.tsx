'use client'

import { type Dispatch, type SetStateAction } from 'react'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { ProductCombobox } from '@/components/orders/product-combobox'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import { parseItemVersionCode } from '@/lib/items/version-code'
import { defaultOrderItemForm, type OrderItemForm } from '@/lib/orders/form-state'
import { computeLineAmount } from '@/lib/orders/utils'
import type { Product } from '@/lib/products/types'

type OrderItemsFormProps = {
  items: OrderItemForm[]
  customer: string
  products: Product[]
  /** 제품 행 추가 시 기본 납기일 (상단 공통 납기일) */
  defaultDeliveryDate?: string
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

function productVersionLabel(item: OrderItemForm, products: Product[]) {
  const byId = item.productId
    ? products.find((product) => product.id === item.productId)
    : null
  if (byId?.version) return byId.version
  const byCode = products.find(
    (product) =>
      product.productCode === item.productCode.trim() &&
      (!item.productName.trim() || product.productName === item.productName.trim()),
  )
  if (byCode?.version) return byCode.version
  return (
    parseItemVersionCode(item.productId || '').version ||
    parseItemVersionCode(item.productCode.trim()).version
  )
}

export function OrderItemsForm({
  items,
  customer,
  products,
  defaultDeliveryDate = '',
  onChange,
}: OrderItemsFormProps) {
  function patchItem(index: number, patch: Partial<OrderItemForm>) {
    onChange((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  function addRow() {
    const fallback =
      String(defaultDeliveryDate || '').trim() ||
      [...items].reverse().find((item) => String(item.deliveryDate || '').trim())?.deliveryDate ||
      ''
    onChange([...items, defaultOrderItemForm(String(fallback))])
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
    'w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">제품</h3>
        <ErpRowAddButton onClick={addRow} title="제품 추가" />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[22%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[15%]" />
            <col className="w-10" />
          </colgroup>
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">제품코드</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">제품명</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-slate-600">버전</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">수량</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">단가</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">금액</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">납기일</th>
              <th className="px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const amount = computeLineAmount(Number(item.quantity), Number(item.unitPrice))
              const version = productVersionLabel(item, products)
              return (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-2 py-2 align-top">
                    <ProductCombobox
                      value={item.productCode}
                      products={products}
                      customer={customer}
                      field="code"
                      placeholder="코드 검색"
                      ariaLabel={`${index + 1}행 제품코드`}
                      inputClassName={inputClassName}
                      onValueChange={(productCode) =>
                        patchItem(index, { productCode, productId: '', productName: '' })
                      }
                      onProductSelect={(product) => selectProduct(index, product)}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <ProductCombobox
                      value={item.productName}
                      products={products}
                      customer={customer}
                      field="name"
                      placeholder="제품명"
                      ariaLabel={`${index + 1}행 제품명`}
                      inputClassName={inputClassName}
                      onValueChange={(productName) =>
                        patchItem(index, { productName, productId: '', productCode: '' })
                      }
                      onProductSelect={(product) => selectProduct(index, product)}
                    />
                  </td>
                  <td className="px-2 py-2 align-top text-center">
                    <div className="flex h-[34px] items-center justify-center">
                      {version ? (
                        <span className="text-xs font-semibold text-sky-700">{version}</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <QuoteNumericInput
                      min={0}
                      value={String(item.quantity)}
                      onChange={(quantity) => patchItem(index, { quantity })}
                      className={`${inputClassName} text-right`}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <QuoteNumericInput
                      min={0}
                      value={String(item.unitPrice)}
                      onChange={(unitPrice) => patchItem(index, { unitPrice })}
                      className={`${inputClassName} text-right`}
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-sm font-medium tabular-nums text-slate-800 align-top">
                    <div className="flex h-[34px] items-center justify-end">
                      {amount.toLocaleString('ko-KR')}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <input
                      type="date"
                      value={item.deliveryDate || ''}
                      onChange={(event) => patchItem(index, { deliveryDate: event.target.value })}
                      aria-label={`${index + 1}행 납기일`}
                      className={inputClassName}
                    />
                  </td>
                  <td className="px-1 py-2 text-center align-top">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={items.length <= 1}
                      className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`${index + 1}행 삭제`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        제품코드·제품명이 하나뿐이면 자동으로 채워집니다. 버전이 여러 개면 드롭다운에서 버전을 선택해야
        합니다. 상단 납기일로 일괄 입력한 뒤, 행마다 다르게 바꿀 수도 있습니다.
      </p>
    </div>
  )
}
