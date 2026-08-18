import { EmptyListState } from '@/components/ui/empty-list-state'

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
        <table className="min-w-[1100px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                출하일
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                출하번호
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                발주ID
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                고객사
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                품목명
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                출하수량
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                LOT
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                등록자
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                비고
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
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">{cell(row.recordDate)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-800">
                  {cell(row.shipmentId || row.id)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-slate-900">
                  {cell(row.orderNumber)}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{cell(row.customer)}</td>
                <td className="px-3 py-2.5 text-sm font-medium text-slate-900">{cell(row.productName)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-bold tabular-nums text-slate-900">
                  {row.quantity.toLocaleString('ko-KR')}
                </td>
                <td className="px-3 py-2.5 text-xs tabular-nums text-slate-700">{cell(row.lotLabel)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                  {cell(row.createdByName)}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-600">{cell(row.note)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

