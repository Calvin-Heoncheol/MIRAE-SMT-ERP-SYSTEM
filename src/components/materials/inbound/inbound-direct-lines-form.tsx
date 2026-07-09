'use client'

import { useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react'
import { MaterialBarcodeRegisterPanel } from '@/components/materials/material-barcode-register-panel'
import { MaterialLabelPrintButton } from '@/components/materials/material-label-print-button'
import { MaterialCombobox } from '@/components/materials/purchase-orders/material-combobox'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import {
  computeDirectInboundQuantity,
  type DirectInboundItemForm,
} from '@/lib/materials/inbound/form-state'
import type { Material } from '@/lib/materials/types'
import { resolveMaterialByInventoryCode } from '@/lib/materials/utils'

type InboundDirectLinesFormProps = {
  items: DirectInboundItemForm[]
  materials: Material[]
  onChange: Dispatch<SetStateAction<DirectInboundItemForm[]>>
  onMaterialsChanged?: () => void
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
    materialName: material.materialName,
    specification: material.specification,
    mpn: material.mpn,
  }
}

function createInboundLine(
  material: Material,
  quantityPerReel: string,
  reelCount: string,
): DirectInboundItemForm {
  return {
    materialId: material.id,
    materialName: material.materialName,
    specification: material.specification,
    mpn: material.mpn,
    quantityPerReel,
    reelCount,
    quantity: computeDirectInboundQuantity(quantityPerReel, reelCount),
  }
}

export function InboundDirectLinesForm({
  items,
  materials,
  onChange,
  onMaterialsChanged,
}: InboundDirectLinesFormProps) {
  const [scanCode, setScanCode] = useState('')
  const [scanQuantityPerReel, setScanQuantityPerReel] = useState('0')
  const [scanReelCount, setScanReelCount] = useState('0')
  const [scanMessage, setScanMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [unmatchedScanCode, setUnmatchedScanCode] = useState<string | null>(null)
  const [pendingRetry, setPendingRetry] = useState<{
    code: string
    quantityPerReel: string
    reelCount: string
  } | null>(null)
  const quantityPerReelRef = useRef<HTMLInputElement>(null)

  const labelPrintItems = useMemo(
    () =>
      items
        .filter((item) => item.materialId.trim())
        .map((item) => {
          const reels = Math.max(0, Number(item.reelCount) || 0)
          return {
            id: item.materialId.trim(),
            materialName: item.materialName,
            mpn: item.mpn,
            copies: reels > 0 ? reels : 1,
          }
        }),
    [items],
  )

  const inputClassName =
    'w-full min-w-0 rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
  const readOnlyClassName = `${inputClassName} bg-slate-50 text-slate-600`

  function patchItem(index: number, patch: Partial<DirectInboundItemForm>) {
    onChange((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const next = { ...item, ...patch }
        if ('quantityPerReel' in patch || 'reelCount' in patch) {
          next.quantity = computeDirectInboundQuantity(next.quantityPerReel, next.reelCount)
        }
        return next
      }),
    )
  }

  function addRow() {
    onChange([
      ...items,
      {
        materialId: '',
        materialName: '',
        specification: '',
        mpn: '',
        quantityPerReel: '0',
        reelCount: '0',
        quantity: '0',
      },
    ])
  }

  function removeRow(index: number) {
    if (items.length <= 1) return
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  function resolveMaterialByScan(code: string) {
    return resolveMaterialByInventoryCode(materials, code)
  }

  function commitInboundLine(material: Material, quantityPerReel: string, reelCount: string) {
    const perReel = Math.max(0, Number(quantityPerReel) || 0)
    const reels = Math.max(0, Number(reelCount) || 0)
    const inboundQuantity = perReel * reels

    if (perReel <= 0) {
      setScanMessage({ tone: 'error', text: '수량을 입력해 주세요.' })
      quantityPerReelRef.current?.focus()
      return false
    }
    if (reels <= 0) {
      setScanMessage({ tone: 'error', text: '릴 개수를 입력해 주세요.' })
      return false
    }

    onChange((current) => {
      const existingIndex = current.findIndex((item) => item.materialId === material.id)
      if (existingIndex >= 0) {
        return current.map((item, index) => {
          if (index !== existingIndex) return item
          const nextReelCount = (Number(item.reelCount) || 0) + reels
          const nextQuantity = (Number(item.quantity) || 0) + inboundQuantity
          return {
            ...item,
            quantityPerReel: String(perReel),
            reelCount: String(nextReelCount),
            quantity: String(nextQuantity),
          }
        })
      }

      return [
        createInboundLine(material, String(perReel), String(reels)),
        ...current.filter((item) => item.materialId || Number(item.quantity) > 0),
      ]
    })

    setScanMessage({
      tone: 'success',
      text: `${material.id} · ${material.materialName} · ${inboundQuantity.toLocaleString('ko-KR')}개 (${reels.toLocaleString('ko-KR')}릴)`,
    })
    return true
  }

  function handleScanSubmit() {
    const material = resolveMaterialByScan(scanCode)
    if (!scanCode.trim()) {
      setScanMessage({ tone: 'error', text: '자재코드 또는 MPN을 스캔해 주세요.' })
      setUnmatchedScanCode(null)
      return
    }
    if (!material) {
      setScanMessage({ tone: 'error', text: `"${scanCode}" 와 일치하는 자재를 찾지 못했습니다.` })
      setUnmatchedScanCode(scanCode.trim())
      return
    }

    const perReel = Number(scanQuantityPerReel) || 0
    const reels = Number(scanReelCount) || 0
    if (perReel <= 0 || reels <= 0) {
      setScanMessage({
        tone: 'success',
        text: `${material.id} · ${material.materialName} 매칭됨 — 수량과 릴 개수를 입력해 주세요.`,
      })
      setUnmatchedScanCode(null)
      quantityPerReelRef.current?.focus()
      return
    }

    if (commitInboundLine(material, scanQuantityPerReel, scanReelCount)) {
      setScanCode('')
      setScanQuantityPerReel('0')
      setScanReelCount('0')
      setUnmatchedScanCode(null)
      setPendingRetry(null)
    }
  }

  useEffect(() => {
    if (!pendingRetry) return
    const material = resolveMaterialByScan(pendingRetry.code)
    if (!material) return

    if (commitInboundLine(material, pendingRetry.quantityPerReel, pendingRetry.reelCount)) {
      setScanCode('')
      setScanQuantityPerReel('0')
      setScanReelCount('0')
      setUnmatchedScanCode(null)
      setPendingRetry(null)
    }
  }, [materials, pendingRetry])

  function handleScanKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleScanSubmit()
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_96px_auto] sm:items-end">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">바코드</span>
          <input
            value={scanCode}
            onChange={(event) => setScanCode(event.target.value)}
            onKeyDown={handleScanKeyDown}
            placeholder="스캔 후 Enter"
            autoFocus
            className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">수량</span>
          <input
            ref={quantityPerReelRef}
            type="text"
            inputMode="numeric"
            value={scanQuantityPerReel}
            onChange={(event) => setScanQuantityPerReel(event.target.value.replace(/[^\d.]/g, ''))}
            onKeyDown={handleScanKeyDown}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-right text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">릴 개수</span>
          <QuoteNumericInput
            min={0}
            value={scanReelCount}
            onChange={setScanReelCount}
            onKeyDown={handleScanKeyDown}
            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-right text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <button
          type="button"
          onClick={handleScanSubmit}
          className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          등록
        </button>
      </div>

      {scanMessage ? (
        <div
          className={[
            'rounded-lg px-3 py-2 text-sm',
            scanMessage.tone === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800',
          ].join(' ')}
        >
          {scanMessage.text}
        </div>
      ) : null}

      {unmatchedScanCode ? (
        <MaterialBarcodeRegisterPanel
          materials={materials}
          suggestedBarcode={unmatchedScanCode}
          onRegistered={() => {
            setPendingRetry({
              code: unmatchedScanCode,
              quantityPerReel: scanQuantityPerReel,
              reelCount: scanReelCount,
            })
            onMaterialsChanged?.()
          }}
        />
      ) : null}

      {labelPrintItems.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2">
          <p className="text-xs text-violet-800">
            입고 라인 기준으로 자재코드 바코드 라벨을 출력합니다. 릴 개수만큼 장수가 정해집니다.
          </p>
          <MaterialLabelPrintButton items={labelPrintItems} />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[920px] w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="min-w-[120px] px-3 py-2 text-left text-sm font-semibold text-slate-600">자재코드</th>
              <th className="min-w-[120px] px-3 py-2 text-left text-sm font-semibold text-slate-600">MPN</th>
              <th className="min-w-[160px] px-3 py-2 text-left text-sm font-semibold text-slate-600">자재명</th>
              <th className="min-w-[120px] px-3 py-2 text-left text-sm font-semibold text-slate-600">규격</th>
              <th className="min-w-[96px] px-3 py-2 text-right text-sm font-semibold text-slate-600">수량</th>
              <th className="min-w-[80px] px-3 py-2 text-right text-sm font-semibold text-slate-600">릴 개수</th>
              <th className="min-w-[96px] px-3 py-2 text-right text-sm font-semibold text-slate-600">입고수량</th>
              <th className="w-16 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index} className="border-t border-slate-100">
                <td className="px-3 py-2 align-top">
                  <MaterialCombobox
                    value={item.materialId}
                    materials={materials}
                    supplier=""
                    placeholder="자재코드 검색"
                    ariaLabel={`${index + 1}행 자재코드`}
                    inputClassName={`${inputClassName} min-w-[120px]`}
                    onValueChange={(materialId) =>
                      onChange((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index ? { ...clearMaterialFields(row), materialId } : row,
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
                  <input value={item.mpn} readOnly className={readOnlyClassName} placeholder="-" />
                </td>
                <td className="px-3 py-2 align-top">
                  <input value={item.materialName} readOnly className={readOnlyClassName} placeholder="-" />
                </td>
                <td className="px-3 py-2 align-top">
                  <input value={item.specification} readOnly className={readOnlyClassName} placeholder="-" />
                </td>
                <td className="px-3 py-2 align-top">
                  <QuoteNumericInput
                    min={0}
                    value={String(item.quantityPerReel)}
                    onChange={(quantityPerReel) => patchItem(index, { quantityPerReel })}
                    className={`${inputClassName} min-w-[96px] text-right`}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <QuoteNumericInput
                    min={0}
                    value={String(item.reelCount)}
                    onChange={(reelCount) => patchItem(index, { reelCount })}
                    className={`${inputClassName} min-w-[80px] text-right`}
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <QuoteNumericInput
                    min={0}
                    value={String(item.quantity)}
                    onChange={(quantity) => patchItem(index, { quantity })}
                    className={`${inputClassName} min-w-[96px] text-right font-medium`}
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

      <button
        type="button"
        onClick={addRow}
        className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:bg-slate-50"
      >
        + 행 추가
      </button>
    </div>
  )
}
