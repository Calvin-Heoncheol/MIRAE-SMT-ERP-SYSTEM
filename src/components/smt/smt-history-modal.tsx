'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import {
  formatSmtHistoryDateTime,
  formatSmtPcbSideLabel,
  formatSmtProductionSourceLabel,
} from '@/lib/smt/history-utils'
import { deleteSmtProductionRecord } from '@/lib/smt/repository'
import type { SmtProductionHistoryRow } from '@/lib/smt/types'

type SmtHistoryModalProps = {
  open: boolean
  row: SmtProductionHistoryRow | null
  onClose: () => void
  onDeleted?: () => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  )
}

export function SmtHistoryModal({ open, row, onClose, onDeleted }: SmtHistoryModalProps) {
  const canDelete = useCanDeleteRecords()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setDeleting(false)

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deleting) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose, deleting])

  if (!open || !row) return null

  async function handleDelete() {
    if (!row) return
    if (
      !window.confirm(
        `${formatInternalCodeLabel(row.orderNumber)} · ${row.productName || row.productCode}\n` +
          `양품 ${row.quantity.toLocaleString('ko-KR')}대 기록을 삭제하시겠습니까?`,
      )
    ) {
      return
    }

    setDeleting(true)
    setError(null)

    const result = await deleteSmtProductionRecord(row.id)
    setDeleting(false)

    if (!result.ok) {
      setError(result.detail)
      return
    }

    onDeleted?.()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="smt-history-modal-title"
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="smt-history-modal-title" className="text-lg font-bold text-slate-900">
              생산이력 상세
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {formatInternalCodeLabel(row.orderNumber)} · {row.customer || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <dl className="px-5 py-2">
          <DetailRow label="기록일" value={row.recordDate || '—'} />
          <DetailRow label="등록시각" value={formatSmtHistoryDateTime(row.createdAt)} />
          <DetailRow label="제품명" value={row.productName.trim() || row.productCode.trim() || '—'} />
          <DetailRow label="라인" value={row.lineNo != null ? `라인 ${row.lineNo}` : '—'} />
          <DetailRow label="면구분" value={formatSmtPcbSideLabel(row.pcbSide)} />
          <DetailRow label="양품" value={`${row.quantity.toLocaleString('ko-KR')}대`} />
          <DetailRow label="불량" value={`${row.defectQuantity.toLocaleString('ko-KR')}대`} />
          <DetailRow label="등록경로" value={formatSmtProductionSourceLabel(row.source)} />
          <DetailRow label="비고" value={row.note.trim() || '—'} />
        </dl>

        {error ? (
          <p className="px-5 pb-2 text-sm font-medium text-red-700">{error}</p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-4">
          {canDelete ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? '삭제 중…' : '삭제'}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
