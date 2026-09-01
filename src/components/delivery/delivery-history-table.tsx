import { EmptyListState } from '@/components/ui/empty-list-state'
import { ERP_TABLE_SCROLL_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'
import type { DeliveryStatementTableGroup } from '@/lib/delivery/history-utils'

type DeliveryHistoryTableProps = {
  groups: DeliveryStatementTableGroup[]
  emptyMessage: string
  onRowClick?: (group: DeliveryStatementTableGroup) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '—'
}

export function DeliveryHistoryTable({
  groups,
  emptyMessage,
  onRowClick,
}: DeliveryHistoryTableProps) {
  if (!groups.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className="erp-data-table min-w-[880px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                출하일
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                출하번호
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">고객사</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">품목</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                수량
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                공급가액
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr
                key={`${group.source}:${group.shipmentId}`}
                onClick={() => onRowClick?.(group)}
                className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-slate-700">
                  {cell(group.recordDate)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold text-slate-800">
                  {cell(group.shipmentId)}
                </td>
                <td className="px-3 py-2.5 text-sm font-semibold text-slate-900">
                  {cell(group.customer)}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-800">
                  {cell(group.productName)}
                  {group.source === 'legacy' ? (
                    <span className="ml-2 text-xs font-semibold text-amber-700">과거</span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-bold tabular-nums text-slate-900">
                  {group.quantity.toLocaleString('ko-KR')}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {group.supplyAmount == null
                    ? '…'
                    : group.supplyAmount.toLocaleString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
