'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatOrderMoney } from '@/lib/orders/utils'
import type { ReceivableRow } from '@/lib/accounting/types'
import { RECEIVABLE_STATUS_BADGE_CLASS, RECEIVABLE_STATUS_LABELS } from '@/lib/accounting/types'
import {
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_ROW_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TD_FIXED_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

type ReceivablesTableProps = {
  rows: ReceivableRow[]
  emptyMessage: string
  onRowClick: (row: ReceivableRow) => void
}

export function ReceivablesTable({ rows, emptyMessage, onRowClick }: ReceivablesTableProps) {
  if (!rows.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className={`${ERP_TABLE_CLASS} min-w-[1080px]`}>
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>출하번호</th>
              <th className={ERP_TABLE_TH_CLASS}>고객사</th>
              <th className={ERP_TABLE_TH_CLASS}>품목</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>발행일</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>입금예정일</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right`}>공급가액</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right`}>입금액</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right`}>잔액</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const overdueDate = row.status === 'overdue' && row.expectedDate
              return (
                <tr
                  key={row.shipmentId}
                  className={`${ERP_TABLE_ROW_CLASS} cursor-pointer`}
                  onClick={() => onRowClick(row)}
                >
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-semibold text-slate-800`}>
                    {row.shipmentId}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_WRAP_CLASS}`}>{row.customer || '-'}</td>
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_WRAP_CLASS}`}>{row.productName || '-'}</td>
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>{row.issueDate || '-'}</td>
                  <td
                    className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} ${
                      overdueDate ? 'font-semibold text-rose-700' : ''
                    }`}
                  >
                    {row.expectedDate || '-'}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right tabular-nums`}>
                    {formatOrderMoney(row.amount)}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right tabular-nums text-sky-700`}>
                    {formatOrderMoney(row.paidAmount)}
                  </td>
                  <td
                    className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right tabular-nums font-semibold ${
                      row.remaining > 0 ? 'text-slate-900' : 'text-emerald-700'
                    }`}
                  >
                    {formatOrderMoney(row.remaining)}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
                    <StatusBadge
                      label={RECEIVABLE_STATUS_LABELS[row.status]}
                      className={RECEIVABLE_STATUS_BADGE_CLASS[row.status]}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
