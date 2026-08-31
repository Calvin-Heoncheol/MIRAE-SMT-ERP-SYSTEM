'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_SCROLL_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

import { SignoffStatusBadge } from '@/components/ui/status-badge'
import type { ExpenseReportListItem } from '@/lib/expense-reports/types'
import { formatExpenseReportMoney, getSignoffStatusLabel } from '@/lib/expense-reports/utils'
import { getExpenseReportProcessingMethodLabel } from '@/lib/expense-reports/processing-methods'

type ExpenseReportListTableProps = {
  reports: ExpenseReportListItem[]
  emptyMessage: string
  onSelectReport?: (report: ExpenseReportListItem) => void
}

export function ExpenseReportListTable({ reports, emptyMessage, onSelectReport }: ExpenseReportListTableProps) {
  if (!reports.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className="erp-data-table min-w-[1040px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                발의일
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                문서번호
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                작성자
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                처리사항
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                영수자
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                합계
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500">
                결재상태
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr
                key={report.id}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/80"
                onClick={() => onSelectReport?.(report)}
              >
                <td className="px-3 py-2.5 text-sm text-slate-700">{report.writtenDate || '-'}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{report.docNumber || report.id}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{report.author || '-'}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700">
                  {getExpenseReportProcessingMethodLabel(report.processingDetails)}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{report.recipient || '-'}</td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {formatExpenseReportMoney(report.totalAmount)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <SignoffStatusBadge label={getSignoffStatusLabel(report.detailInfo.signoffs)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
