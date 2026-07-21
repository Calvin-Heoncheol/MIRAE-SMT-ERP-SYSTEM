'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { MaterialBarcodeRegisterPanel } from '@/components/materials/material-barcode-register-panel'
import { MaterialLabelPrintButton } from '@/components/materials/material-label-print-button'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import { computeDirectInboundQuantity } from '@/lib/materials/inbound/form-state'
import { createMaterialInbound } from '@/lib/materials/inbound/repository'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import type { Material } from '@/lib/materials/types'
import { resolveMaterialByInventoryCode } from '@/lib/materials/utils'
import { todayYmdSeoul } from '@/lib/orders/utils'

type InboundScanPanelProps = {
  materials: Material[]
  purchaseOrders: MaterialPurchaseOrderListGroup[]
  onSaved: () => void
  onMaterialsChanged: () => void
}

/** 자재별 미입고 발주 라인 (납기 빠른 순) */
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
  materialName: string
  specification: string
  mpn: string
  quantityPerReel: string
  reelCount: string
  quantity: string
  /** null이면 발주 미연결 → 사급 입고로 저장 */
  poLine: OpenPoLine | null
}

type DraftState = {
  line: ScanLine
  /** 목록의 기존 라인을 수정 중이면 그 key */
  editingKey: string | null
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
        deliveryDate: order.deliveryDate || '',
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

export function InboundScanPanel({
  materials,
  purchaseOrders,
  onSaved,
  onMaterialsChanged,
}: InboundScanPanelProps) {
  const [scanCode, setScanCode] = useState('')
  const [lines, setLines] = useState<ScanLine[]>([])
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [unmatchedScanCode, setUnmatchedScanCode] = useState<string | null>(null)
  const [pendingRetryCode, setPendingRetryCode] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [inboundDate, setInboundDate] = useState(() => todayYmdSeoul())
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const scanInputRef = useRef<HTMLInputElement>(null)
  const perReelInputRef = useRef<HTMLInputElement>(null)

  const openPoLinesByMaterial = useMemo(
    () => buildOpenPoLinesByMaterial(purchaseOrders),
    [purchaseOrders],
  )

  /** 발주 라인별로 이미 목록에 잡아둔 수량 (잔량 초과 방지용) */
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
    window.setTimeout(() => scanInputRef.current?.focus(), 0)
  }

  function openDraftForMaterial(material: Material) {
    const candidates = openPoLinesByMaterial.get(material.id) ?? []
    const reserved = reservedQuantityByPoLine()
    const firstAvailable =
      candidates.find((candidate) => candidate.remaining - (reserved.get(candidate.lineId) ?? 0) > 0) ??
      null

    // 같은 자재를 이미 등록했으면 릴당 수량을 이어받아 입력을 줄인다
    const previousLine = [...lines].reverse().find((line) => line.materialId === material.id)

    setDraft({
      editingKey: null,
      line: {
        key: createLineKey(),
        materialId: material.id,
        materialName: material.materialName,
        specification: material.specification,
        mpn: material.mpn,
        quantityPerReel: previousLine?.quantityPerReel || '',
        reelCount: '1',
        quantity: computeDirectInboundQuantity(previousLine?.quantityPerReel || '0', '1'),
        poLine: firstAvailable,
      },
    })
    setMessage({
      tone: 'success',
      text: firstAvailable
        ? `${material.id} · ${material.materialName} — ${firstAvailable.orderNumber} 발주에 매칭됨`
        : `${material.id} · ${material.materialName} — 미입고 발주 없음 (사급 입고로 등록됩니다)`,
    })
    window.setTimeout(() => perReelInputRef.current?.focus(), 0)
  }

  function handleScan(rawCode: string) {
    const code = rawCode.trim()
    if (!code) {
      setMessage({ tone: 'error', text: '바코드를 스캔하거나 자재코드·MPN을 입력해 주세요.' })
      return
    }

    const material = resolveMaterialByInventoryCode(materials, code)
    if (!material) {
      setMessage({ tone: 'error', text: `"${code}" 와 일치하는 자재를 찾지 못했습니다.` })
      setUnmatchedScanCode(code)
      setDraft(null)
      setScanCode('')
      return
    }

    setUnmatchedScanCode(null)
    setScanCode('')

    // 같은 자재가 이미 목록에 있으면 릴 +1 (같은 릴을 연속 스캔하는 빠른 흐름)
    const existing = lines.find(
      (line) => line.materialId === material.id && Number(line.quantityPerReel) > 0,
    )
    if (existing && !draft) {
      const nextReels = (Number(existing.reelCount) || 0) + 1
      setLines((current) =>
        current.map((line) =>
          line.key === existing.key
            ? {
                ...line,
                reelCount: String(nextReels),
                quantity: computeDirectInboundQuantity(line.quantityPerReel, String(nextReels)),
              }
            : line,
        ),
      )
      setMessage({
        tone: 'success',
        text: `${material.materialName} 릴 +1 (총 ${nextReels.toLocaleString('ko-KR')}릴)`,
      })
      focusScanInput()
      return
    }

    openDraftForMaterial(material)
  }

  // 미등록 바코드를 대체 MPN으로 등록한 뒤 materials가 갱신되면 자동 재시도
  useEffect(() => {
    if (!pendingRetryCode) return
    const material = resolveMaterialByInventoryCode(materials, pendingRetryCode)
    if (!material) return
    setPendingRetryCode(null)
    setUnmatchedScanCode(null)
    openDraftForMaterial(material)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materials, pendingRetryCode])

  function handleScanKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleScan(scanCode)
  }

  function patchDraft(patch: Partial<ScanLine>) {
    setDraft((current) => {
      if (!current) return current
      const next = { ...current.line, ...patch }
      if ('quantityPerReel' in patch || 'reelCount' in patch) {
        next.quantity = computeDirectInboundQuantity(next.quantityPerReel, next.reelCount)
      }
      return { ...current, line: next }
    })
  }

  function commitDraft() {
    if (!draft) return
    const { line, editingKey } = draft

    const perReel = Math.max(0, Number(line.quantityPerReel) || 0)
    const reels = Math.max(0, Number(line.reelCount) || 0)
    const quantity = perReel * reels
    if (perReel <= 0) {
      setMessage({ tone: 'error', text: '릴당 수량을 입력해 주세요.' })
      perReelInputRef.current?.focus()
      return
    }
    if (reels <= 0) {
      setMessage({ tone: 'error', text: '릴 개수를 입력해 주세요.' })
      return
    }

    if (line.poLine) {
      const reserved = reservedQuantityByPoLine(editingKey)
      const available = line.poLine.remaining - (reserved.get(line.poLine.lineId) ?? 0)
      if (quantity > available) {
        setMessage({
          tone: 'error',
          text: `입고 수량이 발주 잔량을 초과합니다. (${line.poLine.orderNumber} 잔량 ${Math.max(0, available).toLocaleString('ko-KR')}개)`,
        })
        return
      }
    }

    const committed: ScanLine = { ...line, quantity: String(quantity) }
    setLines((current) => {
      if (editingKey) {
        return current.map((item) => (item.key === editingKey ? committed : item))
      }
      return [committed, ...current]
    })
    setDraft(null)
    setMessage({
      tone: 'success',
      text: `${line.materialName} · ${quantity.toLocaleString('ko-KR')}개 (${reels.toLocaleString('ko-KR')}릴) ${editingKey ? '수정됨' : '추가됨'}`,
    })
    focusScanInput()
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    commitDraft()
  }

  function editLine(line: ScanLine) {
    setUnmatchedScanCode(null)
    setDraft({ editingKey: line.key, line: { ...line } })
    window.setTimeout(() => perReelInputRef.current?.focus(), 0)
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key))
    setDraft((current) => (current?.editingKey === key ? null : current))
  }

  function changeDraftPoLine(lineId: string) {
    if (!draft) return
    if (!lineId) {
      patchDraft({ poLine: null })
      return
    }
    const candidates = openPoLinesByMaterial.get(draft.line.materialId) ?? []
    const next = candidates.find((candidate) => candidate.lineId === lineId) ?? null
    patchDraft({ poLine: next })
  }

  async function handleSaveAll() {
    if (!lines.length || saving) return

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
    } else {
      const totalQty = [...savedKeys].length
      setMessage({
        tone: 'success',
        text: `입고 처리 완료 (${totalQty.toLocaleString('ko-KR')}개 라인)`,
      })
      setNote('')
    }
    onSaved()
    focusScanInput()
  }

  const totalQuantity = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
  const labelPrintItems = lines.map((line) => ({
    id: line.materialId,
    materialName: line.materialName,
    mpn: line.mpn,
    copies: Math.max(1, Number(line.reelCount) || 1),
  }))

  const draftCandidates = draft ? (openPoLinesByMaterial.get(draft.line.materialId) ?? []) : []
  const draftReserved = draft ? reservedQuantityByPoLine(draft.editingKey) : new Map<string, number>()

  const inputClassName =
    'w-full min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* 왼쪽: 스캔 + 입고 목록 */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-slate-800">바코드 스캔</span>
            <input
              ref={scanInputRef}
              value={scanCode}
              onChange={(event) => setScanCode(event.target.value)}
              onKeyDown={handleScanKeyDown}
              placeholder="릴 바코드 스캔 또는 자재코드·MPN 입력 후 Enter"
              autoFocus
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          {message ? (
            <p
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">자재</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600">발주</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">릴당 × 릴</th>
                <th className="px-3 py-2 text-right font-semibold text-slate-600">입고수량</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    스캔한 자재가 여기에 쌓입니다. 같은 자재를 다시 스캔하면 릴 개수가 +1 됩니다.
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr
                    key={line.key}
                    onClick={() => editLine(line)}
                    className={[
                      'cursor-pointer border-t border-slate-100 transition hover:bg-blue-50/50',
                      draft?.editingKey === line.key ? 'bg-blue-50' : '',
                    ].join(' ')}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-800">{line.materialName}</p>
                      <p className="font-mono text-xs text-slate-500">
                        {line.materialId}
                        {line.mpn ? ` · ${line.mpn}` : ''}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      {line.poLine ? (
                        <span className="font-mono text-xs text-blue-700">{line.poLine.orderNumber}</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          사급
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {Number(line.quantityPerReel).toLocaleString('ko-KR')} ×{' '}
                      {Number(line.reelCount).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {Number(line.quantity).toLocaleString('ko-KR')}
                    </td>
                    <td className="w-10 px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          removeLine(line.key)
                        }}
                        className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        aria-label="라인 삭제"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))
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
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '처리 중…' : '입고 처리'}
            </button>
          </div>
        </div>
      </section>

      {/* 오른쪽: 스캔 상세 / 미등록 바코드 등록 */}
      <aside className="space-y-3 xl:sticky xl:top-4">
        {unmatchedScanCode ? (
          <MaterialBarcodeRegisterPanel
            materials={materials}
            suggestedBarcode={unmatchedScanCode}
            onRegistered={() => {
              setPendingRetryCode(unmatchedScanCode)
              onMaterialsChanged()
            }}
          />
        ) : draft ? (
          <section className="rounded-2xl border border-blue-200 bg-white shadow-sm">
            <div className="border-b border-blue-100 bg-blue-50/60 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">
                {draft.editingKey ? '라인 수정' : '스캔 자재'}
              </h3>
              <p className="mt-1 font-mono text-xs text-slate-500">{draft.line.materialId}</p>
            </div>

            <div className="space-y-3 px-4 py-4">
              <div className="text-sm">
                <p className="font-semibold text-slate-900">{draft.line.materialName}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {[draft.line.specification, draft.line.mpn].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">발주 연결</span>
                <select
                  value={draft.line.poLine?.lineId || ''}
                  onChange={(event) => changeDraftPoLine(event.target.value)}
                  className={inputClassName}
                >
                  <option value="">발주 미연결 (사급 입고)</option>
                  {draftCandidates.map((candidate) => {
                    const available = candidate.remaining - (draftReserved.get(candidate.lineId) ?? 0)
                    return (
                      <option key={candidate.lineId} value={candidate.lineId}>
                        {candidate.orderNumber} · 잔량 {Math.max(0, available).toLocaleString('ko-KR')}
                        {candidate.deliveryDate ? ` · 예정 ${candidate.deliveryDate}` : ''}
                      </option>
                    )
                  })}
                </select>
                {draft.line.poLine ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {draft.line.poLine.supplier || '공급업체 미입력'} · 발주 잔량{' '}
                    {Math.max(
                      0,
                      draft.line.poLine.remaining -
                        (draftReserved.get(draft.line.poLine.lineId) ?? 0),
                    ).toLocaleString('ko-KR')}
                    개
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-700">
                    미입고 발주가 없어 사급 입고로 저장됩니다.
                  </p>
                )}
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">릴당 수량</span>
                  <input
                    ref={perReelInputRef}
                    type="text"
                    inputMode="numeric"
                    value={draft.line.quantityPerReel}
                    onChange={(event) =>
                      patchDraft({ quantityPerReel: event.target.value.replace(/[^\d.]/g, '') })
                    }
                    onKeyDown={handleDraftKeyDown}
                    className={`${inputClassName} text-right`}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">릴 개수</span>
                  <QuoteNumericInput
                    min={0}
                    value={draft.line.reelCount}
                    onChange={(reelCount) => patchDraft({ reelCount })}
                    onKeyDown={handleDraftKeyDown}
                    className={`${inputClassName} text-right`}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                <span className="text-slate-600">입고수량</span>
                <span className="text-base font-bold tabular-nums text-slate-900">
                  {(Number(draft.line.quantity) || 0).toLocaleString('ko-KR')}개
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setDraft(null)
                  focusScanInput()
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={commitDraft}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
              >
                {draft.editingKey ? '수정 반영' : '목록에 추가'}
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-5 py-10 text-center">
            <p className="text-sm font-semibold text-slate-700">바코드를 스캔하세요</p>
            <p className="mt-2 text-sm text-slate-500">
              스캔하면 자재 정보와 매칭된 발주가 여기에 표시됩니다.
              <br />
              릴당 수량과 릴 개수를 입력하고 Enter로 목록에 추가하세요.
            </p>
          </section>
        )}
      </aside>
    </div>
  )
}
