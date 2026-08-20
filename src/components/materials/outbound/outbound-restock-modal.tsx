'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ErpModal } from '@/components/ui/erp-modal'
import { restockOrderReel } from '@/lib/materials/outbound/repository'
import { createScanDeduper, SCAN_DEDUP_MESSAGE } from '@/lib/materials/inbound/scan-guards'
import { ERP_PRIMARY_BUTTON_CLASS } from '@/lib/ui/tokens'
import { playScanSound } from '@/lib/ui/toast-sound'

type OutboundRestockModalProps = {
  open: boolean
  orderId: string
  orderNumber: string
  customer: string
  allowedMaterialIds: string[]
  productName?: string
  onClose: () => void
  onRestocked: () => void
}

export function OutboundRestockModal({
  open,
  orderId,
  orderNumber,
  customer,
  allowedMaterialIds,
  productName,
  onClose,
  onRestocked,
}: OutboundRestockModalProps) {
  const [scan, setScan] = useState('')
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [okMessage, setOkMessage] = useState('')
  const scanRef = useRef<HTMLInputElement>(null)
  const qtyRef = useRef<HTMLInputElement>(null)
  const deduper = useMemo(() => createScanDeduper(), [])

  const scanned = scan.trim().length > 0

  useEffect(() => {
    if (!open) return
    setScan('')
    setQty('')
    setError('')
    setOkMessage('')
    setSaving(false)
    const id = window.setTimeout(() => scanRef.current?.focus(), 40)
    return () => window.clearTimeout(id)
  }, [open, orderId])

  async function submit() {
    const code = scan.trim()
    const leftoverQty = Math.floor(Number(qty) || 0)
    if (!code) {
      setError('반납할 릴 LOT을 스캔하세요.')
      scanRef.current?.focus()
      return
    }
    if (leftoverQty < 1) {
      setError('반납 수량을 입력하세요.')
      qtyRef.current?.focus()
      return
    }
    if (!deduper.accept(code)) {
      setError(SCAN_DEDUP_MESSAGE)
      return
    }

    setSaving(true)
    setError('')
    setOkMessage('')

    const result = await restockOrderReel({
      orderId,
      allowedMaterialIds,
      scanCode: code,
      leftoverQty,
      productName,
    })

    setSaving(false)

    if (!result.ok) {
      playScanSound('error')
      setError(result.detail)
      return
    }

    playScanSound('success')
    setOkMessage(result.message || '반납되었습니다.')
    setScan('')
    setQty('')
    onRestocked()
    scanRef.current?.focus()
  }

  function handleScanKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (!scan.trim()) {
      setError('반납할 릴 LOT을 스캔하세요.')
      return
    }
    setError('')
    qtyRef.current?.focus()
    qtyRef.current?.select()
  }

  return (
    <ErpModal
      open={open}
      title={`${orderNumber} · 잔량반납`}
      description={`${customer || '—'} · LOT을 스캔한 뒤 반납 수량을 입력하세요`}
      size="form"
      onClose={onClose}
      closeOnEscape={!saving}
    >
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
          placeholder="반납할 릴 LOT을 스캔하세요"
          className="w-full rounded-xl border border-slate-200 px-4 py-3.5 font-mono text-lg outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100"
        />
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-medium text-slate-500">반납 수량</span>
        <input
          ref={qtyRef}
          type="number"
          min={1}
          step={1}
          value={qty}
          disabled={saving || !scanned}
          onChange={(event) => {
            setQty(event.target.value)
            setError('')
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            void submit()
          }}
          placeholder="예: 600"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-right text-xl font-semibold tabular-nums outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-100"
        />
      </label>

      <button
        type="button"
        disabled={saving || !scanned}
        onClick={() => void submit()}
        className={`mt-4 w-full ${ERP_PRIMARY_BUTTON_CLASS} py-3`}
      >
        {saving ? '처리 중…' : '반납'}
      </button>

      {error ? <p className="mt-2 text-sm font-medium text-rose-600">{error}</p> : null}
      {okMessage ? <p className="mt-2 text-sm font-medium text-emerald-700">{okMessage}</p> : null}
    </ErpModal>
  )
}
