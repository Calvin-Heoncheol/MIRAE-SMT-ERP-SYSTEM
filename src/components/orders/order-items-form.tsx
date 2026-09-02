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
import { computeLineAmount, computeOrderLineBreakdownAmount, computeOrderLineAmortizedUnitPrice, computeOrderLineMaterialCost, formatOrderMoney, isBillingOnlyOrderItem, orderCurrencySymbol, orderLinePerUnitPrice } from '@/lib/orders/utils'
import type { OrderCurrency } from '@/lib/orders/types'
import type { Product } from '@/lib/products/types'
import { findProductsByCode, findProductsByName } from '@/lib/products/utils'
import { ERP_ROW_ADD_BUTTON_CLASS } from '@/lib/ui/tokens'

type OrderItemsFormProps = {
  items: OrderItemForm[]
  customer: string
  products: Product[]
  currency?: OrderCurrency
  onChange: Dispatch<SetStateAction<OrderItemForm[]>>
}

function unitPriceFromProduct(product: Product) {
  return orderLinePerUnitPrice(product.smdUnitPrice, product.dipUnitPrice) ||
    Math.max(0, Math.round(Number(product.defaultUnitPrice) || 0))
}

function productAdditionalCost(product: Product) {
  return Math.max(0, Math.round(Number(product.additionalUnitPrice) || 0))
}

function isCompanionRow(row: OrderItemForm) {
  return Boolean(row.isAdhoc && row.companionOfRowKey?.trim())
}

function findCompanionIndex(items: OrderItemForm[], parentRowKey: string) {
  return items.findIndex((row) => row.isAdhoc && row.companionOfRowKey === parentRowKey)
}

function stripCompanionRows(items: OrderItemForm[], parentRowKey: string) {
  return items.filter((row) => !(row.isAdhoc && row.companionOfRowKey === parentRowKey))
}

function buildAdditionalCostRow(parent: OrderItemForm, product: Product): OrderItemForm {
  const row = defaultAdhocOrderItemForm(String(parent.deliveryDate || ''))
  return {
    ...row,
    productId: product.id,
    productCode: product.productCode,
    productName: product.productName,
    quantity: String(parent.quantity || '0'),
    unitPrice: String(productAdditionalCost(product)),
    companionOfRowKey: parent.rowKey,
    deliveryDate: parent.deliveryDate,
  }
}

function syncAdditionalCostRow(items: OrderItemForm[], index: number, product: Product) {
  const parent = items[index]
  if (!parent || parent.isAdhoc) return items

  const additional = productAdditionalCost(product)
  let next = stripCompanionRows(items, parent.rowKey)
  const parentIndex = next.findIndex((row) => row.rowKey === parent.rowKey)
  if (parentIndex < 0) return next

  if (additional <= 0) return next

  const companion = buildAdditionalCostRow(parent, product)
  const insertAt = parentIndex + 1
  return [...next.slice(0, insertAt), companion, ...next.slice(insertAt)]
}

function applyProductSelection(items: OrderItemForm[], index: number, product: Product, isAmbiguous: boolean) {
  const parent = items[index]
  if (!parent) return items

  let next = stripCompanionRows(items, parent.rowKey)
  const parentIndex = next.findIndex((row) => row.rowKey === parent.rowKey)
  if (parentIndex < 0) return next

  next = next.map((item, itemIndex) => {
    if (itemIndex !== parentIndex) return item
    const applied = applyProductToItem(item, product)
    if (isAmbiguous) {
      return { ...applied, productId: '' }
    }
    return applied
  })

  if (isAmbiguous) return next
  return syncAdditionalCostRow(next, parentIndex, product)
}

function applyProductToItem(item: OrderItemForm, product: Product): OrderItemForm {
  if (item.isAdhoc) {
    return {
      ...item,
      productId: product.id,
      productCode: product.productCode,
      productName: product.productName,
      quoteId: '',
      isAdhoc: true,
    }
  }
  const smd = Math.max(0, Math.round(Number(product.smdUnitPrice) || 0))
  const dip = Math.max(0, Math.round(Number(product.dipUnitPrice) || 0))
  const perUnit = orderLinePerUnitPrice(smd, dip) || unitPriceFromProduct(product)
  const setupCost = Math.max(0, Math.round(Number(product.setupUnitPrice) || 0))
  const materialUnitPrice = Math.max(0, Math.round(Number(product.materialUnitPrice) || 0))
  const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
  const unitPrice = computeOrderLineAmortizedUnitPrice({
    quantity,
    setupCost,
    smdUnitPrice: smd,
    dipUnitPrice: dip,
    materialUnitPrice,
  }) || perUnit + materialUnitPrice
  const materialCost = computeOrderLineMaterialCost(quantity, materialUnitPrice)
  return {
    ...item,
    productId: product.id,
    productCode: product.productCode,
    productName: product.productName,
    setupCost: String(setupCost),
    smdUnitPrice: String(smd || perUnit),
    dipUnitPrice: String(dip),
    materialUnitPrice: String(materialUnitPrice),
    materialCost: String(materialCost),
    unitPrice: String(unitPrice),
    quoteId: '',
    isAdhoc: false,
  }
}

function lineAmount(item: OrderItemForm) {
  const quantity = Number(item.quantity) || 0
  if (item.isAdhoc || isBillingOnlyOrderItem(item)) {
    return computeLineAmount(quantity, Number(item.unitPrice) || 0)
  }
  return computeOrderLineBreakdownAmount({
    quantity,
    setupCost: Number(item.setupCost) || 0,
    smdUnitPrice: Number(item.smdUnitPrice) || 0,
    dipUnitPrice: Number(item.dipUnitPrice) || 0,
    materialUnitPrice: Number(item.materialUnitPrice) || 0,
  })
}

function syncLinePricing(
  item: OrderItemForm,
  patch: Partial<OrderItemForm>,
): Partial<OrderItemForm> {
  const merged = { ...item, ...patch }
  const quantity = Math.max(0, Math.floor(Number(merged.quantity) || 0))
  const materialUnitPrice = Math.max(0, Math.round(Number(merged.materialUnitPrice) || 0))
  const unitPrice = computeOrderLineAmortizedUnitPrice({
    quantity,
    setupCost: Number(merged.setupCost) || 0,
    smdUnitPrice: Number(merged.smdUnitPrice) || 0,
    dipUnitPrice: Number(merged.dipUnitPrice) || 0,
    materialUnitPrice,
  })
  const materialCost = computeOrderLineMaterialCost(quantity, materialUnitPrice)
  return {
    ...patch,
    unitPrice: String(unitPrice),
    materialCost: String(materialCost),
  }
}

function productVersionCandidates(item: OrderItemForm, products: Product[], customer: string): Product[] {
  if (item.productId) return []
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
  currency = 'KRW',
  onChange,
}: OrderItemsFormProps) {
  const moneySymbol = orderCurrencySymbol(currency)
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
        if (item.isAdhoc || isBillingOnlyOrderItem(item)) return item
        if (Math.round(Number(item.smdUnitPrice) || 0) > 0 || Math.round(Number(item.unitPrice) || 0) > 0) {
          return item
        }
        const product = products.find((entry) => entry.id === item.productId)
        if (!product) return item
        const applied = applyProductToItem(item, product)
        if (
          applied.setupCost === item.setupCost &&
          applied.smdUnitPrice === item.smdUnitPrice &&
          applied.materialUnitPrice === item.materialUnitPrice &&
          applied.dipUnitPrice === item.dipUnitPrice
        ) {
          return item
        }
        changed = true
        return applied
      })
      return changed ? next : current
    })
  }, [products, onChange])

  function patchItem(index: number, patch: Partial<OrderItemForm>) {
    const item = items[index]
    const merged = item && !item.isAdhoc ? syncLinePricing(item, patch) : patch
    onChange((current) => {
      let next = current.map((row, itemIndex) =>
        itemIndex === index ? { ...row, ...merged } : row,
      )
      if (item && !item.isAdhoc && patch.quantity != null) {
        const companionIndex = findCompanionIndex(next, item.rowKey)
        if (companionIndex >= 0) {
          next = next.map((row, itemIndex) =>
            itemIndex === companionIndex ? { ...row, quantity: patch.quantity! } : row,
          )
        }
      }
      return next
    })
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
    let next = items.filter((_, itemIndex) => itemIndex !== index)
    if (!target.isAdhoc) {
      next = stripCompanionRows(next, target.rowKey)
    }
    onChange(next)
  }

  function selectProduct(index: number, product: Product) {
    const sameCode = products.filter(
      (p) => p.productCode === product.productCode && (!product.productName || p.productName === product.productName),
    )
    const isAmbiguous = sameCode.length > 1
    onChange((current) => applyProductSelection(current, index, product, isAmbiguous))
  }

  function confirmVersion(index: number, product: Product) {
    onChange((current) => applyProductSelection(current, index, product, false))
  }

  const inputClassName =
    'w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100'

  const columnCount = 7

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-900">제품</h3>
      <p className="text-xs text-slate-500">
        제품 선택 시 품목 마스터의 SET-UP·SMD·후공정·자재가 적용됩니다. 수량 변경 시 SET-UP÷수량이 자동 재계산됩니다.
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="erp-data-table erp-data-table--compact min-w-[760px] w-full border-collapse text-sm">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[24%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-10" />
          </colgroup>
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">제품코드</th>
              <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">제품명</th>
              <th className="px-2 py-2 text-center text-xs font-semibold text-slate-600">버전</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">수량</th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">
                단가 ({moneySymbol})
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold text-slate-600">
                금액 ({moneySymbol})
              </th>
              <th className="px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const amount = lineAmount(item)
              const unitPrice = isBillingOnlyOrderItem(item) || item.isAdhoc
                ? Math.max(0, Math.round(Number(item.unitPrice) || 0))
                : computeOrderLineAmortizedUnitPrice({
                    quantity: Number(item.quantity) || 0,
                    setupCost: Number(item.setupCost) || 0,
                    smdUnitPrice: Number(item.smdUnitPrice) || 0,
                    dipUnitPrice: Number(item.dipUnitPrice) || 0,
                    materialUnitPrice: Number(item.materialUnitPrice) || 0,
                  })
              const version = productVersionLabel(item, products)
              const versionCandidates = productVersionCandidates(item, products, customer)
              const isAdhoc = Boolean(item.isAdhoc)
              const isCompanion = isCompanionRow(item)
              const canRemove = isCompanion
                ? false
                : isAdhoc || items.filter((row) => !row.isAdhoc).length > 1

              return (
                <tr
                  key={item.rowKey}
                  className={['border-t border-slate-100', isAdhoc ? 'bg-amber-50/40' : ''].join(' ')}
                >
                  <td className="px-2 py-2 align-top">
                    <ProductCombobox
                      value={item.productCode}
                      products={products}
                      customer={customer}
                      field="code"
                      placeholder={isAdhoc ? '코드 검색 (추가작업)' : '코드 검색'}
                      ariaLabel={`${index + 1}행 ${isAdhoc ? '추가작업 ' : ''}제품코드`}
                      inputClassName={inputClassName}
                      onValueChange={(productCode) => {
                        const parentKey = item.rowKey
                        onChange((current) => {
                          let next = current.map((row, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...row,
                                  productCode,
                                  productId: '',
                                  productName: '',
                                  quoteId: '',
                                  ...(isAdhoc
                                    ? {}
                                    : {
                                        unitPrice: '0',
                                        setupCost: '0',
                                        smdUnitPrice: '0',
                                        dipUnitPrice: '0',
                                        materialUnitPrice: '0',
                                        materialCost: '0',
                                      }),
                                }
                              : row,
                          )
                          if (!isAdhoc) next = stripCompanionRows(next, parentKey)
                          return next
                        })
                      }}
                      onProductSelect={(product) => selectProduct(index, product)}
                      onVersionResolved={() => focusQuantity(index)}
                    />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <ProductCombobox
                          value={item.productName}
                          products={products}
                          customer={customer}
                          field="name"
                          placeholder={isAdhoc ? '제품명 (추가작업)' : '제품명'}
                          ariaLabel={`${index + 1}행 ${isAdhoc ? '추가작업 ' : ''}제품명`}
                          inputClassName={inputClassName}
                          onValueChange={(productName) => {
                            const parentKey = item.rowKey
                            onChange((current) => {
                              let next = current.map((row, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...row,
                                      productName,
                                      productId: '',
                                      productCode: '',
                                      quoteId: '',
                                      ...(isAdhoc
                                        ? {}
                                        : {
                                            unitPrice: '0',
                                            setupCost: '0',
                                            smdUnitPrice: '0',
                                            dipUnitPrice: '0',
                                            materialUnitPrice: '0',
                                            materialCost: '0',
                                          }),
                                    }
                                  : row,
                              )
                              if (!isAdhoc) next = stripCompanionRows(next, parentKey)
                              return next
                            })
                          }}
                          onProductSelect={(product) => selectProduct(index, product)}
                          onVersionResolved={() => focusQuantity(index)}
                        />
                      </div>
                      {isCompanion ? (
                        <span className="shrink-0 pt-1.5 text-xs font-medium text-slate-500">
                          (추가 작업)
                        </span>
                      ) : null}
                    </div>
                    {isAdhoc && !isCompanion ? (
                      <span className="mt-1 inline-flex rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        추가 작업
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 align-top text-center">
                    {versionCandidates.length > 1 ? (
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
                    {isCompanion ? (
                      <div
                        className="flex h-[34px] items-center justify-end text-sm font-medium tabular-nums text-slate-800"
                        title="제품 수량과 연동"
                      >
                        {Math.max(0, Math.floor(Number(item.quantity) || 0)).toLocaleString('ko-KR')}
                      </div>
                    ) : (
                      <QuoteNumericInput
                        ref={(el) => {
                          quantityRefs.current[index] = el
                        }}
                        min={0}
                        value={String(item.quantity)}
                        onChange={(quantity) => patchItem(index, { quantity })}
                        className={`${inputClassName} text-right`}
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    {isAdhoc && !isCompanion ? (
                      <QuoteNumericInput
                        min={0}
                        value={String(item.unitPrice)}
                        onChange={(unitPrice) => patchItem(index, { unitPrice })}
                        className={`${inputClassName} text-right`}
                      />
                    ) : (
                      <div
                        className="flex h-[34px] items-center justify-end text-sm font-medium tabular-nums text-slate-800"
                        title={isCompanion ? '품목등록 추가비용' : 'SET-UP÷수량 + SMD + 후공정 + 자재'}
                      >
                        {unitPrice > 0 ? formatOrderMoney(unitPrice, currency) : '—'}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right text-sm font-medium tabular-nums text-slate-800 align-top">
                    <div className="flex h-[34px] items-center justify-end">
                      {formatOrderMoney(amount, currency)}
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
        제품·추가 작업 모두 품목등록에 있는 항목만 저장됩니다. 반제품·조립제품에 추가비용이 등록되어
        있으면 품목 선택 시 아래에 추가작업 행이 자동으로 붙고 제품 수량과 연동됩니다. 발주 목록·인쇄
        수량 합계에는 제품만 집계되며, 추가 작업은 거래명세서 금액 표시용입니다.
      </p>
    </div>
  )
}
