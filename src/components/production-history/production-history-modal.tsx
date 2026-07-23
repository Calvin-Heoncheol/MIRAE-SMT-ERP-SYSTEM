'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import type { ProductionHistoryRow } from '@/lib/production-history/types'
import { deletePostProcessProductionRecord } from '@/lib/post-process/repository'
import { formatSmtPcbSideLabel } from '@/lib/smt/history-utils'
import { deleteSmtProductionRecord } from '@/lib/smt/repository'

type ProductionHistoryModalProps = {
  open: boolean
  row: ProductionHistoryRow | null
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

export function ProductionHistoryModal({
  open,
  row,
  onClose,
  onDeleted,
}: ProductionHistoryModalProps) {
  const canDelete = useCanDeleteRecords()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setDeleting(false)
  }, [open, row?.id, row?.module])

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

    const result =
      row.module === 'smt'
        ? await deleteSmtProductionRecord(row.id)
        : await deletePostProcessProductionRecord(row.id)
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
      description={`${row.team} · ${formatInternalCodeLabel(row.orderNumber)} · ${row.customer || '—'}`}
      size="form"
      onClose={onClose}
      closeOnEscape={!deleting}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {canDelete ? (
            <ErpButton type="button" variant="danger" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? '삭제 중…' : '삭제'}
            </ErpButton>
          ) : (
            <span />
          )}
          <ErpButton type="button" variant="secondary" disabled={deleting} onClick={onClose}>
            닫기
          </ErpButton>
        </div>
      }
    >
      <dl>
        <DetailRow label="팀" value={row.team} />
        <DetailRow label="기록일" value={row.recordDate || '-'} />
        <DetailRow label="주문서번호" value={formatInternalCodeLabel(row.orderNumber)} />
        <DetailRow label="고객사" value={row.customer || '-'} />
        <DetailRow label="제품명" value={row.productName || '-'} />
        <DetailRow label="품목코드" value={row.productCode || '-'} />
        {row.module === 'smt' ? (
          <>
            <DetailRow label="라인" value={row.lineNo != null ? String(row.lineNo) : '-'} />
            <DetailRow
              label="면구분"
              value={row.pcbSide ? formatSmtPcbSideLabel(row.pcbSide) : '-'}
            />
          </>
        ) : null}
        <DetailRow label="양품" value={`${row.quantity.toLocaleString('ko-KR')}대`} />
        <DetailRow
          label="불량"
          value={
            row.defectQuantity > 0 ? `${row.defectQuantity.toLocaleString('ko-KR')}대` : '-'
          }
        />
        <DetailRow label="등록자" value={row.createdByName || '-'} />
        <DetailRow label="비고" value={row.note || '-'} />
      </dl>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
    </ErpModal>
  )
}
