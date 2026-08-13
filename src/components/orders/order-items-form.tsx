'use client'

import { type Dispatch, type SetStateAction, useEffect } from 'react'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { ProductCombobox } from '@/components/orders/product-combobox'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import { parseItemVersionCode } from '@/lib/items/version-code'
import {
  defaultAdhocOrderItemForm,
  defaultOrderItemForm,
  type OrderItemForm,
} from '@/lib/orders/form-state'
import { computeLineAmount } from '@/lib/orders/utils'
import type { Product } from '@/lib/products/types'

type OrderItemsFormProps = {
  items: OrderItemForm[]
  customer: string
  products: Product[]
  onChange: Dispatch<SetStateAction<OrderItemForm[]>>
}

function unitPriceFromProduct(product: Product) {
  return Math.max(0, Math.round(Number(product.defaultUnitPrice) || 0))
}

function applyProductToItem(item: OrderItemForm, product: Product): OrderItemForm {
  return {
    ...item,
    productId: product.id,
    productCode: product.productCode,
    productName: product.productName,
    unitPrice: String(unitPriceFromProduct(product)),
    quoteId: '',
    isAdhoc: false,
  }
}

function productVersionLabel(item: OrderItemForm, products: Product[]) {
  if (item.isAdhoc) return null
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
  onChange,
}: OrderItemsFormProps) {
  // 품목 기본 단가가 나중에 로드되면, 단가 0인 행만 채움
  useEffect(() => {
    onChange((current) => {
      let changed = false
      const next = current.map((item) => {
        if (item.isAdhoc || !item.productId) return item
        if (Math.round(Number(item.unitPrice) || 0) > 0) return item
        const product = products.find((entry) => entry.id === item.productId)
        if (!product) return item
        const unitPrice = unitPriceFromProduct(product)
        if (unitPrice <= 0) return item
        changed = true
        return { ...item, unitPrice: String(unitPrice), quoteId: '' }
      })
      return changed ? next : current
    })
  }, [products, onChange])

  function patchItem(index: number, patch: Partial<OrderItemForm>) {
    onChange((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  function addRow() {
    onChange([...items, defaultOrderItemForm()])
  }

  function addAdhocRow() {
    onChange([...items, defaultAdhocOrderItemForm()])
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addAdhocRow}
            className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
            title="품목등록에 없는 일회성 금액·품목"
          >
            + 임시 품목
          </button>
          <ErpRowAddButton onClick={addRow} title="제품 추가" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[24%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[18%]" />
            <col className="w-[12%]" />
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
              <th className="px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const amount = computeLineAmount(Number(item.quantity), Number(item.unitPrice))
              const version = productVersionLabel(item, products)
              const isAdhoc = Boolean(item.isAdhoc)

              return (
                <tr
                  key={index}
                  className={[
                    'border-t border-slate-100',
                    isAdhoc ? 'bg-amber-50/40' : '',
                  ].join(' ')}
                >
                  <td className="px-2 py-2 align-top">
                    {isAdhoc ? (
                      <input
                        value={item.productCode}
                        onChange={(event) =>
                          patchItem(index, {
                            productCode: event.target.value,
                            productId: '',
                            quoteId: '',
                          })
                        }
                        placeholder="선택 (예: TEMP)"
                        aria-label={`${index + 1}행 임시 제품코드`}
                        className={inputClassName}
                      />
                    ) : (
                      <ProductCombobox
                        value={item.productCode}
                        products={products}
                        customer={customer}
                        field="code"
                        placeholder="코드 검색"
                        ariaLabel={`${index + 1}행 제품코드`}
                        inputClassName={inputClassName}
                        onValueChange={(productCode) =>
                          patchItem(index, {
                            productCode,
                            productId: '',
                            productName: '',
                            quoteId: '',
                            unitPrice: '0',
                          })
                        }
                        onProductSelect={(product) => selectProduct(index, product)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    {isAdhoc ? (
                      <div className="space-y-1">
                        <input
                          value={item.productName}
                          onChange={(event) =>
                            patchItem(index, {
                              productName: event.target.value,
                              productId: '',
                              quoteId: '',
                            })
                          }
                          placeholder="예: 특별할증, 추가가공비"
                          aria-label={`${index + 1}행 임시 제품명`}
                          className={inputClassName}
                        />
                        <span className="inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          임시
                        </span>
                      </div>
                    ) : (
                      <ProductCombobox
                        value={item.productName}
                        products={products}
                        customer={customer}
                        field="name"
                        placeholder="제품명"
                        ariaLabel={`${index + 1}행 제품명`}
                        inputClassName={inputClassName}
                        onValueChange={(productName) =>
                          patchItem(index, {
                            productName,
                            productId: '',
                            productCode: '',
                            quoteId: '',
                            unitPrice: '0',
                          })
                        }
                        onProductSelect={(product) => selectProduct(index, product)}
                      />
                    )}
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
        제품을 선택하면 품목의 기본 단가가 자동으로 들어갑니다. 이번 주문만 다르면 단가를 직접
        고치면 됩니다. 임시 품목은 이 주문에만 반영됩니다.
      </p>
    </div>
  )
}
