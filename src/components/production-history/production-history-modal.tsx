'use client'

import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { ProductionHistoryRow } from '@/lib/production-history/types'
import { formatProductionHistoryRecordAt } from '@/lib/production-history/utils'
import { formatSmtPcbSideLabel } from '@/lib/smt/history-utils'
import { ERP_TEXT_WRAP_CLASS } from '@/lib/ui/tokens'

type ProductionHistoryModalProps = {
  open: boolean
  row: ProductionHistoryRow | null
  onClose: () => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2.5 last:border-b-0">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className={`${ERP_TEXT_WRAP_CLASS} text-sm font-semibold text-slate-900`}>{value}</dd>
    </div>
  )
}

export function ProductionHistoryModal({ open, row, onClose }: ProductionHistoryModalProps) {
  if (!row) return null

  return (
    <ErpModal
      open={open}
      title="생산이력 상세"
      description={`${row.team} · ${displayOrderPoNumber(row.customerPoNumber, row.orderNumber)} · ${row.customer || '—'}`}
      size="form"
      onClose={onClose}
      footer={
        <ErpButton type="button" variant="secondary" onClick={onClose}>
          닫기
        </ErpButton>
      }
    >
      <dl>
        <DetailRow label="팀" value={row.team} />
        <DetailRow label="기록일" value={formatProductionHistoryRecordAt(row)} />
        <DetailRow
          label="발주번호"
          value={displayOrderPoNumber(row.customerPoNumber, row.orderNumber) || '-'}
        />
        <DetailRow label="고객사" value={row.customer || '-'} />
        <DetailRow label="제품명" value={row.productName || '-'} />
        <DetailRow label="품목코드" value={row.productCode || '-'} />
        <DetailRow label="출하번호" value={row.shipmentLabel || '-'} />
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
      </dl>
    </ErpModal>
  )
}
