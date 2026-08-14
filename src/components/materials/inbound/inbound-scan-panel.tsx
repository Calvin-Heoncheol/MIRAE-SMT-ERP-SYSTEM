'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { MaterialBarcodeRegisterPanel } from '@/components/materials/material-barcode-register-panel'
import { MaterialLabelPrintButton } from '@/components/materials/material-label-print-button'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { computeDirectInboundQuantity } from '@/lib/materials/inbound/form-state'
import {
  createKeyBurstDetector,
  createScanDeduper,
  looksLikeBarcodeNotQuantity,
  QTY_BARCODE_REJECT_MESSAGE,
  SCAN_DEDUP_MESSAGE,
} from '@/lib/materials/inbound/scan-guards'
import { createMaterialInbound } from '@/lib/materials/inbound/repository'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import type { Material, MaterialSupplyType, MaterialType } from '@/lib/materials/types'
import { formatMaterialDisplayCode, resolveMaterialByInventoryCode } from '@/lib/materials/utils'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { ERP_TABLE_TD_WRAP_CLASS } from '@/lib/ui/tokens'
import { playScanSound } from '@/lib/ui/toast-sound'
import { useToast } from '@/components/ui/toast-provider'

type InboundScanPanelProps = {
  materials: Material[]
  purchaseOrders: MaterialPurchaseOrderListGroup[]
  onSaved: () => void
  onMaterialsChanged: () => void
}

/** 자재별 미입고 구매발주 라인 (납기 빠른 순) */
type OpenPoLine = {
  orderId: string
  orderNumber: string
  supplier: string
  orderDate: string
  deliveryDate: string
  lineId: string
  remaining: number
}

type ScanLine = {
  key: string
  materialId: string
  materialCode: string
  materialName: string
  materialType: MaterialType
  package: string
  specification: string
  mpn: string
  supplyType: MaterialSupplyType
  quantityPerReel: string
  reelCount: string
  quantity: string
  /** null이면 구매발주 미연결 → 사급 입고로 저장 */
  poLine: OpenPoLine | null
}

function buildOpenPoLinesByMaterial(orders: MaterialPurchaseOrderListGroup[]) {
  const map = new Map<string, OpenPoLine[]>()

  for (const order of orders) {
    for (const item of order.items) {
      const materialId = (item.materialId || '').trim()
      if (!materialId || !item.lineId) continue
      const remaining = Math.max(0, (Number(item.quantity) || 0) - (Number(item.inboundQuantity) || 0))
      if (remaining <= 0) continue

      const list = map.get(materialId) ?? []
      list.push({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        supplier: order.supplier,
        orderDate: order.orderDate || '',
        deliveryDate: item.deliveryDate || order.deliveryDate || '',
        lineId: item.lineId,
        remaining,
      })
      map.set(materialId, list)
    }
  }

  for (const list of map.values()) {
    list.sort((a, b) => {
      const deliveryCompare = (a.deliveryDate || '9999-99-99').localeCompare(b.deliveryDate || '9999-99-99')
      if (deliveryCompare !== 0) return deliveryCompare
      return (a.orderDate || '').localeCompare(b.orderDate || '')
    })
  }

  return map
}

function createLineKey() {
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

export function InboundScanPanel({
  materials,
  purchaseOrders,
  onSaved,
  onMaterialsChanged,
}: InboundScanPanelProps) {
  const toast = useToast()
  const [scanCode, setScanCode] = useState('')
  const [lines, setLines] = useState<ScanLine[]>([])
  const [unmatchedScanCode, setUnmatchedScanCode] = useState<string | null>(null)
  const [pendingRetryCode, setPendingRetryCode] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [inboundDate, setInboundDate] = useState(() => todayYmdSeoul())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastScannedKey, setLastScannedKey] = useState<string | null>(null)
  const [scanFocusToken, setScanFocusToken] = useState(0)
  const [scanPulse, setScanPulse] = useState<{ kind: 'success' | 'error'; token: number } | null>(
    null,
  )

  const scanInputRef = useRef<HTMLInputElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const focusGenerationRef = useRef(0)
  const preferScanFocusRef = useRef(false)
  const scanDeduperRef = useRef(createScanDeduper())
  const qtyBurstRef = useRef(createKeyBurstDetector())

  const openPoLinesByMaterial = useMemo(
    () => buildOpenPoLinesByMaterial(purchaseOrders),
    [purchaseOrders],
  )

  function reservedQuantityByPoLine(excludeKey?: string | null) {
    const reserved = new Map<string, number>()
    for (const line of lines) {
      if (excludeKey && line.key === excludeKey) continue
      if (!line.poLine) continue
      reserved.set(
        line.poLine.lineId,
        (reserved.get(line.poLine.lineId) ?? 0) + (Number(line.quantity) || 0),
      )
    }
    return reserved
  }

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

  function resolvePoLine(material: Material, excludeKey?: string | null): OpenPoLine | null {
    if (material.supplyType === '사급') return null
    const candidates = openPoLinesByMaterial.get(material.id) ?? []
    const reserved = reservedQuantityByPoLine(excludeKey)
    return (
      candidates.find(
        (candidate) => candidate.remaining - (reserved.get(candidate.lineId) ?? 0) > 0,
      ) ?? null
    )
  }

  function addMaterialToList(material: Material) {
    const displayCode = formatMaterialDisplayCode(material)
    // 수량 미입력 행만 합침 — 같은 MPN이라도 수량이 다르면 별도 행
    const existingEmptyQty = lines.find(
      (line) => line.materialId === material.id && !(Number(line.quantityPerReel) || 0),
    )
    if (existingEmptyQty) {
      const nextReels = (Number(existingEmptyQty.reelCount) || 0) + 1
      setLines((current) =>
        current.map((line) =>
          line.key === existingEmptyQty.key
            ? {
                ...line,
                reelCount: String(nextReels),
                quantity: computeDirectInboundQuantity(line.quantityPerReel, String(nextReels)),
              }
            : line,
        ),
      )
      setMessage(null)
      markJustScanned(existingEmptyQty.key)
      return
    }

    const quantityPerReel = ''
    const reelCount = '1'
    const poLine = resolvePoLine(material)
    const key = createLineKey()

    setLines((current) => [
      {
        key,
        materialId: material.id,
        materialCode: displayCode,
        materialName: material.materialName,
        materialType: material.type,
        package: material.package,
        specification: material.specification,
        mpn: material.mpn,
        supplyType: material.supplyType,
        quantityPerReel,
        reelCount,
        quantity: computeDirectInboundQuantity(quantityPerReel || '0', reelCount),
        poLine,
      },
      ...current,
    ])
    setMessage(null)
    markJustScanned(key)
  }

  function handleScan(rawCode: string) {
    const code = rawCode.trim()
    if (!code) {
      setMessage({ tone: 'error', text: '바코드를 스캔하거나 품목코드·MPN을 입력해 주세요.' })
      triggerScanPulse('error')
      return
    }

    if (!scanDeduperRef.current.accept(code)) {
      setScanCode('')
      setMessage({ tone: 'error', text: SCAN_DEDUP_MESSAGE })
      triggerScanPulse('error')
      focusScanInput()
      return
    }

    const material = resolveMaterialByInventoryCode(materials, code)
    if (!material) {
      setMessage({ tone: 'error', text: `"${code}" 와 일치하는 자재를 찾지 못했습니다.` })
      setUnmatchedScanCode(code)
      setScanCode('')
      triggerScanPulse('error')
      return
    }

    setUnmatchedScanCode(null)
    setScanCode('')
    addMaterialToList(material)
  }

  function rejectQtyBarcodeInput(key: string) {
    qtyBurstRef.current.reset()
    patchLine(key, { quantityPerReel: '' })
    setMessage({ tone: 'error', text: QTY_BARCODE_REJECT_MESSAGE })
    triggerScanPulse('error')
    focusQuantityInput(key)
  }

  function handleQuantityChange(key: string, rawValue: string) {
    if (/[^0-9]/.test(rawValue) || rawValue.length > 7) {
      rejectQtyBarcodeInput(key)
      return
    }
    patchLine(key, {
      quantityPerReel: rawValue.replace(/^0+(?=\d)/, ''),
    })
  }

  useEffect(() => {
    if (!pendingRetryCode) return
    const material = resolveMaterialByInventoryCode(materials, pendingRetryCode)
    if (!material) return
    setPendingRetryCode(null)
    setUnmatchedScanCode(null)
    addMaterialToList(material)
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

  function handleQuantityKeyDown(event: KeyboardEvent<HTMLInputElement>, key: string) {
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (!/[0-9]/.test(event.key)) {
        event.preventDefault()
        qtyBurstRef.current.noteChar()
        if (qtyBurstRef.current.isBurst()) {
          rejectQtyBarcodeInput(key)
        }
        return
      }
      qtyBurstRef.current.noteChar()
    }

    if (event.key !== 'Enter') return
    event.preventDefault()

    const raw = event.currentTarget.value.trim()
    if (looksLikeBarcodeNotQuantity(raw) || (qtyBurstRef.current.isBurst() && raw.length >= 5)) {
      rejectQtyBarcodeInput(key)
      return
    }

    const qty = Number(raw) || 0
    if (qty <= 0) {
      setMessage({ tone: 'error', text: '수량을 입력해 주세요.' })
      event.currentTarget.focus()
      event.currentTarget.select()
      return
    }

    qtyBurstRef.current.reset()
    setMessage(null)
    // 같은 자재·같은 수량 행이 있으면 릴만 합침 (수량이 다르면 행 유지)
    setLines((current) => {
      const source = current.find((line) => line.key === key)
      if (!source) return current
      const match = current.find(
        (line) =>
          line.key !== key &&
          line.materialId === source.materialId &&
          Math.max(0, Number(line.quantityPerReel) || 0) === qty,
      )
      if (!match) {
        return current.map((line) =>
          line.key === key
            ? {
                ...line,
                quantityPerReel: String(qty),
                quantity: computeDirectInboundQuantity(String(qty), line.reelCount),
              }
            : line,
        )
      }
      const nextReels = (Number(match.reelCount) || 0) + (Number(source.reelCount) || 0)
      return current
        .filter((line) => line.key !== key)
        .map((line) =>
          line.key === match.key
            ? {
                ...line,
                reelCount: String(nextReels),
                quantity: computeDirectInboundQuantity(line.quantityPerReel, String(nextReels)),
              }
            : line,
        )
    })
    setLastScannedKey(null)
    event.currentTarget.blur()
    scanDeduperRef.current.reset()
    focusScanInput()
  }

  function patchLine(key: string, patch: Partial<Pick<ScanLine, 'quantityPerReel' | 'reelCount'>>) {
    setLines((current) =>
      current.map((line) => {
        if (line.key !== key) return line
        const next = { ...line, ...patch }
        next.quantity = computeDirectInboundQuantity(next.quantityPerReel, next.reelCount)
        return next
      }),
    )
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key))
    setLastScannedKey((current) => (current === key ? null : current))
  }

  async function handleSaveAll() {
    if (!lines.length || saving) return

    const invalid = lines.find(
      (line) => (Number(line.quantityPerReel) || 0) <= 0 || (Number(line.reelCount) || 0) <= 0,
    )
    if (invalid) {
      setMessage({
        tone: 'error',
        text: `${invalid.materialCode || invalid.materialName} — 릴과 수량을 입력해 주세요.`,
      })
      return
    }

    for (const line of lines) {
      if (!line.poLine) continue
      const reserved = reservedQuantityByPoLine(line.key)
      const available = line.poLine.remaining - (reserved.get(line.poLine.lineId) ?? 0)
      const quantity = Number(line.quantity) || 0
      if (quantity > available) {
        setMessage({
          tone: 'error',
          text: `입고 수량이 구매발주 잔량을 초과합니다. (${line.poLine.orderNumber} 잔량 ${Math.max(0, available).toLocaleString('ko-KR')}개)`,
        })
        return
      }
    }

    const purchaseGroups = new Map<string, ScanLine[]>()
    const suppliedLines: ScanLine[] = []
    for (const line of lines) {
      if (line.poLine) {
        const group = purchaseGroups.get(line.poLine.orderId) ?? []
        group.push(line)
        purchaseGroups.set(line.poLine.orderId, group)
      } else {
        suppliedLines.push(line)
      }
    }

    setSaving(true)
    setMessage(null)

    const errors: string[] = []
    const savedKeys = new Set<string>()
    const date = inboundDate || todayYmdSeoul()

    for (const [orderId, group] of purchaseGroups) {
      const result = await createMaterialInbound({
        inbound_date: date,
        inbound_type: 'purchase',
        purchase_order_id: orderId,
        note,
        items: group.map((line) => ({
          material_id: line.materialId,
          purchase_order_line_id: line.poLine!.lineId,
          quantity: Number(line.quantity) || 0,
        })),
      })
      if (result.ok) {
        for (const line of group) savedKeys.add(line.key)
      } else {
        errors.push(`${group[0].poLine!.orderNumber}: ${result.detail}`)
      }
    }

    if (suppliedLines.length) {
      const result = await createMaterialInbound({
        inbound_date: date,
        inbound_type: 'supplied',
        purchase_order_id: null,
        note,
        items: suppliedLines.map((line) => ({
          material_id: line.materialId,
          purchase_order_line_id: null,
          quantity: Number(line.quantity) || 0,
        })),
      })
      if (result.ok) {
        for (const line of suppliedLines) savedKeys.add(line.key)
      } else {
        errors.push(`사급 입고: ${result.detail}`)
      }
    }

    setSaving(false)
    setLines((current) => current.filter((line) => !savedKeys.has(line.key)))

    if (errors.length) {
      setMessage({ tone: 'error', text: errors.join(' / ') })
      toast.error('입고 처리 실패', errors.join(' / '))
    } else {
      const totalQty = [...savedKeys].length
      const text = `입고 처리 완료 (${totalQty.toLocaleString('ko-KR')}개 라인)`
      setMessage({
        tone: 'success',
        text,
      })
      toast.success('입고 등록 완료', text)
      setNote('')
    }
    onSaved()
    focusScanInput()
  }

  const totalQuantity = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
  const labelPrintItems = lines.map((line) => ({
    id: line.materialCode || line.materialId,
    materialName: line.materialName,
    mpn: line.mpn,
    copies: Math.max(1, Number(line.reelCount) || 1),
  }))

  const inputClassName =
    'h-8 w-full min-w-0 rounded-md border border-slate-200 px-2 text-right text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100'

  return (
    <div className="flex min-h-[min(70vh,720px)] flex-col">
      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                scanPulse?.kind === 'error' || message?.tone === 'error'
                  ? 'bg-rose-100 text-rose-800'
                  : lastScannedKey
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-600',
              ].join(' ')}
            >
              {scanPulse?.kind === 'error' || message?.tone === 'error'
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
          {message ? (
            <p
              aria-live="polite"
              className={[
                'mt-2 rounded-lg px-3 py-2 text-sm',
                message.tone === 'success'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border border-rose-200 bg-rose-50 text-rose-800',
              ].join(' ')}
            >
              {message.text}
            </p>
          ) : null}
          {unmatchedScanCode ? (
            <div className="mt-3">
              <MaterialBarcodeRegisterPanel
                materials={materials}
                suggestedBarcode={unmatchedScanCode}
                onRegistered={() => {
                  setPendingRetryCode(unmatchedScanCode)
                  onMaterialsChanged()
                }}
              />
            </div>
          ) : null}
        </div>

        <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">품목코드</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">품목명</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-600">공정구분</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">패키지</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">사양</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">MPN</th>
                <th className="px-3 py-2 text-center font-semibold text-slate-600">도급/사급</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">릴 개수</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">수량</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">입고수량</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-16 text-center text-sm text-slate-500">
                    스캔한 자재가 바로 여기에 쌓입니다. 같은 수량의 릴은 합쳐지고, 수량이 다르면 행이 따로 생깁니다.
                  </td>
                </tr>
              ) : (
                lines.map((line) => {
                  const isLatest = line.key === lastScannedKey
                  return (
                  <tr
                    key={line.key}
                    data-scan-key={line.key}
                    className={[
                      'border-t',
                      isLatest
                        ? 'erp-scan-row-latest border-emerald-200 bg-emerald-50 ring-1 ring-inset ring-emerald-300'
                        : 'border-slate-100',
                    ].join(' ')}
                  >
                    <td className={`px-3 py-2 font-mono text-sm font-semibold ${isLatest ? 'text-emerald-900' : 'text-slate-800'} ${ERP_TABLE_TD_WRAP_CLASS}`}>
                      {cell(line.materialCode || line.materialId)}
                    </td>
                    <td className={`px-3 py-2 text-sm font-medium text-slate-900 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                      {cell(line.materialName)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-slate-700">
                      {cell(line.materialType)}
                    </td>
                    <td className={`px-3 py-2 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                      {cell(line.package)}
                    </td>
                    <td className={`px-3 py-2 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                      {cell(line.specification)}
                    </td>
                    <td className={`px-3 py-2 font-mono text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                      {cell(line.mpn)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-slate-700">
                      {cell(line.supplyType)}
                    </td>
                    <td className="w-[88px] px-2 py-2">
                      <QuoteNumericInput
                        min={1}
                        value={line.reelCount || '1'}
                        onChange={(reelCount) =>
                          patchLine(line.key, { reelCount: reelCount.trim() ? reelCount : '1' })
                        }
                        className={inputClassName}
                      />
                    </td>
                    <td className="w-[96px] px-2 py-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        data-qty-input={line.key}
                        value={line.quantityPerReel}
                        onChange={(event) => handleQuantityChange(line.key, event.target.value)}
                        onPaste={(event) => {
                          const text = event.clipboardData.getData('text')
                          if (looksLikeBarcodeNotQuantity(text) || text.trim().length > 7) {
                            event.preventDefault()
                            rejectQtyBarcodeInput(line.key)
                          }
                        }}
                        onFocus={(event) => {
                          qtyBurstRef.current.reset()
                          event.target.select()
                        }}
                        onKeyDown={(event) => handleQuantityKeyDown(event, line.key)}
                        placeholder="수량"
                        className={[
                          inputClassName,
                          isLatest ? 'border-emerald-400 ring-2 ring-emerald-200' : '',
                        ].join(' ')}
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {(Number(line.quantity) || 0).toLocaleString('ko-KR')}
                    </td>
                    <td className="w-10 px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        aria-label="라인 삭제"
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

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">입고일</span>
              <input
                type="date"
                value={inboundDate}
                onChange={(event) => setInboundDate(event.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">비고</span>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="선택 입력"
                className="w-44 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            {labelPrintItems.length > 0 ? <MaterialLabelPrintButton items={labelPrintItems} /> : null}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">
              {lines.length.toLocaleString('ko-KR')}건 · 총{' '}
              <span className="font-semibold text-slate-800">{totalQuantity.toLocaleString('ko-KR')}</span>개
            </p>
            <button
              type="button"
              onClick={() => void handleSaveAll()}
              disabled={saving || !lines.length}
              className="rounded-lg bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:opacity-50"
            >
              {saving ? '처리 중…' : '입고 처리'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
