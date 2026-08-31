'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import {
  ORDER_PROGRESS_STATUS_LABELS,
  type OrderProgressRow,
  type OrderProgressStatus,
} from '@/lib/orders/progress'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import {
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_FIXED_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

type OrderProgressTableProps = {
  rows: OrderProgressRow[]
  emptyMessage: string
}

function statusBadgeClass(status: OrderProgressStatus) {
  if (status === 'done') return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
  if (status === 'partial') return 'bg-amber-50 text-amber-800 ring-amber-200'
  return 'bg-slate-100 text-slate-600 ring-slate-200'
}

export function OrderProgressTable({ rows, emptyMessage }: OrderProgressTableProps) {
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
        <table className="erp-data-table min-w-[960px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>발주번호</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>고객사</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>납기</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>제품</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-right`}>발주수량</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-right`}>출하누적</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-right`}>잔량</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-center`}>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const done = row.status === 'done'
              return (
                <tr key={row.orderId} className="border-t border-slate-100">
                  <td className={`px-3 py-2.5 text-sm text-slate-800 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                    <div className="font-medium">
                      {displayOrderPoNumber(row.customerPoNumber, row.orderNumber)}
                    </div>
                    {row.customerPoNumber ? (
                      <div className="mt-0.5 text-xs text-slate-400">{row.orderNumber}</div>
                    ) : null}
                  </td>
                  <td className={`px-3 py-2.5 text-sm text-slate-800 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                    {row.customer || '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_FIXED_CLASS}`}>
                    <DeliveryDueBadge deliveryDate={row.deliveryDate} done={done} />
                  </td>
                  <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                    {row.productSummary}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-800">
                    {row.orderedQuantity.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-800">
                    {row.shippedQuantity.toLocaleString('ko-KR')}
                  </td>
                  <td
                    className={[
                      'px-3 py-2.5 text-right text-sm font-semibold tabular-nums',
                      row.remainingQuantity > 0 ? 'text-rose-700' : 'text-emerald-700',
                    ].join(' ')}
                  >
                    {row.remainingQuantity.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusBadgeClass(row.status)}`}
                    >
                      {ORDER_PROGRESS_STATUS_LABELS[row.status]}
                    </span>
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
