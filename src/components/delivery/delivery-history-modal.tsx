'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import {
  deleteDeliveryRecord,
  fetchOrderLineUnitPrice,
  updateDeliveryRecord,
} from '@/lib/delivery/repository'
import {
  buildDeliveryStatementData,
  printDeliveryStatement,
} from '@/lib/delivery/print-delivery-statement'
import type { DeliveryHistoryRow } from '@/lib/delivery/types'

type DeliveryHistoryModalProps = {
  open: boolean
  row: DeliveryHistoryRow | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

function formatMoneyInput(value: number) {
  return Math.max(0, Math.round(Number(value) || 0)).toLocaleString('ko-KR')
}

function parseMoneyInput(value: string) {
  const parsed = Math.round(Number(String(value).replace(/[^\d]/g, '')) || 0)
  return Math.max(0, parsed)
}

export function DeliveryHistoryModal({
  open,
  row,
  onClose,
  onSaved,
  onDeleted,
}: DeliveryHistoryModalProps) {
  const canDelete = useCanDeleteRecords()
  const [recordDate, setRecordDate] = useState('')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [unitPrice, setUnitPrice] = useState('0')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !row) return
    setRecordDate(row.recordDate)
    setQuantity(String(row.quantity))
    setNote(row.note)
    setUnitPrice('0')
    setSaveError(null)

    void fetchOrderLineUnitPrice(row.orderNumber, row.productCode).then((result) => {
      if (result.ok && result.unitPrice > 0) {
        setUnitPrice(String(result.unitPrice))
      }
    })
  }, [open, row])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving && !deleting) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose, saving, deleting])

  if (!open || !row) return null

  const qtyNumber = Math.floor(Number(quantity) || 0)
  const unitPriceNumber = parseMoneyInput(unitPrice)
  const supplyAmount = Math.round(qtyNumber * unitPriceNumber)

  function handlePrintStatement() {
    const ok = printDeliveryStatement(
      buildDeliveryStatementData({
        row: {
          docNo: row!.id,
          shipDate: recordDate || row!.recordDate,
          orderNumber: row!.orderNumber,
          customer: row!.customer,
          productName: row!.productName,
          productCode: row!.productCode,
          qty: qtyNumber,
          note,
        },
        unitPrice: unitPriceNumber,
      }),
    )

    if (!ok) {
      setSaveError('거래명세서를 열 수 없습니다. 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요.')
    }
  }

  async function handleSave() {
    if (!row) return
    const value = Math.floor(Number(quantity) || 0)
    if (value < 1) {
      setSaveError('출하 수량은 1 이상이어야 합니다.')
      return
    }

    setSaving(true)
    setSaveError(null)

    const result = await updateDeliveryRecord(row.id, {
      recordDate,
      quantity: value,
      note,
    })

    setSaving(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onSaved?.()
  }

  async function handleDelete() {
    if (!row) return
    if (
      !window.confirm(
        `${row.id} 출하 기록을 삭제하시겠습니까?\n삭제 후 누적 출하 수량이 함께 반영됩니다.`,
      )
    ) {
      return
    }

    setDeleting(true)
    setSaveError(null)

    const result = await deleteDeliveryRecord(row.id)
    setDeleting(false)

    if (!result.ok) {
      setSaveError(result.detail)
      return
    }

    onDeleted?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-history-modal-title"
        className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="delivery-history-modal-title" className="text-lg font-bold text-slate-900">
              출하 수정
            </h2>
            <p className="mt-1 font-mono text-xs text-slate-700">
              출하번호 {row.id} <span className="text-slate-400">(수정 불가)</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrintStatement}
              disabled={saving || deleting || qtyNumber < 1}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 disabled:opacity-50"
            >
              거래명세서
            </button>
            {canDelete ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting || saving}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">기록일</span>
              <input
                type="date"
                value={recordDate}
                onChange={(event) => setRecordDate(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">출하 수량</span>
              <input
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums"
              />
            </label>
            <div className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">주문 / 고객 / 완제품</span>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                <p>
                  <span className="font-semibold text-slate-900">{row.orderNumber}</span>
                  <span className="text-slate-400"> · </span>
                  {row.customer || '-'}
                </p>
                <p className="mt-1 font-medium text-slate-900">{row.productName || '-'}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {row.productCode || '-'} · 목표 {row.targetQuantity.toLocaleString('ko-KR')}대
                </p>
              </div>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">단가 (거래명세서)</span>
              <input
                type="text"
                inputMode="numeric"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value.replace(/[^\d,]/g, ''))}
                onBlur={() => setUnitPrice(String(parseMoneyInput(unitPrice)))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 tabular-nums"
              />
            </label>
            <div className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">공급가액 (거래명세서)</span>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-base font-bold tabular-nums text-slate-800">
                ₩{formatMoneyInput(supplyAmount)}
              </div>
            </div>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">비고</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
        </div>

        <div className="border-t border-slate-200 px-5 py-4">
          {saveError ? <p className="mb-3 text-sm text-red-600">{saveError}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || deleting}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
