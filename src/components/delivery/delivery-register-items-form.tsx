'use client'

import { type Dispatch, type SetStateAction } from 'react'
import { DeliveryShippableCombobox } from '@/components/delivery/delivery-shippable-combobox'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import type {
  DeliveryRegisterItemForm,
  DeliveryShippableOption,
} from '@/lib/delivery/register-form'
import {
  applyShippableOptionToItem,
  computeDeliveryLineAmount,
  emptyDeliveryRegisterItemForm,
  findExactShippableOptions,
  isBillingRegisterItem,
} from '@/lib/delivery/register-form'
import { syncFinishedGoodsLots } from '@/lib/production-lots/repository'

type DeliveryRegisterItemsFormProps = {
  items: DeliveryRegisterItemForm[]
  options: DeliveryShippableOption[]
  lockedCustomer: string
  disabled?: boolean
  /** fixed: 왼쪽 출하가능 체크로 품목 선택 (코드 검색 숨김) */
  productSelectMode?: 'combobox' | 'fixed'
  onChange: Dispatch<SetStateAction<DeliveryRegisterItemForm[]>>
}

function clearItemProduct(item: DeliveryRegisterItemForm): DeliveryRegisterItemForm {
  return {
    ...item,
    uiKey: '',
    assemblyGroupId: '',
    orderNumber: '',
    customerPoNumber: '',
    customer: '',
    productCode: item.productCode,
    productName: '',
    productVersion: null,
    maxQuantity: 0,
    availableLots: [],
    allocations: [],
    lotManual: false,
  }
}

export function DeliveryRegisterItemsForm({
  items,
  options,
  lockedCustomer,
  disabled = false,
  productSelectMode = 'combobox',
  onChange,
}: DeliveryRegisterItemsFormProps) {
  const fixedProducts = productSelectMode === 'fixed'

  function optionsForRow(index: number) {
    const currentId = items[index]?.assemblyGroupId.trim()
    return options.filter((option) => {
      if (lockedCustomer && option.customer !== lockedCustomer) return false
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
    onChange([...items, emptyDeliveryRegisterItemForm()])
  }

  function removeRow(index: number) {
    if (isBillingRegisterItem(items[index]!)) return
    if (!fixedProducts && items.filter((item) => !isBillingRegisterItem(item)).length <= 1) return
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  async function selectOption(index: number, option: DeliveryShippableOption) {
    onChange((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? applyShippableOptionToItem(item, option) : item,
      ),
    )
    // LOT은 화면에서 다루지 않고, 출하 시 FIFO 자동 배정
    await syncFinishedGoodsLots({ assemblyGroupId: option.assemblyGroupId })
  }

  function patchQuantity(index: number, quantity: string) {
    patchItem(index, { quantity, allocations: [], lotManual: false })
  }

  const inputClassName =
    'w-full min-w-0 rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
  const readOnlyClassName = `${inputClassName} bg-slate-50 text-slate-600`

  if (fixedProducts && !items.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        왼쪽에서 출하할 품목을 체크하세요.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">출하 품목</h3>
        {!disabled && !fixedProducts ? <ErpRowAddButton onClick={addRow} title="행 추가" /> : null}
      </div>

      {lockedCustomer && !fixedProducts ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          고객사 잠금: <span className="font-semibold">{lockedCustomer}</span> — 같은 고객사만
          추가됩니다.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-300">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-slate-100">
            <tr>
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
            {items.map((item, index) => {
              const amount = computeDeliveryLineAmount(
                Number(item.quantity),
                Number(item.unitPrice),
              )
              const rowOptions = optionsForRow(index)
              const billing = isBillingRegisterItem(item)
              const rowLocked = disabled || billing
              const nameLabel = item.productName
                ? item.productVersion?.trim()
                  ? `${item.productName} · ${item.productVersion.trim()}`
                  : item.productName
                : ''
              return (
                <tr
                  key={item.key}
                  className={`border-t border-slate-200 ${billing ? 'bg-amber-50/70' : 'bg-white'}`}
                >
                  <td className="px-2 py-1.5 align-top">
                    {fixedProducts || billing ? (
                      <div className="space-y-1">
                        {billing ? (
                          <span className="inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                            추가작업
                          </span>
                        ) : null}
                        <input
                          value={item.productCode}
                          readOnly
                          className={`${readOnlyClassName} min-w-[100px] font-mono`}
                          aria-label={`${index + 1}행 품목코드`}
                        />
                      </div>
                    ) : (
                      <DeliveryShippableCombobox
                        value={item.productCode}
                        options={rowOptions}
                        placeholder="코드 검색"
                        ariaLabel={`${index + 1}행 품목코드`}
                        disabled={disabled}
                        inputClassName={`${disabled ? readOnlyClassName : inputClassName} min-w-[120px]`}
                        onValueChange={(productCode) => {
                          const exact = findExactShippableOptions(rowOptions, productCode)
                          if (exact.length === 1) {
                            void selectOption(index, exact[0]!)
                            return
                          }
                          patchItem(index, { ...clearItemProduct(item), productCode })
                        }}
                        onOptionSelect={(option) => void selectOption(index, option)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      value={nameLabel}
                      readOnly
                      className={readOnlyClassName}
                      placeholder="자동"
                      aria-label={`${index + 1}행 품목명`}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="number"
                      min={0}
                      max={!billing && item.maxQuantity > 0 ? item.maxQuantity : undefined}
                      value={item.quantity}
                      placeholder={
                        !billing && item.maxQuantity > 0
                          ? `가능 ${item.maxQuantity.toLocaleString('ko-KR')}`
                          : '수량'
                      }
                      disabled={rowLocked}
                      onChange={(event) => patchQuantity(index, event.target.value)}
                      className={`${rowLocked ? readOnlyClassName : inputClassName} min-w-[88px] text-right tabular-nums placeholder:text-slate-400`}
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
                    {!disabled &&
                    !billing &&
                    (fixedProducts ||
                      items.filter((row) => !isBillingRegisterItem(row)).length > 1) ? (
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
        단가는 발주서 기준이며 여기서는 수정할 수 없습니다.
      </p>
    </div>
  )
}
