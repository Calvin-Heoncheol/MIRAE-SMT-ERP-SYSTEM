import { EmptyListState } from '@/components/ui/empty-list-state'

import { displayOrderPoNumber } from '@/lib/orders/utils'
import { ERP_TABLE_SCROLL_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

import type { DeliveryHistoryRow } from '@/lib/delivery/types'

type DeliveryHistoryTableProps = {
  rows: DeliveryHistoryRow[]
  emptyMessage: string
  onRowClick?: (row: DeliveryHistoryRow) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

export function DeliveryHistoryTable({ rows, emptyMessage, onRowClick }: DeliveryHistoryTableProps) {
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
        <table className="min-w-[840px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                출하일
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                발주번호
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                고객사
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                품목
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                수량
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                명세서
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                  {cell(row.recordDate)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-slate-900">
                  {cell(displayOrderPoNumber(row.customerPoNumber, row.orderNumber))}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{cell(row.customer)}</td>
                <td className="px-3 py-2.5 text-sm font-medium text-slate-900">
                  <span className="block">{cell(row.productName)}</span>
                  {row.productCode ? (
                    <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                      {row.productCode}
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-bold tabular-nums text-slate-900">
                  {row.quantity.toLocaleString('ko-KR')}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-800">
                  {cell(row.shipmentId || row.id)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
