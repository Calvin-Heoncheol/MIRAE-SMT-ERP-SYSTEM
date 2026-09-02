'use client'

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { ProductCombobox } from '@/components/orders/product-combobox'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import type {
  DeliveryRegisterItemForm,
  DeliveryShippableOption,
} from '@/lib/delivery/register-form'
import {
  applyProductToRegisterItem,
  applyShippableOptionToItem,
  allocationsForRegisterQuantity,
  availableBillingLinesForRegister,
  computeDeliveryLineAmount,
  DELIVERY_REGISTER_MIN_ROWS,
  emptyDeliveryRegisterItemForm,
  findShippableOptionsForRegisterItem,
  insertBillingRegisterItem,
  isBillingRegisterItem,
  isDeliveryRegisterQuantityEnabled,
} from '@/lib/delivery/register-form'
import type { DeliveryBillingOnlyLine } from '@/lib/delivery/utils'
import { DELIVERY_REGISTER_SKIP_PRODUCTION_CAP } from '@/lib/delivery/config'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import { fetchAvailableLots, syncFinishedGoodsLots } from '@/lib/production-lots/repository'
import type { Product } from '@/lib/products/types'
import { filterProductsForCustomerStrict } from '@/lib/products/utils'

type DeliveryRegisterItemsFormProps = {
  items: DeliveryRegisterItemForm[]
  options: DeliveryShippableOption[]
  products: Product[]
  customer: string
  billingOnlyLines?: DeliveryBillingOnlyLine[]
  disabled?: boolean
  onChange: Dispatch<SetStateAction<DeliveryRegisterItemForm[]>>
}

function formatBillingOptionLabel(line: DeliveryBillingOnlyLine) {
  const code = line.productCode.trim() || 'TEMP'
  const amount = Math.round(Number(line.unitPrice) || 0).toLocaleString('ko-KR')
  return `${code} · ${line.productName} · 단가 ${amount}`
}

export function DeliveryRegisterItemsForm({
  items,
  options,
  products,
  customer,
  billingOnlyLines = [],
  disabled = false,
  onChange,
}: DeliveryRegisterItemsFormProps) {
  const [billingPickerOpen, setBillingPickerOpen] = useState(false)
  const customerName = customer.trim()

  const customerProducts = useMemo(
    () => filterProductsForCustomerStrict(products, customerName),
    [customerName, products],
  )

  const availableBilling = useMemo(
    () => availableBillingLinesForRegister(items, billingOnlyLines),
    [items, billingOnlyLines],
  )

  function optionsForRow(index: number) {
    const currentId = items[index]?.assemblyGroupId.trim()
    return options.filter((option) => {
      if (customerName && option.customer !== customerName) return false
      const usedElsewhere = items.some(
        (item, itemIndex) =>
          itemIndex !== index && item.assemblyGroupId === option.assemblyGroupId,
      )
      if (usedElsewhere) return false
      if (currentId && option.assemblyGroupId === currentId) return true
      return true
    })
  }

  function patchItem(index: number, patch: Partial<DeliveryRegisterItemForm>) {
    onChange((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  function addRow() {
    onChange([...items, { ...emptyDeliveryRegisterItemForm(), customer: customerName }])
  }

  function removeRow(index: number) {
    const target = items[index]
    if (!target) return
    if (!isBillingRegisterItem(target)) {
      const productRows = items.filter((item) => !isBillingRegisterItem(item))
      if (productRows.length <= DELIVERY_REGISTER_MIN_ROWS) return
    }
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  function addBillingLine(line: DeliveryBillingOnlyLine) {
    onChange((current) => insertBillingRegisterItem(current, line))
    setBillingPickerOpen(false)
  }

  function handleAddBillingClick() {
    if (!availableBilling.length) return
    if (availableBilling.length === 1) {
      addBillingLine(availableBilling[0]!)
      return
    }
    setBillingPickerOpen((open) => !open)
  }

  async function attachLots(index: number, item: DeliveryRegisterItemForm) {
    if (isBillingRegisterItem(item) || !item.assemblyGroupId.trim()) return
    await syncFinishedGoodsLots({ assemblyGroupId: item.assemblyGroupId })
    const result = await fetchAvailableLots(item.assemblyGroupId)
    const lots = result.ok ? result.lots : []
    const quantity = Math.floor(Number(item.quantity) || 0)
    onChange((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              availableLots: lots,
              allocations: row.lotManual
                ? row.allocations
                : allocationsForRegisterQuantity(lots, quantity),
            }
          : row,
      ),
    )
  }

  async function selectOrderOption(index: number, assemblyGroupId: string) {
    const option = optionsForRow(index).find((row) => row.assemblyGroupId === assemblyGroupId)
    if (!option) return
    const nextItem = applyShippableOptionToItem(
      items[index] ?? emptyDeliveryRegisterItemForm(),
      option,
      { autoFillQuantity: false },
    )
    onChange((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? nextItem : item)),
    )
    await attachLots(index, nextItem)
  }

  async function selectProduct(index: number, product: Product) {
    const nextItem = applyProductToRegisterItem(
      items[index] ?? emptyDeliveryRegisterItemForm(),
      product,
      optionsForRow(index),
      customerName,
      false,
    )
    onChange((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? nextItem : item)),
    )
    await attachLots(index, nextItem)
  }

  function patchQuantity(index: number, quantity: string) {
    patchItem(index, { quantity, allocations: [], lotManual: false })
  }

  const inputClassName =
    'w-full min-w-0 rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
  const readOnlyClassName = `${inputClassName} bg-slate-50 text-slate-600`
  const tableItems = customerName
    ? items
    : Array.from({ length: DELIVERY_REGISTER_MIN_ROWS }, () => emptyDeliveryRegisterItemForm())
  const tableDisabled = disabled || !customerName

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">출하 품목</h3>
        <div className="flex flex-wrap items-center gap-2">
          {!disabled && availableBilling.length > 0 ? (
            <button
              type="button"
              onClick={handleAddBillingClick}
              className="rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
              title="발주서 추가작업 행 추가"
            >
              + 추가작업
            </button>
          ) : null}
          {!tableDisabled ? <ErpRowAddButton onClick={addRow} title="행 추가" /> : null}
        </div>
      </div>

      {billingPickerOpen && availableBilling.length > 1 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="mb-2 text-xs font-semibold text-amber-900">추가할 작업을 선택하세요</p>
          <div className="flex flex-col gap-1.5">
            {availableBilling.map((line) => (
              <button
                key={line.orderLineId}
                type="button"
                onClick={() => addBillingLine(line)}
                className="rounded-md border border-amber-200 bg-white px-3 py-2 text-left text-sm text-slate-800 hover:border-amber-400 hover:bg-amber-50"
              >
                <span className="font-medium">{formatBillingOptionLabel(line)}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{line.orderNumber}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-300">
        <table className="erp-data-table erp-data-table--compact w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                발주번호
              </th>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                품목코드
              </th>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                품목명
              </th>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                수량
              </th>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                단가
              </th>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                공급가액
              </th>
              <th className="w-10 border-b border-slate-300 px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {tableItems.map((item, index) => {
              const amount = computeDeliveryLineAmount(
                Number(item.quantity),
                Number(item.unitPrice),
              )
              const billing = isBillingRegisterItem(item)
              const rowOptions = billing
                ? []
                : findShippableOptionsForRegisterItem(optionsForRow(index), customerName, item)
              const hasProduct = Boolean(item.productCode.trim() || item.productName.trim())
              const quantityEnabled =
                !tableDisabled && !disabled && isDeliveryRegisterQuantityEnabled(item)
              return (
                <tr
                  key={item.key}
                  className={`border-t border-slate-200 ${billing ? 'bg-amber-50/70' : 'bg-white'}`}
                >
                  <td className="px-2 py-1.5 align-top">
                    {billing ? (
                      <input
                        value={displayOrderPoNumber(item.customerPoNumber, item.orderNumber)}
                        readOnly
                        className={`${readOnlyClassName} min-w-[100px] text-xs`}
                        aria-label={`${index + 1}행 발주번호`}
                      />
                    ) : !hasProduct ? (
                      <span className="block px-1 py-1.5 text-xs text-slate-400">—</span>
                    ) : rowOptions.length === 0 ? (
                      <span className="block rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-700">
                        발주서 없음
                      </span>
                    ) : rowOptions.length === 1 ? (
                      <input
                        value={displayOrderPoNumber(
                          rowOptions[0]!.customerPoNumber,
                          rowOptions[0]!.orderNumber,
                        )}
                        readOnly
                        className={`${readOnlyClassName} min-w-[100px] text-xs`}
                        aria-label={`${index + 1}행 발주번호`}
                      />
                    ) : (
                      <select
                        value={item.assemblyGroupId}
                        disabled={tableDisabled}
                        onChange={(event) => void selectOrderOption(index, event.target.value)}
                        className={`${tableDisabled ? readOnlyClassName : inputClassName} min-w-[120px] text-xs`}
                        aria-label={`${index + 1}행 발주번호 선택`}
                      >
                        <option value="">발주 선택</option>
                        {rowOptions.map((option) => (
                          <option key={option.assemblyGroupId} value={option.assemblyGroupId}>
                            {displayOrderPoNumber(option.customerPoNumber, option.orderNumber)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    {billing ? (
                      <div className="space-y-1">
                        <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                          추가작업
                        </span>
                        <input
                          value={item.productCode}
                          readOnly
                          className={`${readOnlyClassName} min-w-[100px] font-mono`}
                          aria-label={`${index + 1}행 품목코드`}
                        />
                      </div>
                    ) : (
                      <ProductCombobox
                        value={item.productCode}
                        products={customerProducts}
                        customer={customerName}
                        field="code"
                        placeholder="코드 검색"
                        ariaLabel={`${index + 1}행 품목코드`}
                        inputClassName={`${tableDisabled ? readOnlyClassName : inputClassName} min-w-[120px] font-mono`}
                        onValueChange={(productCode) =>
                          patchItem(index, {
                            productCode,
                            productName: '',
                            productVersion: null,
                            assemblyGroupId: '',
                            uiKey: '',
                            orderNumber: '',
                            customerPoNumber: '',
                            maxQuantity: 0,
                            unitPrice: '0',
                            quantity: '',
                            availableLots: [],
                            allocations: [],
                            lotManual: false,
                            customer: customerName,
                          })
                        }
                        onProductSelect={(product) => void selectProduct(index, product)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    {billing ? (
                      <input
                        value={item.productName}
                        readOnly
                        className={readOnlyClassName}
                        aria-label={`${index + 1}행 품목명`}
                      />
                    ) : (
                      <ProductCombobox
                        value={item.productName}
                        products={customerProducts}
                        customer={customerName}
                        field="name"
                        placeholder="품목명 검색"
                        ariaLabel={`${index + 1}행 품목명`}
                        inputClassName={`${tableDisabled ? readOnlyClassName : inputClassName} min-w-[140px]`}
                        onValueChange={(productName) =>
                          patchItem(index, {
                            productName,
                            productCode: '',
                            productVersion: null,
                            assemblyGroupId: '',
                            uiKey: '',
                            orderNumber: '',
                            customerPoNumber: '',
                            maxQuantity: 0,
                            unitPrice: '0',
                            quantity: '',
                            availableLots: [],
                            allocations: [],
                            lotManual: false,
                            customer: customerName,
                          })
                        }
                        onProductSelect={(product) => void selectProduct(index, product)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="number"
                      min={0}
                      max={!billing && item.maxQuantity > 0 ? item.maxQuantity : undefined}
                      value={item.quantity}
                      placeholder={
                        !billing && item.maxQuantity > 0
                          ? `${DELIVERY_REGISTER_SKIP_PRODUCTION_CAP ? '잔량' : '가능'} ${item.maxQuantity.toLocaleString('ko-KR')}`
                          : '수량'
                      }
                      disabled={!quantityEnabled}
                      onChange={(event) => patchQuantity(index, event.target.value)}
                      className={`${disabled ? readOnlyClassName : inputClassName} min-w-[88px] text-right tabular-nums placeholder:text-slate-400`}
                      aria-label={`${index + 1}행 수량`}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <QuoteNumericInput
                      min={0}
                      value={String(item.unitPrice)}
                      onChange={() => {}}
                      readOnly
                      className={`${readOnlyClassName} min-w-[88px] text-right tabular-nums`}
                      aria-label={`${index + 1}행 단가`}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      value={amount.toLocaleString('ko-KR')}
                      readOnly
                      className={`${readOnlyClassName} text-right tabular-nums`}
                      aria-label={`${index + 1}행 공급가액`}
                    />
                  </td>
                  <td className="px-1 py-1.5 text-center align-top">
                    {!tableDisabled &&
                    (billing || tableItems.filter((row) => !isBillingRegisterItem(row)).length > DELIVERY_REGISTER_MIN_ROWS) ? (
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`${index + 1}행 삭제`}
                      >
                        ×
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        품목코드 또는 품목명을 입력하면 선택한 고객사의 품목만 검색됩니다. 생산현황에서 진행 중인 발주에
        등록된 품목만 출하할 수 있으며, 같은 품목이 여러 발주에 있으면 발주번호를 선택해야 합니다. 선택 시
        품목등록 기준 단가가 자동 입력됩니다.
      </p>
    </div>
  )
}
