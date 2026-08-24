'use client'

import { type Dispatch, type SetStateAction, useState } from 'react'
import { DeliveryShippableCombobox } from '@/components/delivery/delivery-shippable-combobox'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import type {
  DeliveryRegisterItemForm,
  DeliveryShippableOption,
} from '@/lib/delivery/register-form'
import {
  allocationsForRegisterQuantity,
  applyShippableOptionToItem,
  computeDeliveryLineAmount,
  emptyDeliveryRegisterItemForm,
  findExactShippableOptions,
} from '@/lib/delivery/register-form'
import { fetchAvailableLots, syncFinishedGoodsLots } from '@/lib/production-lots/repository'
import type { LotAllocation } from '@/lib/production-lots/types'
import { formatLotAllocationLabel, sumLotAllocationQuantity } from '@/lib/production-lots/utils'

type DeliveryRegisterItemsFormProps = {
  items: DeliveryRegisterItemForm[]
  options: DeliveryShippableOption[]
  lockedCustomer: string
  disabled?: boolean
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
  onChange,
}: DeliveryRegisterItemsFormProps) {
  const [editingLotKey, setEditingLotKey] = useState<string | null>(null)

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
    if (items.length <= 1) return
    const removed = items[index]
    if (removed && editingLotKey === removed.key) setEditingLotKey(null)
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  async function selectOption(index: number, option: DeliveryShippableOption) {
    onChange((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? applyShippableOptionToItem(item, option) : item,
      ),
    )

    await syncFinishedGoodsLots({ assemblyGroupId: option.assemblyGroupId })
    const result = await fetchAvailableLots(option.assemblyGroupId)
    const lots = result.ok ? result.lots : []

    onChange((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        if (item.assemblyGroupId !== option.assemblyGroupId) return item
        return {
          ...item,
          availableLots: lots,
          allocations: item.lotManual
            ? item.allocations
            : allocationsForRegisterQuantity(lots, Number(item.quantity)),
        }
      }),
    )
  }

  function patchQuantity(index: number, quantity: string) {
    onChange((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        return {
          ...item,
          quantity,
          allocations: item.lotManual
            ? item.allocations
            : allocationsForRegisterQuantity(item.availableLots, Number(quantity)),
        }
      }),
    )
  }

  function patchAllocations(index: number, allocations: LotAllocation[]) {
    patchItem(index, { allocations, lotManual: true })
  }

  const inputClassName =
    'w-full min-w-0 rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100'
  const readOnlyClassName = `${inputClassName} bg-slate-50 text-slate-600`

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">출하 품목</h3>
        {!disabled ? <ErpRowAddButton onClick={addRow} title="행 추가" /> : null}
      </div>

      {lockedCustomer ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          고객사 잠금: <span className="font-semibold">{lockedCustomer}</span> — 같은 고객사만
          추가됩니다.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-300">
        <table className="min-w-[1080px] w-full border-collapse text-sm">
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
                LOT
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
              const qty = Math.floor(Number(item.quantity) || 0)
              const allocated = sumLotAllocationQuantity(item.allocations)
              const lotSummary =
                item.allocations.length > 0
                  ? formatLotAllocationLabel(item.allocations)
                  : qty > 0
                    ? item.availableLots.length
                      ? '잔량 부족 · 출하 시 자동 생성'
                      : '출하 시 자동 배정'
                    : '수량 입력 후 배정'
              const editing = editingLotKey === item.key
              return (
                <tr key={item.key} className="border-t border-slate-200 bg-white">
                  <td className="px-2 py-1.5 align-top">
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
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      value={
                        item.productName
                          ? item.productVersion?.trim()
                            ? `${item.productName} · ${item.productVersion.trim()}`
                            : item.productName
                          : ''
                      }
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
                      max={item.maxQuantity > 0 ? item.maxQuantity : undefined}
                      value={item.quantity}
                      placeholder={
                        item.maxQuantity > 0
                          ? `가능 ${item.maxQuantity.toLocaleString('ko-KR')}`
                          : '수량'
                      }
                      disabled={disabled}
                      onChange={(event) => patchQuantity(index, event.target.value)}
                      className={`${disabled ? readOnlyClassName : inputClassName} min-w-[88px] text-right tabular-nums placeholder:text-slate-400`}
                      aria-label={`${index + 1}행 수량`}
                    />
                  </td>
                  <td className="min-w-[220px] px-2 py-1.5 align-top">
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-xs leading-5 text-slate-700">{lotSummary}</p>
                        {!disabled && item.assemblyGroupId ? (
                          <button
                            type="button"
                            onClick={() =>
                              setEditingLotKey((current) => (current === item.key ? null : item.key))
                            }
                            className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold text-sky-700 hover:bg-sky-50"
                          >
                            {editing ? '닫기' : '수정'}
                          </button>
                        ) : null}
                      </div>
                      {qty > 0 && allocated > 0 && allocated !== qty ? (
                        <p className="text-[11px] text-amber-700">
                          LOT 합계 {allocated.toLocaleString('ko-KR')} ≠ 수량{' '}
                          {qty.toLocaleString('ko-KR')}
                        </p>
                      ) : null}
                      {editing && !disabled ? (
                        <LotEditor
                          item={item}
                          onChange={(allocations) => patchAllocations(index, allocations)}
                        />
                      ) : null}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <QuoteNumericInput
                      min={0}
                      value={String(item.unitPrice)}
                      onChange={(unitPrice) => patchItem(index, { unitPrice })}
                      readOnly={disabled}
                      className={`${disabled ? readOnlyClassName : inputClassName} min-w-[88px] text-right tabular-nums`}
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
                    {!disabled && items.length > 1 ? (
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
    </div>
  )
}

function LotEditor({
  item,
  onChange,
}: {
  item: DeliveryRegisterItemForm
  onChange: (allocations: LotAllocation[]) => void
}) {
  const usedLotIds = new Set(item.allocations.map((line) => line.lotId))
  const unusedLots = item.availableLots.filter((lot) => !usedLotIds.has(lot.id) && lot.remaining > 0)

  function patchLine(index: number, patch: Partial<LotAllocation>) {
    onChange(
      item.allocations.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    )
  }

  function addLine() {
    const nextLot = unusedLots[0]
    if (!nextLot) return
    onChange([
      ...item.allocations,
      {
        lotId: nextLot.id,
        lotDate: nextLot.lotDate,
        quantity: nextLot.remaining,
        remaining: nextLot.remaining,
      },
    ])
  }

  return (
    <div className="space-y-1.5 rounded border border-slate-200 bg-slate-50 p-2">
      {item.allocations.length ? (
        item.allocations.map((line, lineIndex) => {
          const lot = item.availableLots.find((itemLot) => itemLot.id === line.lotId)
          return (
            <div key={`${line.lotId}-${lineIndex}`} className="flex items-center gap-1.5">
              <select
                value={line.lotId}
                onChange={(event) => {
                  const selected = item.availableLots.find((itemLot) => itemLot.id === event.target.value)
                  if (!selected) return
                  patchLine(lineIndex, {
                    lotId: selected.id,
                    lotDate: selected.lotDate,
                    remaining: selected.remaining,
                    quantity: Math.min(line.quantity || selected.remaining, selected.remaining),
                  })
                }}
                className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs"
              >
                {item.availableLots
                  .filter((itemLot) => itemLot.id === line.lotId || !usedLotIds.has(itemLot.id))
                  .map((itemLot) => (
                    <option key={itemLot.id} value={itemLot.id}>
                      {itemLot.id} · 잔 {itemLot.remaining.toLocaleString('ko-KR')}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                min={0}
                max={lot?.remaining ?? undefined}
                value={line.quantity || ''}
                onChange={(event) =>
                  patchLine(lineIndex, {
                    quantity: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                  })
                }
                className="w-[72px] rounded border border-slate-200 bg-white px-1.5 py-1 text-right text-xs tabular-nums"
              />
              <button
                type="button"
                onClick={() => onChange(item.allocations.filter((_, index) => index !== lineIndex))}
                className="rounded px-1 text-xs text-slate-400 hover:text-slate-700"
                aria-label="LOT 행 삭제"
              >
                ×
              </button>
            </div>
          )
        })
      ) : (
        <p className="text-[11px] text-slate-500">배정된 LOT이 없습니다. FIFO로 채우거나 추가하세요.</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {unusedLots.length ? (
          <button
            type="button"
            onClick={addLine}
            className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-white"
          >
            + LOT
          </button>
        ) : null}
        {item.availableLots.length ? (
          <button
            type="button"
            onClick={() =>
              onChange(allocationsForRegisterQuantity(item.availableLots, Number(item.quantity)))
            }
            className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-white"
          >
            FIFO 다시 채우기
          </button>
        ) : null}
      </div>
    </div>
  )
}
