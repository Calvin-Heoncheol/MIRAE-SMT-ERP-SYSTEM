import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpTableHead, ErpTableShell, ErpTableTd, ErpTableTh } from '@/components/ui/erp-table'
import type { DeliveryStatementTableGroup } from '@/lib/delivery/history-utils'
import { ERP_CODE_TEXT_CLASS, ERP_TABLE_ROW_CLASS } from '@/lib/ui/tokens'

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
    <ErpTableShell tableClassName="min-w-[960px]">
      <ErpTableHead>
        <tr>
          <ErpTableTh>출하일</ErpTableTh>
          <ErpTableTh>출하번호</ErpTableTh>
          <ErpTableTh>고객사</ErpTableTh>
          <ErpTableTh>품목</ErpTableTh>
          <ErpTableTh align="right">수량</ErpTableTh>
          <ErpTableTh align="right">공급가액</ErpTableTh>
          <ErpTableTh>등록자</ErpTableTh>
        </tr>
      </ErpTableHead>
      <tbody>
        {groups.map((group) => (
          <tr
            key={`${group.source}:${group.shipmentId}`}
            onClick={() => onRowClick?.(group)}
            className={`${ERP_TABLE_ROW_CLASS} ${onRowClick ? 'cursor-pointer' : ''}`}
          >
            <ErpTableTd className="tabular-nums text-slate-700">{cell(group.recordDate)}</ErpTableTd>
            <ErpTableTd className={`${ERP_CODE_TEXT_CLASS} font-semibold`}>
              {cell(group.shipmentId)}
            </ErpTableTd>
            <ErpTableTd text="wrap" className="max-w-[160px] font-semibold text-slate-900">
              {cell(group.customer)}
            </ErpTableTd>
            <ErpTableTd text="wrap" className="max-w-[220px] text-slate-800">
              {cell(group.productName)}
              {group.source === 'legacy' ? (
                <span className="ml-2 text-xs font-semibold text-amber-700">과거</span>
              ) : null}
            </ErpTableTd>
            <ErpTableTd align="right" className="font-bold tabular-nums text-slate-900">
              {group.quantity.toLocaleString('ko-KR')}
            </ErpTableTd>
            <ErpTableTd align="right" className="font-semibold tabular-nums text-slate-900">
              {group.supplyAmount == null ? '…' : group.supplyAmount.toLocaleString('ko-KR')}
            </ErpTableTd>
            <ErpTableTd className="text-slate-600">{cell(group.createdByName)}</ErpTableTd>
          </tr>
        ))}
      </tbody>
    </ErpTableShell>
  )
}
