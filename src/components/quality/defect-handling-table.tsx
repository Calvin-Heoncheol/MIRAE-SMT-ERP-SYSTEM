'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { ERP_TABLE_SCROLL_CLASS, ERP_TABLE_WRAP_CLASS, ERP_TEXT_WRAP_CLASS } from '@/lib/ui/tokens'
import type { DefectHandlingListItem } from '@/lib/quality/defects/types'
import {
  formatDefectAction,
  formatDefectSourceModule,
  formatDefectStatus,
} from '@/lib/quality/defects/utils'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import { formatSmtPcbSideLabel } from '@/lib/smt/history-utils'
import type { SmtPcbSide } from '@/lib/smt/types'

type DefectHandlingTableProps = {
  rows: DefectHandlingListItem[]
  emptyMessage: string
  onRowClick: (row: DefectHandlingListItem) => void
}

function statusClass(status: DefectHandlingListItem['status']) {
  if (status === 'pending') return 'bg-amber-50 text-amber-800 ring-amber-200'
  if (status === 'hold') return 'bg-slate-100 text-slate-700 ring-slate-200'
  return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
}

export function DefectHandlingTable({ rows, emptyMessage, onRowClick }: DefectHandlingTableProps) {
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
        <table className="w-full min-w-[1100px] border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                기록일
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                공정
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                발주ID
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                고객사
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                제품명
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                불량
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                불량사유
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                대처
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => onRowClick(row)}
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                  {row.recordDate}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                  {formatDefectSourceModule(row.sourceModule)}
                  <span className="text-slate-400"> · {row.team}</span>
                  {row.sourceModule === 'smt' && row.pcbSide ? (
                    <span className="text-slate-400">
                      {' '}
                      · {formatSmtPcbSideLabel(row.pcbSide as SmtPcbSide)}
                      {row.lineNo != null ? ` L${row.lineNo}` : ''}
                    </span>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm font-semibold text-slate-900">
                  {formatInternalCodeLabel(row.orderNumber)}
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TEXT_WRAP_CLASS}`}>
                  {row.customer || '-'}
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TEXT_WRAP_CLASS}`}>
                  {row.productName || row.productCode || '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-semibold text-rose-700">
                  {row.defectQuantity.toLocaleString('ko-KR')}
                </td>
                <td className={`max-w-[16rem] px-3 py-2.5 text-sm text-slate-600 ${ERP_TEXT_WRAP_CLASS}`}>
                  {row.note.trim() || '-'}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                  {formatDefectAction(row.actionType)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${statusClass(row.status)}`}
                  >
                    {formatDefectStatus(row.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
