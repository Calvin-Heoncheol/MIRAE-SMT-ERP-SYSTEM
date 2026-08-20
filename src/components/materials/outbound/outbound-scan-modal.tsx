'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ErpModal } from '@/components/ui/erp-modal'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { issueOrderReels, previewOrderReel } from '@/lib/materials/outbound/repository'
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

export function OutboundScanModal({ open, action, onClose, onIssued }: OutboundScanModalProps) {
  const [scan, setScan] = useState('')
  const [issueUnits, setIssueUnits] = useState('')
  const [workReady, setWorkReady] = useState(false)
  const [sessionUnits, setSessionUnits] = useState(0)
  const [pending, setPending] = useState<PendingReel[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [okMessage, setOkMessage] = useState('')
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
  }, [open, action?.key])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => {
      unitsRef.current?.focus()
      unitsRef.current?.select()
    }, 40)
    return () => window.clearTimeout(id)
  }, [open, action?.key])

  const bucketLabel = action ? OUTBOUND_MATERIAL_BUCKET_LABELS[action.materialBucket] : ''
  const allowedMaterialIds = action?.lines.map((line) => line.materialId).filter(Boolean) ?? []
  const issuedUnits = action
    ? Math.max(0, action.productQuantity - action.remainingProductQuantity)
    : 0
  const canWork = workReady && sessionUnits >= 1
  const pendingQtyByMaterial = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of pending) {
      map.set(item.materialId, (map.get(item.materialId) ?? 0) + item.remainingQty)
    }
    return map
  }, [pending])
  const allCovered = Boolean(
    action &&
      canWork &&
      action.lines.every(
        (line) =>
          lineRemaining(action, line, sessionUnits, pendingQtyByMaterial.get(line.materialId) ?? 0) <=
          0,
      ),
  )
  const canIssue = allCovered && pending.length > 0

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
    window.setTimeout(() => scanRef.current?.focus(), 40)
  }

  async function submitScan() {
    if (!action) return
    if (!canWork) {
      setError('이번 불출 대수를 입력하세요.')
      unitsRef.current?.focus()
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

    const line = action.lines.find((item) => item.materialId === result.materialId)
    if (!line) {
      playScanSound('error')
      setError('이 주문·공정 소요에 없는 자재입니다.')
      return
    }

    const remaining = lineRemaining(
      action,
      line,
      sessionUnits,
      pendingQtyByMaterial.get(line.materialId) ?? 0,
    )
    if (remaining <= 0) {
      playScanSound('error')
      setError('이 자재는 이미 잔량 0입니다.')
      return
    }

    playScanSound('success')
    setPending((current) => [
      ...current,
      {
        scanCode: code,
        reelId: result.reelId,
        materialId: result.materialId,
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
                      setError('')
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
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-500">내부 LOT 스캔</span>
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
                </div>

                <div className={`min-h-0 flex-1 ${ERP_TABLE_WRAP_CLASS}`}>
                  <div className={ERP_TABLE_SCROLL_CLASS}>
                    <table className="w-full min-w-[520px] table-fixed border-collapse">
                      <thead className="sticky top-0 z-[1] bg-slate-50">
                        <tr>
                          <th className="w-[28%] px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                            품목코드
                          </th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                            자재
                          </th>
                          <th className="w-[16%] px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                            소요
                          </th>
                          <th className="w-[16%] px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                            잔량
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
                            pendingQtyByMaterial.get(line.materialId) ?? 0,
                          )
                          return (
                            <tr key={line.materialId} className="border-t border-slate-100">
                              <td
                                className={`px-3 py-2.5 font-mono text-sm font-medium text-blue-800 ${ERP_TABLE_TD_WRAP_CLASS}`}
                              >
                                {line.materialCode || line.materialId}
                              </td>
                              <td
                                className={`px-3 py-2.5 text-sm text-slate-800 ${ERP_TABLE_TD_WRAP_CLASS}`}
                              >
                                {line.materialName || line.materialCode}
                              </td>
                              <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-600">
                                {need.toLocaleString('ko-KR')}
                              </td>
                              <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                                {remaining.toLocaleString('ko-KR')}
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
  )
}
