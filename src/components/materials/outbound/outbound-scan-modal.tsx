'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ErpModal } from '@/components/ui/erp-modal'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { fetchMaterials } from '@/lib/materials/repository'
import { issueOrderReels, previewOrderReel } from '@/lib/materials/outbound/repository'
import type { Material } from '@/lib/materials/types'
import { createScanDeduper, SCAN_DEDUP_MESSAGE } from '@/lib/materials/inbound/scan-guards'
import type { MaterialOutboundNeedCard, MaterialOutboundNeedRow } from '@/lib/materials/outbound/types'
import { OUTBOUND_MATERIAL_BUCKET_LABELS } from '@/lib/materials/outbound/types'
import {
  ERP_PRIMARY_BUTTON_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'
import { playScanSound } from '@/lib/ui/toast-sound'

type PendingReel = {
  scanCode: string
  reelId: string
  materialId: string
  lineMaterialId: string
  lotNumber: string
  remainingQty: number
}

type OutboundScanModalProps = {
  open: boolean
  action: MaterialOutboundNeedCard | null
  onClose: () => void
  onIssued: () => void
}

function sessionNeed(action: MaterialOutboundNeedCard, line: MaterialOutboundNeedRow, sessionUnits: number) {
  const productQty = action.productQuantity
  return productQty > 0 ? (line.requiredQuantity * sessionUnits) / productQty : 0
}

function alreadyIssuedForSession(
  action: MaterialOutboundNeedCard,
  line: MaterialOutboundNeedRow,
  sessionUnits: number,
) {
  const productQty = action.productQuantity
  const need = sessionNeed(action, line, sessionUnits)
  const issuedUnits = Math.max(0, action.productQuantity - action.remainingProductQuantity)
  const qtyPer = productQty > 0 ? line.requiredQuantity / productQty : 0
  const extraIssued = Math.max(0, line.issuedQuantity - qtyPer * issuedUnits)
  return Math.min(need, extraIssued)
}

function lineRemaining(
  action: MaterialOutboundNeedCard,
  line: MaterialOutboundNeedRow,
  sessionUnits: number,
  pendingQty: number,
) {
  const need = sessionNeed(action, line, sessionUnits)
  const issued = alreadyIssuedForSession(action, line, sessionUnits)
  return Math.max(0, Math.min(line.remainingQuantity, need - issued - pendingQty))
}

function countShortageLines(action: MaterialOutboundNeedCard, units: number) {
  if (units < 1) return 0
  let shortageCount = 0
  for (const line of action.lines) {
    const need = sessionNeed(action, line, units)
    if ((line.onHandQuantity ?? 0) < need) shortageCount += 1
  }
  return shortageCount
}

function matchesMaterialSearch(material: Material, rawQuery: string) {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return true
  return [
    material.id,
    material.baseCode,
    material.materialName,
    material.specification,
    material.mpn,
    ...material.alternateMpns,
  ]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(query))
}

function displayMaterialCode(material: Material) {
  return material.baseCode || material.id
}

export function OutboundScanModal({ open, action, onClose, onIssued }: OutboundScanModalProps) {
  const [scan, setScan] = useState('')
  const [issueUnits, setIssueUnits] = useState('')
  const [workReady, setWorkReady] = useState(false)
  const [sessionUnits, setSessionUnits] = useState(0)
  const [pending, setPending] = useState<PendingReel[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [okMessage, setOkMessage] = useState('')
  const [materials, setMaterials] = useState<Material[]>([])
  const [materialsError, setMaterialsError] = useState('')
  const [alternateByLine, setAlternateByLine] = useState<Record<string, string>>({})
  const [activeAlternateLineId, setActiveAlternateLineId] = useState('')
  const [alternateQuery, setAlternateQuery] = useState('')
  const scanRef = useRef<HTMLInputElement>(null)
  const unitsRef = useRef<HTMLInputElement>(null)
  const deduper = useMemo(() => createScanDeduper(), [])

  useEffect(() => {
    if (!open) return
    setScan('')
    setError('')
    setOkMessage('')
    setSaving(false)
    setIssueUnits('')
    setWorkReady(false)
    setSessionUnits(0)
    setPending([])
    setAlternateByLine({})
    setActiveAlternateLineId('')
    setAlternateQuery('')
  }, [open, action?.key])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      unitsRef.current?.focus()
      unitsRef.current?.select()
    }, 40)
    return () => window.clearTimeout(id)
  }, [open, action?.key])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      const result = await fetchMaterials()
      if (cancelled) return
      if (!result.ok) {
        setMaterials([])
        setMaterialsError(result.detail)
        return
      }
      setMaterials(result.materials)
      setMaterialsError('')
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  const bucketLabel = action ? OUTBOUND_MATERIAL_BUCKET_LABELS[action.materialBucket] : ''
  const allowedMaterialIds = useMemo(
    () => [
      ...new Set([
        ...(action?.lines.map((line) => line.materialId).filter(Boolean) ?? []),
        ...Object.values(alternateByLine).filter(Boolean),
      ]),
    ],
    [action, alternateByLine],
  )
  const issuedUnits = action
    ? Math.max(0, action.productQuantity - action.remainingProductQuantity)
    : 0
  const canWork = workReady && sessionUnits >= 1
  const pendingQtyByLine = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of pending) {
      map.set(item.lineMaterialId, (map.get(item.lineMaterialId) ?? 0) + item.remainingQty)
    }
    return map
  }, [pending])
  const lineByAlternateMaterialId = useMemo(() => {
    const map = new Map<string, string>()
    for (const [lineMaterialId, replacementMaterialId] of Object.entries(alternateByLine)) {
      if (replacementMaterialId) map.set(replacementMaterialId, lineMaterialId)
    }
    return map
  }, [alternateByLine])
  const allCovered = Boolean(
    action &&
      canWork &&
      action.lines.every(
        (line) =>
          lineRemaining(action, line, sessionUnits, pendingQtyByLine.get(line.materialId) ?? 0) <=
          0,
      ),
  )
  const canIssue = allCovered && pending.length > 0

  const previewUnits = canWork ? sessionUnits : Math.floor(Number(issueUnits) || 0)
  const sessionShortage = useMemo(() => {
    if (!action || previewUnits < 1) {
      return { materialCount: action?.lines.length ?? 0, shortageCount: 0 }
    }
    return {
      materialCount: action.lines.length,
      shortageCount: countShortageLines(action, previewUnits),
    }
  }, [action, previewUnits])
  const hasShortage = sessionShortage.shortageCount > 0
  const hasBlockingShortage = useMemo(() => {
    if (!action || !canWork) return false
    return action.lines.some((line) => {
      const need = sessionNeed(action, line, sessionUnits)
      const remaining = lineRemaining(
        action,
        line,
        sessionUnits,
        pendingQtyByLine.get(line.materialId) ?? 0,
      )
      if (remaining <= 0 || need <= 0) return false
      return (line.onHandQuantity ?? 0) < need && !alternateByLine[line.materialId]
    })
  }, [action, alternateByLine, canWork, pendingQtyByLine, sessionUnits])
  const activeAlternateLine =
    action?.lines.find((line) => line.materialId === activeAlternateLineId) ?? null
  const activeAlternateMaterial = activeAlternateLineId
    ? materials.find((material) => material.id === alternateByLine[activeAlternateLineId]) ?? null
    : null
  const alternateOptions = useMemo(() => {
    if (!activeAlternateLine) return []
    return materials
      .filter((material) => {
        if (!material.id || material.id === activeAlternateLine.materialId) return false
        if (Object.entries(alternateByLine).some(([lineId, value]) => lineId !== activeAlternateLine.materialId && value === material.id)) {
          return false
        }
        return matchesMaterialSearch(material, alternateQuery)
      })
      .slice(0, 12)
  }, [activeAlternateLine, alternateByLine, alternateQuery, materials])

  function goToScan() {
    if (!action) return
    const units = Math.floor(Number(issueUnits) || 0)
    if (units < 1) {
      setError('이번 불출 대수를 입력하세요.')
      unitsRef.current?.focus()
      return
    }
    if (units > action.remainingProductQuantity) {
      setError(
        `잔량(${action.remainingProductQuantity.toLocaleString('ko-KR')}대)을 초과할 수 없습니다.`,
      )
      unitsRef.current?.focus()
      return
    }
    setError('')
    setSessionUnits(units)
    setWorkReady(true)
    setPending([])
    window.setTimeout(() => {
      if (countShortageLines(action, units) <= 0) scanRef.current?.focus()
    }, 40)
  }

  function selectAlternateMaterial(line: MaterialOutboundNeedRow, material: Material) {
    setAlternateByLine((current) => ({
      ...current,
      [line.materialId]: material.id,
    }))
    setActiveAlternateLineId('')
    setAlternateQuery('')
    setError('')
    setOkMessage(
      `${line.materialCode || line.materialId} 대체로 ${displayMaterialCode(material)} 선택`,
    )
    window.setTimeout(() => scanRef.current?.focus(), 40)
  }

  function clearAlternateMaterial(lineMaterialId: string) {
    setAlternateByLine((current) => {
      const next = { ...current }
      delete next[lineMaterialId]
      return next
    })
    setError('')
    setOkMessage('')
  }

  async function submitScan() {
    if (!action) return
    if (!canWork) {
      setError('이번 불출 대수를 입력하세요.')
      unitsRef.current?.focus()
      return
    }
    if (hasBlockingShortage) {
      playScanSound('error')
      setError('빨간 행을 눌러 대체 자재를 선택한 뒤 LOT 스캔을 진행하세요.')
      return
    }
    const code = scan.trim()
    if (!code) {
      setError('내부 LOT 라벨을 스캔하세요.')
      return
    }
    if (!deduper.accept(code)) {
      setError(SCAN_DEDUP_MESSAGE)
      return
    }

    setSaving(true)
    setError('')
    setOkMessage('')

    const result = await previewOrderReel({
      allowedMaterialIds,
      scanCode: code,
    })

    setSaving(false)

    if (!result.ok) {
      playScanSound('error')
      setError(result.detail)
      return
    }

    if (pending.some((item) => item.reelId === result.reelId)) {
      playScanSound('error')
      setError('이미 담은 릴입니다.')
      return
    }

    const originalLineMaterialId = lineByAlternateMaterialId.get(result.materialId)
    const line = action.lines.find(
      (item) => item.materialId === result.materialId || item.materialId === originalLineMaterialId,
    )
    if (!line) {
      playScanSound('error')
      setError('이 주문·공정 소요에 없는 자재입니다.')
      return
    }

    const remaining = lineRemaining(
      action,
      line,
      sessionUnits,
      pendingQtyByLine.get(line.materialId) ?? 0,
    )
    if (remaining <= 0) {
      playScanSound('error')
      setError('이미 충분합니다. 이 자재는 더 스캔할 필요가 없습니다.')
      return
    }

    playScanSound('success')
    setPending((current) => [
      ...current,
      {
        scanCode: code,
        reelId: result.reelId,
        materialId: result.materialId,
        lineMaterialId: line.materialId,
        lotNumber: result.lotNumber,
        remainingQty: result.remainingQty,
      },
    ])
    setOkMessage(`${result.lotNumber || result.materialId} 담음`)
    setScan('')
    scanRef.current?.focus()
  }

  async function submitIssue() {
    if (!action || !canIssue) return

    setSaving(true)
    setError('')
    setOkMessage('')

    const result = await issueOrderReels({
      orderId: action.orderId,
      productId: action.productId,
      allowedMaterialIds,
      scanCodes: pending.map((item) => item.scanCode),
      productName: action.productName,
      bucketLabel,
    })

    setSaving(false)

    if (!result.ok) {
      playScanSound('error')
      setError(result.detail)
      return
    }

    playScanSound('success')
    setOkMessage(result.message || result.outboundNumber)
    setPending([])
    onIssued()
    onClose()
  }

  function handleScanKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void submitScan()
  }

  return (
    <>
      <ErpModal
        open={open && Boolean(action)}
        title={`${action?.orderNumber ?? ''} · ${bucketLabel}`}
        description={action ? `${action.customer || '—'} · ${action.productName}` : undefined}
        size="wide"
        onClose={onClose}
        closeOnEscape={!saving}
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4"
      >
        {action ? (
          <div className="flex h-[min(78dvh,880px)] flex-1 gap-4 overflow-hidden">
            <aside className="flex w-[22rem] shrink-0 flex-col gap-3 overflow-y-auto">
            <div className="grid grid-cols-1 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] text-slate-400">주문수량</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
                  {action.productQuantity.toLocaleString('ko-KR')}대
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] text-slate-400">불출수량</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
                  {issuedUnits.toLocaleString('ko-KR')}대
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] text-slate-400">잔량수량</p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
                  {action.remainingProductQuantity.toLocaleString('ko-KR')}대
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">이번 불출</span>
                <div className="flex items-center gap-2">
                  <input
                    ref={unitsRef}
                    type="number"
                    min={1}
                    max={Math.max(1, action.remainingProductQuantity)}
                    step={1}
                    value={issueUnits}
                    disabled={saving}
                    onChange={(event) => {
                      setIssueUnits(event.target.value)
                      setWorkReady(false)
                      setSessionUnits(0)
                      setPending([])
                      setAlternateByLine({})
                      setActiveAlternateLineId('')
                      setAlternateQuery('')
                      setError('')
                      setOkMessage('')
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      goToScan()
                    }}
                    placeholder="예: 20"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-right text-xl font-semibold tabular-nums outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100"
                  />
                  <span className="shrink-0 text-sm font-medium text-slate-500">대</span>
                </div>
              </label>
              {previewUnits >= 1 ? (
                <p className="mt-2 text-sm text-slate-600">
                  자재{' '}
                  <span className="font-semibold tabular-nums text-slate-900">
                    {sessionShortage.materialCount.toLocaleString('ko-KR')}종
                  </span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  부족{' '}
                  <span
                    className={`font-semibold tabular-nums ${
                      sessionShortage.shortageCount > 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {sessionShortage.shortageCount.toLocaleString('ko-KR')}종
                  </span>
                  <span className="ml-1 text-xs text-slate-400">
                    ({previewUnits.toLocaleString('ko-KR')}대 기준)
                  </span>
                </p>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={goToScan}
                className={`mt-3 w-full ${ERP_PRIMARY_BUTTON_CLASS} py-3`}
              >
                스캔하기
              </button>
              {canIssue ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void submitIssue()}
                  className={`mt-2 w-full ${ERP_PRIMARY_BUTTON_CLASS} py-3`}
                >
                  불출하기
                </button>
              ) : null}
              {pending.length > 0 && !canIssue ? (
                <p className="mt-2 text-xs text-slate-500">
                  담은 릴 {pending.length.toLocaleString('ko-KR')}건 · 잔량을 0으로 만들면 불출하기가
                  나타납니다
                </p>
              ) : null}
              {error ? <p className="mt-2 text-sm font-medium text-rose-600">{error}</p> : null}
              {okMessage ? <p className="mt-2 text-sm font-medium text-emerald-700">{okMessage}</p> : null}
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
            {!canWork ? (
              <EmptyListState message="이번 불출 대수를 입력한 뒤 스캔하기를 누르세요" />
            ) : (
              <>
                <div className="shrink-0 border-b border-slate-100 p-4">
                  {hasBlockingShortage ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5">
                      <p className="text-sm font-semibold text-rose-700">
                        부족 자재가 있습니다
                      </p>
                      <p className="mt-1 text-xs text-rose-600">
                        빨간 행을 눌러 대체 자재를 고르거나, 이번 불출 대수를 줄여 주세요.
                      </p>
                    </div>
                  ) : (
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-slate-500">
                        내부 LOT 스캔
                      </span>
                      <input
                        ref={scanRef}
                        type="text"
                        value={scan}
                        disabled={saving}
                        onChange={(event) => {
                          setScan(event.target.value)
                          setError('')
                          setOkMessage('')
                        }}
                        onKeyDown={handleScanKey}
                        placeholder="릴에 붙인 LOT 라벨을 스캔하세요"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3.5 font-mono text-lg outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100"
                      />
                    </label>
                  )}
                </div>

                <div className={`min-h-0 flex-1 ${ERP_TABLE_WRAP_CLASS}`}>
                  <div className={ERP_TABLE_SCROLL_CLASS}>
                    <table className="w-full min-w-[720px] table-fixed border-collapse">
                      <thead className="sticky top-0 z-[1] bg-slate-50">
                        <tr>
                          <th className="w-[24%] px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                            품목코드
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                            자재
                          </th>
                          <th className="w-[14%] px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                            현재고
                          </th>
                          <th className="w-[14%] px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                            소요
                          </th>
                          <th className="w-[14%] px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                            잔량
                          </th>
                          <th className="w-[24%] px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                            대체
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {action.lines.map((line) => {
                          const need = sessionNeed(action, line, sessionUnits)
                          const remaining = lineRemaining(
                            action,
                            line,
                            sessionUnits,
                            pendingQtyByLine.get(line.materialId) ?? 0,
                          )
                          const onHand = line.onHandQuantity ?? 0
                          const filled = remaining <= 0
                          const short = !filled && onHand < need
                          const replacementMaterialId = alternateByLine[line.materialId] || ''
                          const replacementMaterial =
                            materials.find((material) => material.id === replacementMaterialId) ?? null
                          const rowClass = filled
                            ? 'bg-emerald-50'
                            : short
                              ? 'bg-rose-50'
                              : ''
                          const codeClass = filled
                            ? 'text-emerald-800'
                            : short
                              ? 'text-rose-800'
                              : 'text-blue-800'
                          const textClass = filled
                            ? 'text-emerald-800'
                            : short
                              ? 'text-rose-800'
                              : 'text-slate-800'
                          const numClass = filled
                            ? 'font-semibold text-emerald-700'
                            : short
                              ? 'font-semibold text-rose-700'
                              : 'text-slate-600'
                          const remainClass = filled
                            ? 'text-emerald-700'
                            : short
                              ? 'text-rose-700'
                              : 'text-slate-900'
                          const clickable = short ? 'cursor-pointer hover:bg-rose-100' : ''
                          return (
                            <tr
                              key={line.materialId}
                              onClick={() => {
                                if (!short) return
                                setActiveAlternateLineId(line.materialId)
                                setAlternateQuery('')
                              }}
                              className={['border-t border-slate-100', rowClass, clickable].join(' ')}
                            >
                              <td
                                className={`px-3 py-2.5 font-mono text-sm font-medium ${codeClass} ${ERP_TABLE_TD_WRAP_CLASS}`}
                              >
                                {line.materialCode || line.materialId}
                              </td>
                              <td
                                className={`px-3 py-2.5 text-sm ${textClass} ${ERP_TABLE_TD_WRAP_CLASS}`}
                              >
                                {line.materialName || line.materialCode}
                              </td>
                              <td
                                className={`px-3 py-2.5 text-right text-sm tabular-nums ${numClass}`}
                              >
                                {onHand.toLocaleString('ko-KR')}
                              </td>
                              <td
                                className={`px-3 py-2.5 text-right text-sm tabular-nums ${numClass}`}
                              >
                                {need.toLocaleString('ko-KR')}
                              </td>
                              <td
                                className={`px-3 py-2.5 text-right text-sm font-semibold tabular-nums ${remainClass}`}
                              >
                                {remaining.toLocaleString('ko-KR')}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-500">
                                {replacementMaterial ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <span className="rounded-full bg-sky-100 px-2 py-1 font-medium text-sky-700">
                                      대체 {displayMaterialCode(replacementMaterial)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        clearAlternateMaterial(line.materialId)
                                      }}
                                      className="text-slate-500 underline underline-offset-2"
                                    >
                                      해제
                                    </button>
                                  </div>
                                ) : short ? (
                                  <span className="font-medium text-rose-700">클릭해서 대체 선택</span>
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
            </section>
          </div>
        ) : null}
      </ErpModal>
      <ErpModal
        open={open && Boolean(activeAlternateLine)}
        title="대체 자재 선택"
        description={
          activeAlternateLine
            ? `${activeAlternateLine.materialCode || activeAlternateLine.materialId} · ${activeAlternateLine.materialName}`
            : undefined
        }
        size="lg"
        onClose={() => {
          setActiveAlternateLineId('')
          setAlternateQuery('')
        }}
      >
        {activeAlternateLine ? (
          <div className="flex max-h-[70dvh] flex-col overflow-hidden px-5 py-4">
            <input
              type="text"
              value={alternateQuery}
              onChange={(event) => setAlternateQuery(event.target.value)}
              placeholder="품목코드·자재명·MPN 검색"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
            {activeAlternateMaterial ? (
              <p className="mt-2 text-xs text-sky-700">
                현재 선택: {displayMaterialCode(activeAlternateMaterial)} ·{' '}
                {activeAlternateMaterial.materialName}
              </p>
            ) : null}
            {materialsError ? (
              <p className="mt-3 text-sm text-rose-600">{materialsError}</p>
            ) : (
              <div className="mt-3 grid min-h-0 flex-1 gap-2 overflow-y-auto">
                {alternateOptions.length > 0 ? (
                  alternateOptions.map((material) => (
                    <button
                      key={material.id}
                      type="button"
                      onClick={() => selectAlternateMaterial(activeAlternateLine, material)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left hover:border-sky-300 hover:bg-sky-50"
                    >
                      <p className="font-mono text-sm font-semibold text-slate-900">
                        {displayMaterialCode(material)}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-700">{material.materialName}</p>
                      {material.baseCode && material.baseCode !== material.id ? (
                        <p className="mt-0.5 text-xs text-slate-500">내부코드 {material.id}</p>
                      ) : null}
                      <p className="mt-0.5 text-xs text-slate-400">
                        {[material.mpn, material.specification].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                    선택 가능한 대체 자재가 없습니다.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : null}
      </ErpModal>
    </>
  )
}
