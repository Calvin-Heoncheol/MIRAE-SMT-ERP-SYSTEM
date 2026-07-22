'use client'

import { useEffect, useState } from 'react'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import {
  formatPostProcessHistoryDateTime,
  formatPostProcessProductionSourceLabel,
} from '@/lib/post-process/history-utils'
import { deletePostProcessProductionRecord } from '@/lib/post-process/repository'
import type { PostProcessProductionHistoryRow } from '@/lib/post-process/types'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'

type PostProcessHistoryModalProps = {
  open: boolean
  row: PostProcessProductionHistoryRow | null
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

export function PostProcessHistoryModal({
  open,
  row,
  onClose,
  onDeleted,
}: PostProcessHistoryModalProps) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setDeleting(false)
  }, [open, row?.id])

  if (!row) return null

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

    const result = await deletePostProcessProductionRecord(row.id)
    setDeleting(false)

    if (!result.ok) {
      setError(result.detail)
      return
    }

    onDeleted?.()
  }

  return (
    <ErpModal
      open={open}
      title="생산이력 상세"
      description={`${formatInternalCodeLabel(row.orderNumber)} · ${row.customer || '—'}`}
      size="form"
      onClose={onClose}
      closeOnEscape={!deleting}
      footer={
        <div className="flex w-full flex-col gap-2">
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ErpButton variant="danger" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? '삭제 중…' : '삭제'}
            </ErpButton>
            <ErpButton variant="secondary" disabled={deleting} onClick={onClose}>
              닫기
            </ErpButton>
          </div>
        </div>
      }
    >
      <dl>
        <DetailRow label="기록일" value={row.recordDate || '—'} />
        <DetailRow label="등록시각" value={formatPostProcessHistoryDateTime(row.createdAt)} />
        <DetailRow label="완제품명" value={row.productName.trim() || row.productCode.trim() || '—'} />
        <DetailRow label="생산팀" value={row.team.trim() || '—'} />
        <DetailRow label="목표" value={`${row.targetQuantity.toLocaleString('ko-KR')}대`} />
        <DetailRow label="양품" value={`${row.quantity.toLocaleString('ko-KR')}대`} />
        <DetailRow label="불량" value={`${row.defectQuantity.toLocaleString('ko-KR')}대`} />
        <DetailRow label="등록경로" value={formatPostProcessProductionSourceLabel(row.source)} />
        <DetailRow label="비고" value={row.note.trim() || '—'} />
      </dl>
    </ErpModal>
  )
}
