'use client'

import { useMemo, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react'
import { MaterialCombobox } from '@/components/materials/purchase-orders/material-combobox'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import type { DirectInboundItemForm } from '@/lib/materials/inbound/form-state'
import type { Material } from '@/lib/materials/types'

type InboundDirectLinesFormProps = {
  items: DirectInboundItemForm[]
  materials: Material[]
  onChange: Dispatch<SetStateAction<DirectInboundItemForm[]>>
}

function clearMaterialFields(item: DirectInboundItemForm): DirectInboundItemForm {
  return {
    ...item,
    materialId: '',
    mpn: '',
    materialName: '',
    specification: '',
  }
}

function applyMaterialToItem(item: DirectInboundItemForm, material: Material): DirectInboundItemForm {
  return {
    ...item,
    materialId: material.id,
    cpn: material.cpn,
    materialName: material.materialName,
    specification: material.specification,
    mpn: material.mpn,
  }
}

function normalizeScanCode(value: string) {
  return value.trim().toLowerCase()
}

export function InboundDirectLinesForm({ items, materials, onChange }: InboundDirectLinesFormProps) {
  const [scanCode, setScanCode] = useState('')
  const [scanMessage, setScanMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const inputClassName =
    'w-full min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
  const readOnlyClassName = `${inputClassName} bg-slate-50 text-slate-600`
  const matchedCount = items.filter((item) => item.materialId).length
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    [items],
  )

  function patchItem(index: number, patch: Partial<DirectInboundItemForm>) {
    onChange((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  function addRow() {
    onChange([
      ...items,
      {
        materialId: '',
        cpn: '',
        materialName: '',
        specification: '',
        mpn: '',
        quantity: '0',
      },
    ])
  }

  function removeRow(index: number) {
    if (items.length <= 1) return
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  function resolveMaterialByScan(code: string) {
    const normalized = normalizeScanCode(code)
    if (!normalized) return null

    return (
      materials.find((material) => {
        const candidates = [material.cpn, material.mpn, ...material.alternateMpns]
        return candidates.some((candidate) => normalizeScanCode(candidate) === normalized)
      }) ?? null
    )
  }

  function applyScannedMaterial(material: Material) {
    onChange((current) => {
      const existingIndex = current.findIndex((item) => item.materialId === material.id)
      if (existingIndex >= 0) {
        return current.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                quantity: String((Number(item.quantity) || 0) + 1),
              }
            : item,
        )
      }

      return [
        {
          materialId: material.id,
          cpn: material.cpn,
          materialName: material.materialName,
          specification: material.specification,
          mpn: material.mpn,
          quantity: '1',
        },
        ...current.filter((item) => item.materialId || item.cpn || Number(item.quantity) > 0),
      ]
    })
  }

  function handleScanSubmit() {
    const material = resolveMaterialByScan(scanCode)
    if (!scanCode.trim()) {
      setScanMessage({ tone: 'error', text: 'CPN 또는 MPN을 스캔해 주세요.' })
      return
    }
    if (!material) {
      setScanMessage({ tone: 'error', text: `"${scanCode}" 와 일치하는 자재를 찾지 못했습니다.` })
      return
    }

    applyScannedMaterial(material)
    setScanMessage({
      tone: 'success',
      text: `${material.cpn} · ${material.materialName} 수량을 1개 추가했습니다.`,
    })
    setScanCode('')
  }

  function handleScanKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleScanSubmit()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-blue-800">스캔 작업대</p>
            <h3 className="text-xl font-bold text-slate-900">CPN / MPN 바코드를 연속 스캔하세요</h3>
            <p className="text-sm text-slate-600">
              스캔 후 Enter가 들어오면 자재를 자동 매칭하고, 같은 품목은 수량이 누적됩니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 xl:min-w-[260px]">
            <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
              <p className="text-xs font-medium text-slate-500">매칭 품목</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{matchedCount}</p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
              <p className="text-xs font-medium text-slate-500">총 입고수량</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">
                {totalQuantity.toLocaleString('ko-KR')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={scanCode}
            onChange={(event) => setScanCode(event.target.value)}
            onKeyDown={handleScanKeyDown}
            placeholder="바코드 / CPN / MPN 스캔 후 Enter"
            autoFocus
            className="h-12 flex-1 rounded-xl border border-blue-200 bg-white px-4 text-base outline-none ring-blue-100 placeholder:text-slate-400 focus:border-blue-400 focus:ring-2"
          />
          <button
            type="button"
            onClick={handleScanSubmit}
            className="h-12 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            스캔 반영
          </button>
        </div>

        {scanMessage ? (
          <div
            className={[
              'mt-3 rounded-xl px-3 py-2 text-sm',
              scanMessage.tone === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-rose-200 bg-rose-50 text-rose-800',
            ].join(' ')}
          >
            {scanMessage.text}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-blue-200 bg-white/70 px-3 py-2 text-sm text-slate-500">
            스캐너가 키보드처럼 입력되는 환경이면 입력창에 포커스를 둔 채 계속 스캔하면 됩니다.
          </div>
        )}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr),280px]">
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="min-w-[120px] px-3 py-2 text-left text-sm font-semibold text-slate-600">CPN</th>
              <th className="min-w-[120px] px-3 py-2 text-left text-sm font-semibold text-slate-600">MPN</th>
              <th className="min-w-[180px] px-3 py-2 text-left text-sm font-semibold text-slate-600">자재명</th>
              <th className="min-w-[140px] px-3 py-2 text-left text-sm font-semibold text-slate-600">규격</th>
              <th className="min-w-[96px] px-3 py-2 text-right text-sm font-semibold text-slate-600">입고수량</th>
              <th className="w-16 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-t border-slate-100">
                <td className="px-3 py-2 align-top">
                  <MaterialCombobox
                    value={item.cpn}
                    materials={materials}
                    supplier=""
                    placeholder="CPN 입력 또는 검색"
                    ariaLabel={`${index + 1}행 CPN`}
                    inputClassName={`${inputClassName} min-w-[120px]`}
                    onValueChange={(cpn) =>
                      onChange((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...clearMaterialFields(row), cpn } : row,
                        ),
                      )
                    }
                    onMaterialSelect={(material) =>
                      onChange((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? applyMaterialToItem(row, material) : row,
                        ),
                      )
                    }
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
                  <QuoteNumericInput
                    min={0}
                    value={String(item.quantity)}
                    onChange={(quantity) => patchItem(index, { quantity })}
                    className={`${inputClassName} min-w-[96px] text-right`}
                  />
                </td>
                <td className="px-3 py-2 text-center align-top">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    disabled={items.length <= 1}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">작업 안내</p>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
              <li>1. 스캔창에 포커스를 둔 채 바코드를 연속 스캔합니다.</li>
              <li>2. 같은 품목은 새 행 대신 수량이 자동 누적됩니다.</li>
              <li>3. 매칭 실패 시 아래 표에서 직접 검색해 보정합니다.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-500">수동 입력 보완</p>
            <p className="mt-1 text-sm text-slate-600">
              거래처 라벨이 없거나 바코드가 없는 자재는 아래 행에서 CPN 검색으로 직접 추가할 수 있습니다.
            </p>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="w-full rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-800"
          >
            + 수동 자재 추가
          </button>
        </div>
      </div>
    </div>
  )
}
