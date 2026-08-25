'use client'

import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { ProductCombobox } from '@/components/orders/product-combobox'
import { parseItemVersionCode } from '@/lib/items/version-code'
import {
  defaultAdhocOrderItemForm,
  defaultOrderItemForm,
  type OrderItemForm,
} from '@/lib/orders/form-state'
import { computeLineAmount } from '@/lib/orders/utils'
import type { Product } from '@/lib/products/types'
import { findProductsByCode, findProductsByName } from '@/lib/products/utils'
import { ERP_ROW_ADD_BUTTON_CLASS } from '@/lib/ui/tokens'

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

function productVersionCandidates(item: OrderItemForm, products: Product[], customer: string): Product[] {
  if (item.isAdhoc || item.productId) return []
  const code = item.productCode.trim()
  const name = item.productName.trim()
  if (code) {
    const byCode = findProductsByCode(products, code, customer)
    if (byCode.length > 1) return byCode
  }
  if (name) {
    const byName = findProductsByName(products, name, customer)
    if (byName.length > 1) return byName
  }
  return []
}

function productVersionLabel(item: OrderItemForm, products: Product[]) {
  if (item.isAdhoc) return null
  const byId = item.productId ? products.find((product) => product.id === item.productId) : null
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
  const quantityRefs = useRef<(HTMLInputElement | null)[]>([])

  function focusQuantity(index: number) {
    window.setTimeout(() => {
      quantityRefs.current[index]?.focus()
      quantityRefs.current[index]?.select()
    }, 50)
  }

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
    onChange((current) => [...current, defaultOrderItemForm()])
  }

  function addAdhocRow() {
    onChange((current) => [...current, defaultAdhocOrderItemForm()])
  }

  function removeRow(index: number) {
    const target = items[index]
    if (!target) return
    const productRows = items.filter((item) => !item.isAdhoc)
    if (!target.isAdhoc && productRows.length <= 1) return
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  function selectProduct(index: number, product: Product) {
    const sameCode = products.filter(
      (p) => p.productCode === product.productCode && (!product.productName || p.productName === product.productName),
    )
    const isAmbiguous = sameCode.length > 1
    onChange((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const applied = applyProductToItem(item, product)
        if (isAmbiguous) {
          return { ...applied, productId: '' }
        }
        return applied
      }),
    )
  }

  function confirmVersion(index: number, product: Product) {
    onChange((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? applyProductToItem(item, product) : item,
      ),
    )
  }

  const inputClassName =
    'w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100'

  const columnCount = 7

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-900">제품</h3>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[16%]" />
            <col className="w-[26%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[18%]" />
            <col className="w-[14%]" />
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
              const versionCandidates = productVersionCandidates(item, products, customer)
              const isAdhoc = Boolean(item.isAdhoc)
              const canRemove = isAdhoc || items.filter((row) => !row.isAdhoc).length > 1

              return (
                <tr
                  key={item.rowKey}
                  className={['border-t border-slate-100', isAdhoc ? 'bg-amber-50/40' : ''].join(' ')}
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
                        placeholder="코드 (선택)"
                        aria-label={`${index + 1}행 추가 작업 코드`}
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
                        onVersionResolved={() => focusQuantity(index)}
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
                          placeholder="예: 추가가공비, 특별할증"
                          aria-label={`${index + 1}행 추가 작업명`}
                          className={inputClassName}
                        />
                        <span className="inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                          추가 작업
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
                        onVersionResolved={() => focusQuantity(index)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 align-top text-center">
                    {isAdhoc ? (
                      <div className="flex h-[34px] items-center justify-center text-xs text-slate-300">
                        —
                      </div>
                    ) : versionCandidates.length > 1 ? (
                      <select
                        aria-label={`${index + 1}행 버전 선택`}
                        defaultValue=""
                        onChange={(e) => {
                          const chosen = versionCandidates.find((p) => p.id === e.target.value)
                          if (chosen) {
                            confirmVersion(index, chosen)
                            focusQuantity(index)
                          }
                        }}
                        className="w-full rounded-lg border border-amber-300 bg-amber-50 px-1.5 py-1.5 text-xs font-semibold text-amber-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                      >
                        <option value="" disabled>
                          선택
                        </option>
                        {versionCandidates.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.version?.trim() || '버전 없음'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex h-[34px] items-center justify-center">
                        {version ? (
                          <span className="text-xs font-semibold text-sky-700">{version}</span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <QuoteNumericInput
                      ref={(el) => {
                        quantityRefs.current[index] = el
                      }}
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
                      disabled={!canRemove}
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
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50/80">
              <td colSpan={columnCount} className="px-2 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={addRow}
                    className={ERP_ROW_ADD_BUTTON_CLASS}
                    title="행 추가"
                    aria-label="행 추가"
                  >
                    + 행 추가
                  </button>
                  <button
                    type="button"
                    onClick={addAdhocRow}
                    className={ERP_ROW_ADD_BUTTON_CLASS}
                    title="추가 작업"
                    aria-label="추가 작업"
                  >
                    + 추가 작업
                  </button>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        제품을 선택하면 품목의 기본 단가가 자동으로 들어갑니다. 이번 발주만 다르면 단가를 직접
        고치면 됩니다. 추가 작업은 품목등록 없이 금액만 넣으며, 생산에는 반영되지 않고
        거래명세서에만 표시됩니다.
      </p>
    </div>
  )
}
