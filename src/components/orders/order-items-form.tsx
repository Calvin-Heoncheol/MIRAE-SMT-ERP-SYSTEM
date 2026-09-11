'use client'

import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef } from 'react'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { ProductCombobox } from '@/components/orders/product-combobox'
import { parseItemVersionCode } from '@/lib/items/version-code'
import {
  sumMaterialCostLines,
} from '@/lib/items/material-cost-lines'
import {
  defaultOrderItemForm,
  type OrderItemForm,
} from '@/lib/orders/form-state'
import { resolveOrderProcessType, scopeOrderLinePrices } from '@/lib/orders/process-scope'
import { computeLineAmount, computeOrderLineAmortizedUnitPrice, computeOrderLineMaterialCost, formatAdditionalWorkProductNameLabel, formatOrderMoney, isBillingOnlyOrderItem, orderCurrencySymbol, orderLinePerUnitPrice, resolveOrderLineSmdUnitPrice } from '@/lib/orders/utils'
import type { OrderCurrency } from '@/lib/orders/types'
import type { Product } from '@/lib/products/types'
import { findProductsByCode, findProductsByName, filterProductsForCustomerStrict } from '@/lib/products/utils'
import { ERP_ROW_ADD_BUTTON_CLASS } from '@/lib/ui/tokens'

type OrderItemsFormProps = {
  items: OrderItemForm[]
  customer: string
  products: Product[]
  currency?: OrderCurrency
  onChange: Dispatch<SetStateAction<OrderItemForm[]>>
  onCustomerResolved?: (customer: string) => void
}

function isCompanionRow(row: OrderItemForm) {
  return Boolean(row.isAdhoc && row.companionOfRowKey?.trim())
}

function stripCompanionRows(items: OrderItemForm[], parentRowKey: string) {
  return items.filter((row) => !(row.isAdhoc && row.companionOfRowKey === parentRowKey))
}

function resolveProductMaterialUnitPrice(product: Product) {
  const direct = Math.max(0, Math.round(Number(product.materialUnitPrice) || 0))
  if (direct > 0) return direct
  return sumMaterialCostLines(product.materialCostLines)
}

function applyProductSelection(items: OrderItemForm[], index: number, product: Product, isAmbiguous: boolean) {
  const parent = items[index]
  if (!parent) return items

  let next = stripCompanionRows(items, parent.rowKey)
  const parentIndex = next.findIndex((row) => row.rowKey === parent.rowKey)
  if (parentIndex < 0) return next

  return next.map((item, itemIndex) => {
    if (itemIndex !== parentIndex) return item
    const applied = applyProductToItem(item, product)
    if (isAmbiguous) {
      return { ...applied, productId: '' }
    }
    return applied
  })
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
  const legacyUnit = Math.max(0, Math.round(Number(product.defaultUnitPrice) || 0))
  const resolvedSmd = resolveOrderLineSmdUnitPrice(smd, dip, legacyUnit)
  const setupCost = Math.max(0, Math.round(Number(product.setupUnitPrice) || 0))
  const materialUnitPrice = resolveProductMaterialUnitPrice(product)
  /** UI 공정 선택 없음 — 품목 공정(없으면 SMD+후공정) 기준으로 표준단가 적용 */
  const processType = resolveOrderProcessType({
    productProcessType: product.processType,
    setupCost,
    smdUnitPrice: resolvedSmd,
    dipUnitPrice: dip,
  })
  const scoped = scopeOrderLinePrices({
    processType,
    setupCost,
    smdUnitPrice: resolvedSmd,
    dipUnitPrice: dip,
    materialUnitPrice,
  })
  const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
  const perUnit = orderLinePerUnitPrice(scoped.smdUnitPrice, scoped.dipUnitPrice)
  const unitPrice =
    computeOrderLineAmortizedUnitPrice({
      quantity,
      setupCost: scoped.setupCost,
      smdUnitPrice: scoped.smdUnitPrice,
      dipUnitPrice: scoped.dipUnitPrice,
      materialUnitPrice: scoped.materialUnitPrice,
    }) || perUnit + scoped.materialUnitPrice
  const materialCost = computeOrderLineMaterialCost(quantity, scoped.materialUnitPrice)
  return {
    ...item,
    productId: product.id,
    productCode: product.productCode,
    productName: product.productName,
    processType,
    setupCost: String(scoped.setupCost),
    smdUnitPrice: String(scoped.smdUnitPrice),
    dipUnitPrice: String(scoped.dipUnitPrice),
    materialUnitPrice: String(scoped.materialUnitPrice),
    materialCost: String(materialCost),
    unitPrice: String(unitPrice),
    quoteId: '',
    isAdhoc: false,
  }
}

function lineAmount(item: OrderItemForm) {
  const quantity = Number(item.quantity) || 0
  return computeLineAmount(quantity, Number(item.unitPrice) || 0)
}

function syncLinePricing(
  item: OrderItemForm,
  patch: Partial<OrderItemForm>,
): Partial<OrderItemForm> {
  const merged = { ...item, ...patch }
  const quantity = Math.max(0, Math.floor(Number(merged.quantity) || 0))
  const materialUnitPrice = Math.max(0, Math.round(Number(merged.materialUnitPrice) || 0))
  const materialCost = computeOrderLineMaterialCost(quantity, materialUnitPrice)

  /** 단가 수동 수정 — breakdown 재계산으로 덮지 않음 */
  const patchKeys = Object.keys(patch)
  if (patchKeys.length === 1 && patch.unitPrice != null) {
    return {
      ...patch,
      materialCost: String(materialCost),
    }
  }

  const unitPrice = computeOrderLineAmortizedUnitPrice({
    quantity,
    setupCost: Number(merged.setupCost) || 0,
    smdUnitPrice: Number(merged.smdUnitPrice) || 0,
    dipUnitPrice: Number(merged.dipUnitPrice) || 0,
    materialUnitPrice,
  })
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
  onCustomerResolved,
}: OrderItemsFormProps) {
  const moneySymbol = orderCurrencySymbol(currency)
  const quantityRefs = useRef<(HTMLInputElement | null)[]>([])
  const lockedCustomer = customer.trim()
  const searchableProducts = useMemo(() => {
    if (lockedCustomer) return filterProductsForCustomerStrict(products, lockedCustomer)
    return products.filter((product) => product.isActive)
  }, [products, lockedCustomer])

  function notifyCustomerFromProduct(product: Product) {
    const name = product.customer.trim()
    if (name) onCustomerResolved?.(name)
  }

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
        next = next.map((row) =>
          row.isAdhoc && row.companionOfRowKey === item.rowKey
            ? { ...row, quantity: patch.quantity! }
            : row,
        )
      }
      return next
    })
  }

  function addRow() {
    onChange((current) => [...current, defaultOrderItemForm()])
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
    const sameCode = searchableProducts.filter(
      (p) => p.productCode === product.productCode && (!product.productName || p.productName === product.productName),
    )
    const isAmbiguous = sameCode.length > 1
    notifyCustomerFromProduct(product)
    onChange((current) => applyProductSelection(current, index, product, isAmbiguous))
  }

  function confirmVersion(index: number, product: Product) {
    notifyCustomerFromProduct(product)
    onChange((current) => applyProductSelection(current, index, product, false))
  }

  const inputClassName =
    'w-full min-w-0 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100'

  const columnCount = 8

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-900">제품</h3>
      <p className="text-xs text-slate-500">
        작업번호는 직접 입력합니다. 제품 선택 시 품목 표준단가(SET-UP·SMD·후공정·자재)가 자동으로 들어가며, 단가는
        직접 수정할 수 있습니다. 수량 변경 시 SET-UP 배분 단가가 다시 계산됩니다.
      </p>

      <div className="max-h-[min(28rem,50dvh)] overflow-auto rounded-lg border border-slate-200">
        <table className="erp-data-table erp-data-table--compact min-w-[880px] w-full border-collapse text-sm">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[24%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-8" />
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-2 py-2 text-left text-xs font-semibold text-slate-600">작업번호</th>
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
              <th className="w-8 px-0 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const amount = lineAmount(item)
              const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) || 0))
              const version = productVersionLabel(item, products)
              const versionCandidates = productVersionCandidates(item, searchableProducts, lockedCustomer)
              const isAdhoc = Boolean(item.isAdhoc)
              const isCompanion = isCompanionRow(item)
              const companionParent = isCompanion
                ? items.find((row) => row.rowKey === item.companionOfRowKey)
                : null
              const companionNameLabel =
                companionParent &&
                item.productName.trim() &&
                item.productName.trim() === companionParent.productName.trim()
                  ? formatAdditionalWorkProductNameLabel(item.productName)
                  : item.productName
              const canRemove = isCompanion
                ? false
                : isAdhoc || items.filter((row) => !row.isAdhoc).length > 1

              return (
                <tr
                  key={item.rowKey}
                  className={['border-t border-slate-100', isAdhoc ? 'bg-amber-50/40' : ''].join(' ')}
                >
                  <td className="px-2 py-2 align-top">
                    {isAdhoc ? (
                      <span className="text-xs text-slate-300">—</span>
                    ) : (
                      <input
                        value={item.workNumber || ''}
                        onChange={(event) => patchItem(index, { workNumber: event.target.value })}
                        placeholder="직접 입력"
                        className={`${inputClassName} font-mono text-xs font-semibold text-slate-700`}
                        aria-label={`${index + 1}행 작업번호`}
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    {isCompanion ? (
                      <input
                        value={item.productCode}
                        readOnly
                        className={`${inputClassName} bg-slate-50 font-mono text-slate-700`}
                        aria-label={`${index + 1}행 추가작업 제품코드`}
                      />
                    ) : (
                    <ProductCombobox
                      value={item.productCode}
                      products={searchableProducts}
                      customer={lockedCustomer}
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
                                        processType: 'smt_post' as const,
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
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    {isCompanion ? (
                      <input
                        value={companionNameLabel}
                        readOnly
                        className={`${inputClassName} bg-slate-50 text-slate-700`}
                        aria-label={`${index + 1}행 동반 품목명`}
                      />
                    ) : (
                    <ProductCombobox
                      value={item.productName}
                      products={searchableProducts}
                      customer={lockedCustomer}
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
                                        processType: 'smt_post' as const,
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
                    )}
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
                    {isCompanion ? (
                      <div
                        className="flex h-[34px] items-center justify-end text-sm font-medium tabular-nums text-slate-800"
                        title="추가 비용"
                      >
                        {unitPrice > 0 ? formatOrderMoney(unitPrice, currency) : '—'}
                      </div>
                    ) : (
                      <QuoteNumericInput
                        min={0}
                        value={String(item.unitPrice)}
                        onChange={(unitPrice) => patchItem(index, { unitPrice })}
                        className={`${inputClassName} text-right`}
                        aria-label={`${index + 1}행 단가`}
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 text-right text-sm font-medium tabular-nums text-slate-800 align-top">
                    <div className="flex h-[34px] items-center justify-end">
                      {formatOrderMoney(amount, currency)}
                    </div>
                  </td>
                  <td className="w-8 px-0 py-2 text-center align-top">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={!canRemove}
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
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
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        품목등록에 있는 제품만 저장됩니다. 추가작업·자재 청구 행은 출하 등록(거래명세서)에서
        입력합니다.
      </p>
    </div>
  )
}
