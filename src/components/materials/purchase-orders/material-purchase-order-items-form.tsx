'use client'

import { type Dispatch, type SetStateAction } from 'react'
import { MaterialCombobox } from '@/components/materials/purchase-orders/material-combobox'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import type { MaterialPurchaseOrderItemForm } from '@/lib/materials/purchase-orders/form-state'
import type { MaterialPurchaseOrderCurrency } from '@/lib/materials/purchase-orders/types'
import {
  computeMaterialPurchaseOrderLineAmount,
  formatMaterialPurchaseOrderAmountNumber,
  materialPurchaseOrderCurrencySymbol,
} from '@/lib/materials/purchase-orders/utils'
import type { Material } from '@/lib/materials/types'

type MaterialPurchaseOrderItemsFormProps = {
  items: MaterialPurchaseOrderItemForm[]
  supplier: string
  currency?: MaterialPurchaseOrderCurrency
  materials: Material[]
  /** 신규 행·빈 납기에 채울 기본 납기 (YYYY-MM-DD) */
  defaultDeliveryDate?: string
  /** 발주서/제안에서 시드된 신규 구매발주 — 자재코드·수량·단가 잠금 */
  lockSeededFields?: boolean
  onChange: Dispatch<SetStateAction<MaterialPurchaseOrderItemForm[]>>
  onSupplierSuggest?: (supplier: string) => void
}

function clearMaterialFields(item: MaterialPurchaseOrderItemForm): MaterialPurchaseOrderItemForm {
  return {
    ...item,
    materialId: '',
    mpn: '',
    materialName: '',
    processType: '',
    package: '',
    specification: '',
  }
}

function clearMaterialFieldsKeepName(item: MaterialPurchaseOrderItemForm): MaterialPurchaseOrderItemForm {
  return {
    ...item,
    materialId: '',
    materialCode: '',
    mpn: '',
    processType: '',
    package: '',
    specification: '',
  }
}

function applyMaterialToItem(
  item: MaterialPurchaseOrderItemForm,
  material: Material,
): MaterialPurchaseOrderItemForm {
  const next: MaterialPurchaseOrderItemForm = {
    ...item,
    materialId: material.id,
    materialCode: material.id,
    materialName: material.materialName,
    processType: material.type || '',
    package: material.package || '',
    specification: material.specification,
    mpn: material.mpn,
  }

  const currentPrice = Number(item.unitPrice) || 0
  if (material.unitPrice > 0 && currentPrice <= 0) {
    next.unitPrice = String(material.unitPrice)
  }

  return next
}

export function MaterialPurchaseOrderItemsForm({
  items,
  supplier,
  currency = 'KRW',
  materials,
  defaultDeliveryDate = '',
  lockSeededFields = false,
  onChange,
  onSupplierSuggest,
}: MaterialPurchaseOrderItemsFormProps) {
  const moneySymbol = materialPurchaseOrderCurrencySymbol(currency)
  function patchItem(index: number, patch: Partial<MaterialPurchaseOrderItemForm>) {
    onChange((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  function addRow() {
    onChange([
      ...items,
      {
        materialId: '',
        materialCode: '',
        materialName: '',
        processType: '',
        package: '',
        specification: '',
        mpn: '',
        quantity: '0',
        unitPrice: '0',
        deliveryDate: defaultDeliveryDate,
      },
    ])
  }

  function removeRow(index: number) {
    if (items.length <= 1) return
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  function selectMaterial(index: number, material: Material) {
    onChange((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? applyMaterialToItem(item, material) : item,
      ),
    )
    if (material.supplier.trim() && onSupplierSuggest) {
      onSupplierSuggest(material.supplier.trim())
    }
  }

  function handleMaterialCodeChange(index: number, materialCode: string) {
    onChange((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        return { ...clearMaterialFields(item), materialCode }
      }),
    )
  }

  function handleMaterialNameChange(index: number, materialName: string) {
    onChange((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        return { ...clearMaterialFieldsKeepName(item), materialName }
      }),
    )
  }

  const inputClassName =
    'w-full min-w-0 rounded border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100'

  const readOnlyClassName = `${inputClassName} bg-slate-50 text-slate-600`

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">구매발주 품목</h3>
        {!lockSeededFields ? <ErpRowAddButton onClick={addRow} title="행 추가" /> : null}
      </div>

      <div className="max-h-[min(28rem,50dvh)] overflow-auto rounded-lg border border-slate-300">
        <table className="erp-data-table erp-data-table--compact min-w-[1180px] w-full border-collapse text-sm">
          <thead className="sticky top-0 z-[1] bg-slate-100">
            <tr>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                품목코드
              </th>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                품목명
              </th>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                공정
              </th>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                패키지
              </th>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                규격
              </th>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                MPN
              </th>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                수량
              </th>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                단가 ({moneySymbol})
              </th>
              <th className="border-b border-slate-300 px-2.5 py-2 text-center text-xs font-semibold text-slate-700">
                공급가액 ({moneySymbol})
              </th>
              <th className="w-10 border-b border-slate-300 px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const amount = computeMaterialPurchaseOrderLineAmount(
                Number(item.quantity),
                Number(item.unitPrice),
              )
              return (
                <tr key={index} className="border-t border-slate-200 bg-white">
                  <td className="px-2 py-1.5 align-middle">
                    <MaterialCombobox
                      value={item.materialCode}
                      materials={materials}
                      supplier={supplier}
                      placeholder="코드 검색"
                      ariaLabel={`${index + 1}행 품목코드`}
                      disabled={lockSeededFields}
                      inputClassName={`${lockSeededFields ? readOnlyClassName : inputClassName} min-w-[100px]`}
                      onValueChange={(materialCode) => handleMaterialCodeChange(index, materialCode)}
                      onMaterialSelect={(material) => selectMaterial(index, material)}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <MaterialCombobox
                      value={item.materialName}
                      materials={materials}
                      supplier={supplier}
                      searchField="name"
                      placeholder="품목명 검색"
                      ariaLabel={`${index + 1}행 품목명`}
                      disabled={lockSeededFields}
                      inputClassName={`${lockSeededFields ? readOnlyClassName : inputClassName} min-w-[120px]`}
                      onValueChange={(materialName) => handleMaterialNameChange(index, materialName)}
                      onMaterialSelect={(material) => selectMaterial(index, material)}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <input
                      value={item.processType}
                      readOnly
                      className={`${readOnlyClassName} min-w-[56px] text-center`}
                      placeholder="—"
                      aria-label={`${index + 1}행 공정`}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <input
                      value={item.package}
                      readOnly
                      className={`${readOnlyClassName} min-w-[72px]`}
                      placeholder="—"
                      aria-label={`${index + 1}행 패키지`}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <input
                      value={item.specification}
                      readOnly
                      className={readOnlyClassName}
                      placeholder="자동"
                      aria-label={`${index + 1}행 규격`}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <input
                      value={item.mpn}
                      readOnly
                      className={`${readOnlyClassName} min-w-[100px] font-mono text-xs`}
                      placeholder="—"
                      aria-label={`${index + 1}행 MPN`}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <QuoteNumericInput
                      min={0}
                      value={String(item.quantity)}
                      onChange={(quantity) => patchItem(index, { quantity })}
                      readOnly={lockSeededFields}
                      className={`${lockSeededFields ? readOnlyClassName : inputClassName} min-w-[72px] text-right tabular-nums`}
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <QuoteNumericInput
                      min={0}
                      value={String(item.unitPrice)}
                      onChange={(unitPrice) => patchItem(index, { unitPrice })}
                      readOnly={lockSeededFields}
                      className={`${lockSeededFields ? readOnlyClassName : inputClassName} min-w-[88px] text-right tabular-nums`}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right align-middle tabular-nums font-medium text-slate-800">
                    {moneySymbol}
                    {formatMaterialPurchaseOrderAmountNumber(amount)}
                  </td>
                  <td className="px-1 py-1.5 text-center align-middle">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={items.length <= 1 || lockSeededFields}
                      className="mx-auto flex h-7 w-7 items-center justify-center rounded text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
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
        품목코드 또는 품목명으로 검색해 선택하면 공정·패키지·규격·MPN·단가가 자동으로 채워집니다.
      </p>
    </div>
  )
}
