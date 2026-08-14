'use client'

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import {
  computeDirectInboundQuantity,
  type PurchaseInboundItemForm,
} from '@/lib/materials/inbound/form-state'
import {
  createKeyBurstDetector,
  createScanDeduper,
  looksLikeBarcodeNotQuantity,
  QTY_BARCODE_REJECT_MESSAGE,
  SCAN_DEDUP_MESSAGE,
} from '@/lib/materials/inbound/scan-guards'
import type { Material } from '@/lib/materials/types'
import { formatMaterialDisplayCode, resolveMaterialByInventoryCode } from '@/lib/materials/utils'
import { ERP_TABLE_TD_WRAP_CLASS } from '@/lib/ui/tokens'
import { playScanSound } from '@/lib/ui/toast-sound'

type InboundPurchaseLinesFormProps = {
  items: PurchaseInboundItemForm[]
  materials: Material[]
  onChange: Dispatch<SetStateAction<PurchaseInboundItemForm[]>>
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

export function InboundPurchaseLinesForm({
  items,
  materials,
  onChange,
}: InboundPurchaseLinesFormProps) {
  const [scanCode, setScanCode] = useState('')
  const [scanMessage, setScanMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    null,
  )
  const [lastScannedKey, setLastScannedKey] = useState<string | null>(null)
  const [scanFocusToken, setScanFocusToken] = useState(0)
  const [scanPulse, setScanPulse] = useState<{ kind: 'success' | 'error'; token: number } | null>(
    null,
  )
  const scanInputRef = useRef<HTMLInputElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const focusGenerationRef = useRef(0)
  const preferScanFocusRef = useRef(false)
  const scanDeduperRef = useRef(createScanDeduper())
  const qtyBurstRef = useRef(createKeyBurstDetector())

  const inputClassName =
    'h-8 w-full min-w-0 rounded-md border border-slate-200 px-2 text-right text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100'

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

  function focusQuantityInput(lineId: string) {
    preferScanFocusRef.current = false
    focusGenerationRef.current += 1
    const generation = focusGenerationRef.current
    let attempts = 0
    const tryFocus = () => {
      if (focusGenerationRef.current !== generation || preferScanFocusRef.current) return
      const input = tableRef.current?.querySelector<HTMLInputElement>(
        `[data-qty-input="${lineId}"]`,
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

  function markJustScanned(lineId: string) {
    preferScanFocusRef.current = false
    setLastScannedKey(lineId)
    setScanFocusToken((value) => value + 1)
    triggerScanPulse('success')
  }

  function patchItem(index: number, patch: Partial<PurchaseInboundItemForm>) {
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

  function findPurchaseLine(code: string) {
    const trimmed = code.trim()
    if (!trimmed) return null

    const material = resolveMaterialByInventoryCode(materials, trimmed)
    if (material) {
      const byId = items.find((item) => item.materialId === material.id)
      if (byId) return { line: byId, material }
    }

    const lower = trimmed.toLowerCase()
    const byCode = items.find((item) => {
      const codeMatch = item.materialCode.trim().toLowerCase() === lower
      const mpnMatch = item.mpn.trim().toLowerCase() === lower
      const idMatch = item.materialId.trim().toLowerCase() === lower
      return codeMatch || mpnMatch || idMatch
    })
    if (!byCode) return null
    return {
      line: byCode,
      material: materials.find((row) => row.id === byCode.materialId) ?? null,
    }
  }

  function handleScanSubmit() {
    const code = scanCode.trim()
    if (!code) {
      setScanMessage({ tone: 'error', text: '바코드를 스캔하거나 품목코드·MPN을 입력해 주세요.' })
      triggerScanPulse('error')
      focusScanInput()
      return
    }

    if (!scanDeduperRef.current.accept(code)) {
      setScanCode('')
      setScanMessage({ tone: 'error', text: SCAN_DEDUP_MESSAGE })
      triggerScanPulse('error')
      focusScanInput()
      return
    }

    const matched = findPurchaseLine(code)
    if (!matched) {
      setScanMessage({
        tone: 'error',
        text: `"${code}" 는 이 입고 전표 품목에 없습니다.`,
      })
      setScanCode('')
      triggerScanPulse('error')
      focusScanInput()
      return
    }

    const label = matched.material
      ? `${formatMaterialDisplayCode(matched.material)} · ${matched.material.materialName}`
      : `${matched.line.materialCode || matched.line.materialId} · ${matched.line.materialName}`

    setScanMessage({
      tone: 'success',
      text: `${label} — 수량을 입력한 뒤 Enter 하면 다음 스캔을 할 수 있습니다.`,
    })
    setScanCode('')
    markJustScanned(matched.line.purchaseOrderLineId)
  }

  function rejectQtyBarcodeInput(lineId: string, index: number) {
    qtyBurstRef.current.reset()
    patchItem(index, { quantityPerReel: '' })
    setScanMessage({ tone: 'error', text: QTY_BARCODE_REJECT_MESSAGE })
    triggerScanPulse('error')
    focusQuantityInput(lineId)
  }

  useEffect(() => {
    if (!lastScannedKey || !scanFocusToken || preferScanFocusRef.current) return
    const row = tableRef.current?.querySelector<HTMLElement>(
      `[data-scan-key="${lastScannedKey}"]`,
    )
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    focusQuantityInput(lastScannedKey)
  }, [lastScannedKey, scanFocusToken])

  function handleScanKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleScanSubmit()
  }

  function handleQuantityKeyDown(event: KeyboardEvent<HTMLInputElement>, lineId: string, index: number) {
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (!/[0-9]/.test(event.key)) {
        event.preventDefault()
        qtyBurstRef.current.noteChar()
        if (qtyBurstRef.current.isBurst()) {
          rejectQtyBarcodeInput(lineId, index)
        }
        return
      }
      qtyBurstRef.current.noteChar()
    }

    if (event.key !== 'Enter') return
    event.preventDefault()

    const raw = event.currentTarget.value.trim()
    if (looksLikeBarcodeNotQuantity(raw) || (qtyBurstRef.current.isBurst() && raw.length >= 5)) {
      rejectQtyBarcodeInput(lineId, index)
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
    setScanMessage({
      tone: 'success',
      text: '수량 반영됨 — 다음 바코드를 스캔해 주세요.',
    })
    setLastScannedKey((current) => (current === lineId ? null : current))
    event.currentTarget.blur()
    scanDeduperRef.current.reset()
    focusScanInput()
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        입고 가능한 구매발주 라인이 없습니다.
      </div>
    )
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
                'h-12 w-full rounded-xl border bg-white px-3 font-mono text-sm outline-none transition',
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
      </div>

      <div ref={tableRef} className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1280px] border-collapse text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">품목코드</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">품목명</th>
              <th className="px-3 py-2 text-center font-semibold text-slate-600">공정구분</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">패키지</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">사양</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-600">MPN</th>
              <th className="px-3 py-2 text-center font-semibold text-slate-600">도급/사급</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">구매발주</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">기입고</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">잔량</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">릴 개수</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">수량</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">입고수량</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const isLatest = lastScannedKey === item.purchaseOrderLineId
              const material = materials.find((row) => row.id === item.materialId)
              const displayCode = material
                ? formatMaterialDisplayCode(material)
                : item.materialCode || item.materialId

              return (
                <tr
                  key={item.purchaseOrderLineId}
                  data-scan-key={item.purchaseOrderLineId}
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
                    {cell(displayCode)}
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
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">
                    {item.orderedQuantity.toLocaleString('ko-KR')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-500">
                    {item.receivedQuantity.toLocaleString('ko-KR')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium text-amber-700">
                    {item.remainingQuantity.toLocaleString('ko-KR')}
                  </td>
                  <td className="w-[88px] px-2 py-2">
                    <QuoteNumericInput
                      min={1}
                      value={item.reelCount || '1'}
                      onChange={(reelCount) =>
                        patchItem(index, { reelCount: reelCount.trim() ? reelCount : '1' })
                      }
                      className={inputClassName}
                    />
                  </td>
                  <td className="w-[96px] px-2 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      data-qty-input={item.purchaseOrderLineId}
                      value={item.quantityPerReel}
                      onChange={(event) => {
                        const raw = event.target.value
                        if (/[^0-9]/.test(raw) || raw.length > 7) {
                          rejectQtyBarcodeInput(item.purchaseOrderLineId, index)
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
                          rejectQtyBarcodeInput(item.purchaseOrderLineId, index)
                        }
                      }}
                      onFocus={(event) => {
                        qtyBurstRef.current.reset()
                        event.target.select()
                      }}
                      onKeyDown={(event) =>
                        handleQuantityKeyDown(event, item.purchaseOrderLineId, index)
                      }
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
