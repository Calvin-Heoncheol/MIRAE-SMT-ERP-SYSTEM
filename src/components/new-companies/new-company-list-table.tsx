'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpTableHead, ErpTableShell, ErpTableTd, ErpTableTh } from '@/components/ui/erp-table'
import { StatusBadge } from '@/components/ui/status-badge'
import type { NewCompanyInquiry } from '@/lib/new-companies/types'
import {
  NEW_COMPANY_STATUS_BADGE_CLASS,
  NEW_COMPANY_STATUS_LABELS,
} from '@/lib/new-companies/types'
import { ERP_TABLE_ROW_CLASS } from '@/lib/ui/tokens'

type NewCompanyListTableProps = {
  inquiries: NewCompanyInquiry[]
  emptyMessage: string
  onSelectInquiry?: (inquiry: NewCompanyInquiry) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

export function NewCompanyListTable({
  inquiries,
  emptyMessage,
  onSelectInquiry,
}: NewCompanyListTableProps) {
  if (!inquiries.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <ErpTableShell tableClassName="min-w-[1060px]">
      <ErpTableHead>
        <tr>
          <ErpTableTh>등록일</ErpTableTh>
          <ErpTableTh>회사명</ErpTableTh>
          <ErpTableTh>지역</ErpTableTh>
          <ErpTableTh>담당자</ErpTableTh>
          <ErpTableTh>이메일</ErpTableTh>
          <ErpTableTh>연락처</ErpTableTh>
          <ErpTableTh>제품</ErpTableTh>
          <ErpTableTh>유입경로</ErpTableTh>
          <ErpTableTh>상태</ErpTableTh>
        </tr>
      </ErpTableHead>
      <tbody>
        {inquiries.map((inquiry) => (
          <tr
            key={inquiry.id}
            className={`${ERP_TABLE_ROW_CLASS} ${onSelectInquiry ? 'cursor-pointer' : ''}`}
            onClick={onSelectInquiry ? () => onSelectInquiry(inquiry) : undefined}
          >
            <ErpTableTd className="tabular-nums text-slate-600">
              {inquiry.createdAt.slice(0, 10)}
            </ErpTableTd>
            <ErpTableTd text="wrap" className="max-w-[180px] font-medium text-slate-900">
              {cell(inquiry.companyName)}
            </ErpTableTd>
            <ErpTableTd text="wrap" className="max-w-[120px] text-slate-600">
              {cell(inquiry.region)}
            </ErpTableTd>
            <ErpTableTd text="wrap" className="max-w-[120px] text-slate-800">
              {cell(inquiry.contactName)}
            </ErpTableTd>
            <ErpTableTd text="wrap" className="max-w-[180px] text-slate-600">
              {cell(inquiry.email)}
            </ErpTableTd>
            <ErpTableTd className="tabular-nums text-slate-600">{cell(inquiry.phone)}</ErpTableTd>
            <ErpTableTd text="wrap" className="max-w-[160px] text-slate-600">
              {cell(inquiry.product)}
            </ErpTableTd>
            <ErpTableTd text="wrap" className="max-w-[120px] text-slate-600">
              {cell(inquiry.sourceChannel)}
            </ErpTableTd>
            <ErpTableTd>
              <StatusBadge
                label={NEW_COMPANY_STATUS_LABELS[inquiry.status]}
                className={`ring-1 ${NEW_COMPANY_STATUS_BADGE_CLASS[inquiry.status]}`}
              />
            </ErpTableTd>
          </tr>
        ))}
      </tbody>
    </ErpTableShell>
  )
}
