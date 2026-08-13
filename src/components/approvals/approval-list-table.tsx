'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_SCROLL_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

import { CategoryBadge } from '@/components/ui/category-badge'
import { SignoffStatusBadge } from '@/components/ui/status-badge'
import {
  APPROVAL_CATEGORY_BADGE_CLASS,
  getApprovalCategoryShortLabel,
} from '@/lib/approvals/categories'
import type { ApprovalListItem } from '@/lib/approvals/types'
import { formatApprovalMoney, getSignoffStatusLabel } from '@/lib/approvals/utils'

type ApprovalListTableProps = {
  approvals: ApprovalListItem[]
  emptyMessage: string
  onSelectApproval?: (approval: ApprovalListItem) => void
  /** 카테고리 탭으로 이미 걸러진 경우 열 숨김 */
  hideCategory?: boolean
}

export function ApprovalListTable({
  approvals,
  emptyMessage,
  onSelectApproval,
  hideCategory = false,
}: ApprovalListTableProps) {
  if (!approvals.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className="min-w-[1040px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                작성일
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                문서번호
              </th>
              {!hideCategory ? (
                <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  카테고리
                </th>
              ) : null}
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                제목
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                작성자
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                합계(VAT포함)
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                결재상태
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
                <td className="px-3 py-2.5 text-sm text-slate-700">{approval.writtenDate || '-'}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-700">
                  {approval.docNumber || approval.id}
                </td>
                {!hideCategory ? (
                  <td className="px-3 py-2.5 text-center">
                    <CategoryBadge
                      label={getApprovalCategoryShortLabel(approval.category)}
                      className={APPROVAL_CATEGORY_BADGE_CLASS[approval.category]}
                    />
                  </td>
                ) : null}
                <td className="px-3 py-2.5 text-sm text-slate-700">{approval.subject || '-'}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{approval.author || '-'}</td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {formatApprovalMoney(approval.totalAmount)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <SignoffStatusBadge label={getSignoffStatusLabel(approval.detailInfo.signoffs)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
