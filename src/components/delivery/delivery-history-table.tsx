import { EmptyListState } from '@/components/ui/empty-list-state'
import { ERP_TABLE_SCROLL_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'
import {
  statementTableRowKey,
  type DeliveryStatementTableGroup,
} from '@/lib/delivery/history-utils'

type DeliveryHistoryTableProps = {
  groups: DeliveryStatementTableGroup[]
  emptyMessage: string
  onRowClick?: (group: DeliveryStatementTableGroup) => void
  selectedIds?: Set<string>
  onToggleSelect?: (key: string) => void
  onToggleSelectAll?: () => void
  selectionDisabled?: boolean
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '—'
}

export function DeliveryHistoryTable({
  groups,
  emptyMessage,
  onRowClick,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  selectionDisabled = false,
}: DeliveryHistoryTableProps) {
  const selectable = Boolean(selectedIds && onToggleSelect)
  const allSelected =
    selectable && groups.length > 0 && groups.every((group) => selectedIds!.has(statementTableRowKey(group)))

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
              {selectable ? (
                <th className="w-10 px-3 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={selectionDisabled}
                    onChange={() => onToggleSelectAll?.()}
                    aria-label="전체 선택"
                    className="size-4 accent-slate-700"
                  />
                </th>
              ) : null}
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
            {groups.map((group) => {
              const key = statementTableRowKey(group)
              const selected = selectable && selectedIds!.has(key)
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(group)}
                  className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                    onRowClick ? 'cursor-pointer' : ''
                  } ${selected ? 'bg-sky-50/50' : ''}`}
                >
                  {selectable ? (
                    <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={selectionDisabled}
                        onChange={() => onToggleSelect?.(key)}
                        aria-label={`${group.shipmentId} 선택`}
                        className="size-4 accent-slate-700"
                      />
                    </td>
                  ) : null}
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
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
