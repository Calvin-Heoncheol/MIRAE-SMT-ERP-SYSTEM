'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react'
import { MaterialBarcodeRegisterPanel } from '@/components/materials/material-barcode-register-panel'
import { MaterialLabelPrintButton } from '@/components/materials/material-label-print-button'
import { MaterialCombobox } from '@/components/materials/purchase-orders/material-combobox'
import { ErpRowAddButton } from '@/components/ui/erp-row-add-button'
import {
  computeDirectInboundQuantity,
  type DirectInboundItemForm,
} from '@/lib/materials/inbound/form-state'
import {
  alreadyScannedReelMessage,
  assignReelLotNumber,
  parseReelBarcode,
} from '@/lib/materials/inbound/reel-lot'
import {
  createKeyBurstDetector,
  createScanDeduper,
  looksLikeBarcodeNotQuantity,
  QTY_BARCODE_REJECT_MESSAGE,
  SCAN_DEDUP_MESSAGE,
} from '@/lib/materials/inbound/scan-guards'
import type { Material } from '@/lib/materials/types'
import { formatMaterialDisplayCode, resolveMaterialByInventoryCode } from '@/lib/materials/utils'
import { MaterialLabelSettingsButton } from '@/components/materials/material-label-settings-button'
import { printInboundReelLabel } from '@/lib/materials/print-material-labels'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { ERP_TABLE_TD_WRAP_CLASS } from '@/lib/ui/tokens'
import { playScanSound } from '@/lib/ui/toast-sound'

type InboundDirectLinesFormProps = {
  items: DirectInboundItemForm[]
  materials: Material[]
  onChange: Dispatch<SetStateAction<DirectInboundItemForm[]>>
  onMaterialsChanged?: () => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
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
  extra?: Partial<DirectInboundItemForm>,
): DirectInboundItemForm {
  return {
    materialId: material.id,
    materialName: material.materialName,
    specification: material.specification,
    mpn: material.mpn,
    lotNumber: extra?.lotNumber || '',
    scanFingerprint: extra?.scanFingerprint || '',
    vendorLot: extra?.vendorLot || '',
    quantityPerReel: extra?.quantityPerReel || '',
    reelCount: '1',
    quantity: computeDirectInboundQuantity(extra?.quantityPerReel || '0', '1'),
  }
}

function createLineKey() {
  return `direct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function InboundDirectLinesForm({
  items,
  materials,
  onChange,
  onMaterialsChanged,
}: InboundDirectLinesFormProps) {
  const [scanCode, setScanCode] = useState('')
  const [scanMessage, setScanMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    null,
  )
  const [unmatchedScanCode, setUnmatchedScanCode] = useState<string | null>(null)
  const [pendingRetryCode, setPendingRetryCode] = useState<string | null>(null)
  const [lastScannedKey, setLastScannedKey] = useState<string | null>(null)
  const [scanFocusToken, setScanFocusToken] = useState(0)
  const [scanPulse, setScanPulse] = useState<{ kind: 'success' | 'error'; token: number } | null>(
    null,
  )
  const [printOnScan, setPrintOnScan] = useState(true)
  const [rowKeys, setRowKeys] = useState<string[]>(() => items.map(() => createLineKey()))

  const scanInputRef = useRef<HTMLInputElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const focusGenerationRef = useRef(0)
  const preferScanFocusRef = useRef(false)
  const scanDeduperRef = useRef(createScanDeduper())
  const qtyBurstRef = useRef(createKeyBurstDetector())

  useEffect(() => {
    setRowKeys((current) => {
      if (current.length === items.length) return current
      if (current.length < items.length) {
        return [
          ...current,
          ...Array.from({ length: items.length - current.length }, () => createLineKey()),
        ]
      }
      return current.slice(0, items.length)
    })
  }, [items.length])

  function focusScanInput() {
    preferScanFocusRef.current = true
    focusGenerationRef.current += 1
    const generation = focusGenerationRef.current
    const tryFocus = () => {
      if (focusGenerationRef.current !== generation) return
      const input = scanInputRef.current
      if (!input) {
        window.setTimeout(tryFocus, 20)
        return
      }
      input.focus()
      input.select()
    }
    window.setTimeout(tryFocus, 0)
  }

  function focusQuantityInput(key: string) {
    preferScanFocusRef.current = false
    focusGenerationRef.current += 1
    const generation = focusGenerationRef.current
    let attempts = 0
    const tryFocus = () => {
      if (focusGenerationRef.current !== generation || preferScanFocusRef.current) return
      const input = tableScrollRef.current?.querySelector<HTMLInputElement>(
        `[data-qty-input="${key}"]`,
      )
      if (input) {
        input.focus()
        input.select()
        return
      }
      if (attempts < 12) {
        attempts += 1
        window.setTimeout(tryFocus, 25)
      }
    }
    window.requestAnimationFrame(tryFocus)
  }

  function triggerScanPulse(kind: 'success' | 'error') {
    playScanSound(kind)
    setScanPulse(null)
    window.requestAnimationFrame(() => {
      setScanPulse({ kind, token: Date.now() })
    })
  }

  function markJustScanned(key: string) {
    preferScanFocusRef.current = false
    setLastScannedKey(key)
    setScanFocusToken((value) => value + 1)
    triggerScanPulse('success')
  }

  const labelPrintItems = useMemo(
    () =>
      items
        .filter((item) => item.materialId.trim())
        .map((item) => {
          const reels = Math.max(0, Number(item.reelCount) || 0)
          const material = materials.find((row) => row.id === item.materialId.trim())
          return {
            id: material ? formatMaterialDisplayCode(material) : item.materialId.trim(),
            materialName: item.materialName,
            customer: material?.customer || '',
            package: material?.package || '',
            specification: item.specification,
            lotNumber: item.lotNumber.trim(),
            copies: item.lotNumber.trim() ? 1 : reels > 0 ? reels : 1,
          }
        }),
    [items, materials],
  )

  const inputClassName =
    'h-8 w-full min-w-0 rounded-md border border-slate-200 px-2 text-right text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100'

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
    const key = createLineKey()
    setRowKeys((current) => [...current, key])
    onChange([
      ...items,
      {
        materialId: '',
        materialName: '',
        specification: '',
        mpn: '',
        lotNumber: '',
        scanFingerprint: '',
        vendorLot: '',
        quantityPerReel: '',
        reelCount: '1',
        quantity: '',
      },
    ])
  }

  function removeRow(index: number) {
    if (items.length <= 1) {
      onChange([
        {
          materialId: '',
          materialName: '',
          specification: '',
          mpn: '',
          lotNumber: '',
          scanFingerprint: '',
          vendorLot: '',
          quantityPerReel: '',
          reelCount: '1',
          quantity: '',
        },
      ])
      setRowKeys([createLineKey()])
      setLastScannedKey(null)
      return
    }
    const removedKey = rowKeys[index]
    setRowKeys((current) => current.filter((_, itemIndex) => itemIndex !== index))
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
    setLastScannedKey((current) => (current === removedKey ? null : current))
  }

  function addMaterialToList(material: Material, rawCode: string) {
    const parsed = parseReelBarcode(rawCode)
    if (parsed.fingerprint) {
      const existing = items.find((item) => item.scanFingerprint === parsed.fingerprint)
      if (existing) {
        setScanMessage({ tone: 'error', text: alreadyScannedReelMessage() })
        triggerScanPulse('error')
        focusScanInput()
        return
      }
    }

    const lotNumber = assignReelLotNumber(
      todayYmdSeoul(),
      items.map((item) => item.lotNumber),
    )
    const key = createLineKey()
    const kept = items
      .map((item, index) => ({ item, key: rowKeys[index] ?? createLineKey() }))
      .filter(
        ({ item }) =>
          item.materialId.trim() ||
          Number(item.quantityPerReel) > 0 ||
          Number(item.quantity) > 0,
      )
    setRowKeys([key, ...kept.map((row) => row.key)])
    onChange([
      createInboundLine(material, {
        lotNumber,
        scanFingerprint: parsed.fingerprint,
        vendorLot: parsed.vendorLot,
        quantityPerReel: parsed.quantity ? String(parsed.quantity) : '',
      }),
      ...kept.map((row) => row.item),
    ])
    setScanMessage({
      tone: 'success',
      text: parsed.vendorLot
        ? `${formatMaterialDisplayCode(material)} · 제조 ${parsed.vendorLot}`
        : formatMaterialDisplayCode(material),
    })
    markJustScanned(key)
  }

  function handleScan(rawCode: string) {
    const code = rawCode.trim()
    if (!code) {
      setScanMessage({ tone: 'error', text: '바코드를 스캔하거나 품목코드·MPN을 입력해 주세요.' })
      triggerScanPulse('error')
      return
    }

    if (!scanDeduperRef.current.accept(code)) {
      setScanCode('')
      setScanMessage({ tone: 'error', text: SCAN_DEDUP_MESSAGE })
      triggerScanPulse('error')
      focusScanInput()
      return
    }

    const material = resolveMaterialByInventoryCode(materials, code)
    if (!material) {
      setScanMessage({ tone: 'error', text: `"${code}" 와 일치하는 자재를 찾지 못했습니다.` })
      setUnmatchedScanCode(code)
      setScanCode('')
      triggerScanPulse('error')
      return
    }

    setUnmatchedScanCode(null)
    setScanCode('')
    addMaterialToList(material, code)
  }

  function rejectQtyBarcodeInput(key: string, index: number) {
    qtyBurstRef.current.reset()
    patchItem(index, { quantityPerReel: '' })
    setScanMessage({ tone: 'error', text: QTY_BARCODE_REJECT_MESSAGE })
    triggerScanPulse('error')
    focusQuantityInput(key)
  }

  useEffect(() => {
    if (!pendingRetryCode) return
    const material = resolveMaterialByInventoryCode(materials, pendingRetryCode)
    if (!material) return
    setPendingRetryCode(null)
    setUnmatchedScanCode(null)
    addMaterialToList(material, pendingRetryCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials, pendingRetryCode])

  useEffect(() => {
    if (!lastScannedKey || !scanFocusToken || preferScanFocusRef.current) return
    const row = tableScrollRef.current?.querySelector<HTMLElement>(
      `[data-scan-key="${lastScannedKey}"]`,
    )
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    focusQuantityInput(lastScannedKey)
  }, [lastScannedKey, scanFocusToken])

  function handleScanKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleScan(scanCode)
  }

  function handleQuantityKeyDown(event: KeyboardEvent<HTMLInputElement>, key: string, index: number) {
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (!/[0-9]/.test(event.key)) {
        event.preventDefault()
        qtyBurstRef.current.noteChar()
        if (qtyBurstRef.current.isBurst()) {
          rejectQtyBarcodeInput(key, index)
        }
        return
      }
      qtyBurstRef.current.noteChar()
    }

    if (event.key !== 'Enter') return
    event.preventDefault()

    const raw = event.currentTarget.value.trim()
    if (looksLikeBarcodeNotQuantity(raw) || (qtyBurstRef.current.isBurst() && raw.length >= 5)) {
      rejectQtyBarcodeInput(key, index)
      return
    }

    const qty = Number(raw) || 0
    if (qty <= 0) {
      setScanMessage({ tone: 'error', text: '수량을 입력해 주세요.' })
      event.currentTarget.focus()
      event.currentTarget.select()
      return
    }

    qtyBurstRef.current.reset()
    setScanMessage(null)
    patchItem(index, { quantityPerReel: String(qty) })
    if (printOnScan) {
      const item = items[index]
      if (item) {
        const material = materials.find((row) => row.id === item.materialId)
        void printInboundReelLabel({
          id: material
            ? formatMaterialDisplayCode(material)
            : item.materialId,
          materialName: material?.materialName || item.materialName,
          customer: material?.customer || '',
          package: material?.package || '',
          specification: material?.specification || item.specification,
          lotNumber: item.lotNumber,
        })
      }
    }
    setLastScannedKey(null)
    event.currentTarget.blur()
    scanDeduperRef.current.reset()
    focusScanInput()
  }

  return (
    <div className="flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-800">바코드 스캔</p>
            <p className="mt-0.5 text-xs text-slate-500">
              스캔 후 수량을 입력하고 Enter 하면 다음 바코드를 찍을 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <span
            className={[
              'rounded-full px-2.5 py-1 text-xs font-semibold',
              scanPulse?.kind === 'error' || scanMessage?.tone === 'error'
                ? 'bg-rose-100 text-rose-800'
                : lastScannedKey
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-600',
            ].join(' ')}
          >
            {scanPulse?.kind === 'error' || scanMessage?.tone === 'error'
              ? '미인식'
              : lastScannedKey
                ? '인식됨'
                : '스캔 대기'}
          </span>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={printOnScan}
              onChange={(event) => setPrintOnScan(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300"
            />
            수량 확정 시 라벨
          </label>
          <MaterialLabelSettingsButton />
          </div>
        </div>
        <label className="block">
          <span className="sr-only">바코드 스캔</span>
          <div
            className={[
              'rounded-xl',
              scanPulse?.kind === 'success' ? 'erp-scan-flash-ok' : '',
              scanPulse?.kind === 'error' ? 'erp-scan-flash-err' : '',
            ].join(' ')}
          >
            <input
              ref={scanInputRef}
              value={scanCode}
              onChange={(event) => setScanCode(event.target.value)}
              onKeyDown={handleScanKeyDown}
              placeholder="릴 바코드 스캔 또는 품목코드·MPN 입력 후 Enter"
              autoFocus
              className={[
                'h-14 w-full rounded-xl border bg-white px-3 font-mono text-base outline-none transition',
                scanPulse?.kind === 'error'
                  ? 'border-rose-400 focus:border-rose-500'
                  : scanPulse?.kind === 'success'
                    ? 'border-emerald-500 focus:border-emerald-500'
                    : 'border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100',
              ].join(' ')}
            />
          </div>
        </label>
        {scanMessage ? (
          <p
            aria-live="polite"
            className={[
              'mt-2 rounded-lg px-3 py-2 text-sm',
              scanMessage.tone === 'success'
                ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-rose-200 bg-rose-50 text-rose-800',
            ].join(' ')}
          >
            {scanMessage.text}
          </p>
        ) : null}
        {unmatchedScanCode ? (
          <div className="mt-3">
            <MaterialBarcodeRegisterPanel
              materials={materials}
              suggestedBarcode={unmatchedScanCode}
              onRegistered={() => {
                setPendingRetryCode(unmatchedScanCode)
                onMaterialsChanged?.()
              }}
            />
          </div>
        ) : null}
      </div>

      {labelPrintItems.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2">
          <p className="text-xs text-slate-600">
            입고 라인 기준으로 품목코드 바코드 라벨을 출력합니다. LOT가 있으면 릴마다 1장입니다.
          </p>
          <MaterialLabelPrintButton items={labelPrintItems} />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
        <h3 className="text-sm font-bold text-slate-900">입고 품목</h3>
        <ErpRowAddButton onClick={addRow} title="입고 품목 추가" />
      </div>

      <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-auto">
        <table className="erp-data-table erp-data-table--compact w-full min-w-[1180px] border-collapse text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">품목코드</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">품목명</th>
              <th className="px-3 py-2 text-center font-semibold text-slate-600">공정구분</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">패키지</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">사양</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">MPN</th>
              <th className="px-3 py-2 text-center font-semibold text-slate-600">도급/사급</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">수량</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">입고수량</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center text-sm text-slate-500">
                  스캔한 릴이 바로 여기에 쌓입니다. 같은 릴을 다시 찍으면 알려 줍니다.
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const key = rowKeys[index] ?? `row-${index}`
                const isLatest = key === lastScannedKey
                const material = materials.find((row) => row.id === item.materialId)
                const displayCode = material
                  ? formatMaterialDisplayCode(material)
                  : item.materialId
                const isBlank = !item.materialId.trim()

                return (
                  <tr
                    key={key}
                    data-scan-key={key}
                    className={[
                      'border-t',
                      isLatest
                        ? 'erp-scan-row-latest border-emerald-200 bg-emerald-50 ring-1 ring-inset ring-emerald-300'
                        : 'border-slate-100',
                    ].join(' ')}
                  >
                    <td
                      className={`px-3 py-2 font-mono text-sm font-semibold ${isLatest ? 'text-emerald-900' : 'text-slate-800'} ${ERP_TABLE_TD_WRAP_CLASS}`}
                    >
                      {isBlank ? (
                        <MaterialCombobox
                          value=""
                          materials={materials}
                          supplier=""
                          placeholder="품목코드 검색"
                          ariaLabel={`${index + 1}행 품목코드`}
                          inputClassName="h-8 w-full min-w-[120px] rounded-md border border-slate-200 px-2 text-sm"
                          onValueChange={(materialId) =>
                            onChange((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...clearMaterialFields(row), materialId }
                                  : row,
                              ),
                            )
                          }
                          onMaterialSelect={(selected) =>
                            onChange((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index ? applyMaterialToItem(row, selected) : row,
                              ),
                            )
                          }
                        />
                      ) : (
                        cell(displayCode)
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-sm font-medium text-slate-900 ${ERP_TABLE_TD_WRAP_CLASS}`}
                    >
                      {cell(item.materialName)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-slate-700">
                      {cell(material?.type || '')}
                    </td>
                    <td className={`px-3 py-2 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                      {cell(material?.package || '')}
                    </td>
                    <td className={`px-3 py-2 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                      {cell(item.specification)}
                    </td>
                    <td
                      className={`px-3 py-2 font-mono text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}
                    >
                      {cell(item.mpn)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-slate-700">
                      {cell(material?.supplyType || '')}
                    </td>
                    <td className="w-[96px] px-2 py-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        data-qty-input={key}
                        value={item.quantityPerReel}
                        onChange={(event) => {
                          const raw = event.target.value
                          if (/[^0-9]/.test(raw) || raw.length > 7) {
                            rejectQtyBarcodeInput(key, index)
                            return
                          }
                          patchItem(index, {
                            quantityPerReel: raw.replace(/^0+(?=\d)/, ''),
                          })
                        }}
                        onPaste={(event) => {
                          const text = event.clipboardData.getData('text')
                          if (looksLikeBarcodeNotQuantity(text) || text.trim().length > 7) {
                            event.preventDefault()
                            rejectQtyBarcodeInput(key, index)
                          }
                        }}
                        onFocus={(event) => {
                          qtyBurstRef.current.reset()
                          event.target.select()
                        }}
                        onKeyDown={(event) => handleQuantityKeyDown(event, key, index)}
                        placeholder="수량"
                        className={[
                          inputClassName,
                          isLatest ? 'border-emerald-400 ring-2 ring-emerald-200' : '',
                        ].join(' ')}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {(Number(item.quantity) || 0).toLocaleString('ko-KR')}
                    </td>
                    <td className="w-10 px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        aria-label={`${index + 1}행 삭제`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
