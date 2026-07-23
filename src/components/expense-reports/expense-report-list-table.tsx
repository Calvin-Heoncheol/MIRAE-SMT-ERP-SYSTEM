'use client'

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
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">새 지출결의서 버튼으로 작성할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                발의일
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                문서번호
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                작성자
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                처리사항
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                영수자
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                결재상태
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-blue-800 uppercase">
                합계
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
                <td className="px-4 py-3 text-sm text-slate-700">{report.writtenDate || '-'}</td>
                <td className="px-4 py-3 font-mono text-xs text-blue-700">{report.docNumber || report.id}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{report.author || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {getExpenseReportProcessingMethodLabel(report.processingDetails)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{report.recipient || '-'}</td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={[
                      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                      getSignoffStatusLabel(report.detailInfo.signoffs) === '결재완료'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700',
                    ].join(' ')}
                  >
                    {getSignoffStatusLabel(report.detailInfo.signoffs)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {formatExpenseReportMoney(report.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
