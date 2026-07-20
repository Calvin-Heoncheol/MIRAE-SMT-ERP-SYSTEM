'use client'

import { type Dispatch, type SetStateAction } from 'react'
import { MaterialCombobox } from '@/components/materials/purchase-orders/material-combobox'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import type { MaterialPurchaseOrderItemForm } from '@/lib/materials/purchase-orders/form-state'
import { computeMaterialPurchaseOrderLineAmount } from '@/lib/materials/purchase-orders/utils'
import type { Material } from '@/lib/materials/types'

type MaterialPurchaseOrderItemsFormProps = {
  items: MaterialPurchaseOrderItemForm[]
  supplier: string
  materials: Material[]
  onChange: Dispatch<SetStateAction<MaterialPurchaseOrderItemForm[]>>
  onSupplierChange?: (supplier: string) => void
  onSupplierSuggest?: (supplier: string) => void
}

function clearMaterialFields(item: MaterialPurchaseOrderItemForm): MaterialPurchaseOrderItemForm {
  return {
    ...item,
    materialId: '',
    mpn: '',
    materialName: '',
    specification: '',
  }
}

function applyMaterialToItem(item: MaterialPurchaseOrderItemForm, material: Material): MaterialPurchaseOrderItemForm {
  const next: MaterialPurchaseOrderItemForm = {
    ...item,
    materialId: material.id,
    materialCode: material.id,
    materialName: material.materialName,
    specification: material.specification,
    mpn: material.mpn,
  }

  const currentPrice = Math.round(Number(item.unitPrice) || 0)
  if (material.unitPrice > 0 && currentPrice <= 0) {
    next.unitPrice = String(material.unitPrice)
  }

  return next
}

export function MaterialPurchaseOrderItemsForm({
  items,
  supplier,
  materials,
  onChange,
  onSupplierChange,
  onSupplierSuggest,
}: MaterialPurchaseOrderItemsFormProps) {
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
        specification: '',
        mpn: '',
        quantity: '0',
        unitPrice: '0',
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

  const inputClassName =
    'w-full min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100'

  const readOnlyClassName = `${inputClassName} bg-slate-50 text-slate-600`

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">자재</h3>
        <ErpRowAddButton onClick={addRow} title="자재 추가" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[920px] w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="min-w-[120px] px-3 py-2 text-left text-sm font-semibold text-slate-600">자재코드</th>
              <th className="min-w-[120px] px-3 py-2 text-left text-sm font-semibold text-slate-600">MPN</th>
              <th className="min-w-[180px] px-3 py-2 text-left text-sm font-semibold text-slate-600">자재명</th>
              <th className="min-w-[140px] px-3 py-2 text-left text-sm font-semibold text-slate-600">규격</th>
              <th className="min-w-[120px] px-3 py-2 text-left text-sm font-semibold text-slate-600">공급사</th>
              <th className="min-w-[72px] whitespace-nowrap px-3 py-2 text-right text-sm font-semibold text-slate-600">
                수량
              </th>
              <th className="min-w-[96px] whitespace-nowrap px-3 py-2 text-right text-sm font-semibold text-slate-600">
                단가
              </th>
              <th className="min-w-[104px] whitespace-nowrap px-3 py-2 text-right text-sm font-semibold text-slate-600">
                금액
              </th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const amount = computeMaterialPurchaseOrderLineAmount(Number(item.quantity), Number(item.unitPrice))
              return (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-3 py-2 align-top">
                    <MaterialCombobox
                      value={item.materialCode}
                      materials={materials}
                      supplier={supplier}
                      placeholder="자재코드 입력 또는 검색"
                      ariaLabel={`${index + 1}행 자재코드`}
                      inputClassName={`${inputClassName} min-w-[120px]`}
                      onValueChange={(materialCode) => handleMaterialCodeChange(index, materialCode)}
                      onMaterialSelect={(material) => selectMaterial(index, material)}
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input value={item.mpn} readOnly className={readOnlyClassName} placeholder="자동 입력" />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input value={item.materialName} readOnly className={readOnlyClassName} placeholder="자동 입력" />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <input value={item.specification} readOnly className={readOnlyClassName} placeholder="자동 입력" />
                  </td>
                  <td className="px-3 py-2 align-top">
                    {index === 0 ? (
                      <input
                        value={supplier}
                        onChange={(event) => onSupplierChange?.(event.target.value)}
                        placeholder="공급사명"
                        className={`${inputClassName} min-w-[120px]`}
                        aria-label="공급사"
                      />
                    ) : (
                      <input value={supplier} readOnly className={readOnlyClassName} />
                    )}
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
                  <td className="w-10 px-2 py-2 text-center align-top">
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
        자재코드로 자재를 선택하세요. 선택 시 MPN·자재명·규격·단가가 자동으로 채워집니다.
      </p>
    </div>
  )
}
