'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpTableHead, ErpTableShell, ErpTableTd, ErpTableTh } from '@/components/ui/erp-table'
import { CategoryBadge } from '@/components/ui/category-badge'
import { SignoffStatusBadge } from '@/components/ui/status-badge'
import {
  APPROVAL_CATEGORY_BADGE_CLASS,
  getApprovalCategoryShortLabel,
} from '@/lib/approvals/categories'
import type { ApprovalListItem } from '@/lib/approvals/types'
import { formatApprovalMoney, getSignoffStatusLabel } from '@/lib/approvals/utils'
import { ERP_CODE_TEXT_CLASS, ERP_TABLE_ROW_CLASS } from '@/lib/ui/tokens'

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
    <ErpTableShell tableClassName="min-w-[1040px]">
      <ErpTableHead>
        <tr>
          <ErpTableTh>작성일</ErpTableTh>
          <ErpTableTh>문서번호</ErpTableTh>
          {!hideCategory ? <ErpTableTh align="center">카테고리</ErpTableTh> : null}
          <ErpTableTh>제목</ErpTableTh>
          <ErpTableTh>작성자</ErpTableTh>
          <ErpTableTh align="right">합계(VAT포함)</ErpTableTh>
          <ErpTableTh align="center">결재상태</ErpTableTh>
        </tr>
      </ErpTableHead>
      <tbody>
        {approvals.map((approval) => (
          <tr
            key={approval.id}
            className={`${ERP_TABLE_ROW_CLASS} cursor-pointer`}
            onClick={() => onSelectApproval?.(approval)}
          >
            <ErpTableTd className="text-slate-700">{approval.writtenDate || '-'}</ErpTableTd>
            <ErpTableTd className={ERP_CODE_TEXT_CLASS}>
              {approval.docNumber || approval.id}
            </ErpTableTd>
            {!hideCategory ? (
              <ErpTableTd align="center">
                <CategoryBadge
                  label={getApprovalCategoryShortLabel(approval.category)}
                  className={APPROVAL_CATEGORY_BADGE_CLASS[approval.category]}
                />
              </ErpTableTd>
            ) : null}
            <ErpTableTd text="wrap" className="max-w-[240px] text-slate-700">
              {approval.subject || '-'}
            </ErpTableTd>
            <ErpTableTd className="text-slate-700">{approval.author || '-'}</ErpTableTd>
            <ErpTableTd align="right" className="font-semibold tabular-nums text-slate-900">
              {formatApprovalMoney(approval.totalAmount)}
            </ErpTableTd>
            <ErpTableTd align="center">
              <SignoffStatusBadge label={getSignoffStatusLabel(approval.detailInfo.signoffs)} />
            </ErpTableTd>
          </tr>
        ))}
      </tbody>
    </ErpTableShell>
  )
}
