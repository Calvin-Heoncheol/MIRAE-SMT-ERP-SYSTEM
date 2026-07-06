'use client'

import { getApprovalCategoryLabel } from '@/lib/approvals/categories'
import type { ApprovalListItem } from '@/lib/approvals/types'
import { formatApprovalMoney, getSignoffStatusLabel } from '@/lib/approvals/utils'

type ApprovalListTableProps = {
  approvals: ApprovalListItem[]
  emptyMessage: string
  onSelectApproval?: (approval: ApprovalListItem) => void
}

export function ApprovalListTable({ approvals, emptyMessage, onSelectApproval }: ApprovalListTableProps) {
  if (!approvals.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">새 품의서 버튼으로 작성할 수 있습니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full border-collapse">
          <thead className="bg-blue-50/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                작성일
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                문서번호
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                카테고리
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                제목
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                작성자
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-blue-800 uppercase">
                결재상태
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-blue-800 uppercase">
                합계금액
              </th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((approval) => (
              <tr
                key={approval.id}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/80"
                onClick={() => onSelectApproval?.(approval)}
              >
                <td className="px-4 py-3 text-sm text-slate-700">{approval.writtenDate || '-'}</td>
                <td className="px-4 py-3 font-mono text-xs text-blue-700">{approval.docNumber || approval.id}</td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {getApprovalCategoryLabel(approval.category)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{approval.subject || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{approval.author || '-'}</td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={[
                      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                      getSignoffStatusLabel(approval.detailInfo.signoffs) === '결재완료'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700',
                    ].join(' ')}
                  >
                    {getSignoffStatusLabel(approval.detailInfo.signoffs)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {formatApprovalMoney(approval.totalAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
