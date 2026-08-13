import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_SCROLL_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

import type { PostProcessProductionHistoryRow } from '@/lib/post-process/types'
import { formatPostProcessHistoryDateTime } from '@/lib/post-process/history-utils'

type PostProcessHistoryTableProps = {
  rows: PostProcessProductionHistoryRow[]
  emptyMessage: string
  onRowClick?: (row: PostProcessProductionHistoryRow) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

export function PostProcessHistoryTable({ rows, emptyMessage, onRowClick }: PostProcessHistoryTableProps) {
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
        <table className="min-w-[880px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                기록일
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                등록시각
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                발주ID
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                고객사
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                조립제품명
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                목표
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                양품
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                불량
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                비고
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  'border-t border-slate-100',
                  onRowClick
                    ? 'cursor-pointer hover:bg-emerald-50/70'
                    : 'hover:bg-emerald-50/40',
                ].join(' ')}
                title={onRowClick ? '클릭하여 상세·삭제' : undefined}
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">{cell(row.recordDate)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-slate-600">
                  {formatPostProcessHistoryDateTime(row.createdAt)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-slate-900">
                  {cell(row.orderNumber)}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{cell(row.customer)}</td>
                <td className="px-3 py-2.5 text-sm font-medium text-slate-900">{cell(row.productName)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-700">
                  {row.targetQuantity.toLocaleString('ko-KR')}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-bold tabular-nums text-emerald-700">
                  {row.quantity.toLocaleString('ko-KR')}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-600">
                  {row.defectQuantity > 0 ? row.defectQuantity.toLocaleString('ko-KR') : '-'}
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
