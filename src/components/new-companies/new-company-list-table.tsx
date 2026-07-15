'use client'

import type { NewCompanyInquiry } from '@/lib/new-companies/types'
import {
  NEW_COMPANY_STATUS_BADGE_CLASS,
  NEW_COMPANY_STATUS_LABELS,
} from '@/lib/new-companies/types'
import { formatInquiryQuantity } from '@/lib/new-companies/utils'
import { ERP_TABLE_HEAD_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

type NewCompanyListTableProps = {
  inquiries: NewCompanyInquiry[]
  emptyMessage: string
  onSelectInquiry?: (inquiry: NewCompanyInquiry) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

function truncate(value: string, max = 40) {
  const trimmed = value.trim()
  if (!trimmed) return '-'
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export function NewCompanyListTable({
  inquiries,
  emptyMessage,
  onSelectInquiry,
}: NewCompanyListTableProps) {
  if (!inquiries.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className="px-3 py-2.5">등록일</th>
              <th className="px-3 py-2.5">상태</th>
              <th className="px-3 py-2.5">회사명</th>
              <th className="px-3 py-2.5">담당자</th>
              <th className="px-3 py-2.5">이메일</th>
              <th className="px-3 py-2.5">연락처</th>
              <th className="px-3 py-2.5">제품</th>
              <th className="px-3 py-2.5 text-right">예상수량</th>
              <th className="px-3 py-2.5">비고</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.map((inquiry) => (
              <tr
                key={inquiry.id}
                className={[
                  'border-t border-slate-100',
                  onSelectInquiry ? 'cursor-pointer hover:bg-slate-50' : '',
                ].join(' ')}
                onClick={onSelectInquiry ? () => onSelectInquiry(inquiry) : undefined}
              >
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-600">
                  {inquiry.createdAt.slice(0, 10)}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={[
                      'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1',
                      NEW_COMPANY_STATUS_BADGE_CLASS[inquiry.status],
                    ].join(' ')}
                  >
                    {NEW_COMPANY_STATUS_LABELS[inquiry.status]}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-medium text-slate-900">{cell(inquiry.companyName)}</td>
                <td className="px-3 py-2.5 text-slate-800">{cell(inquiry.contactName)}</td>
                <td className="px-3 py-2.5 text-slate-600">{cell(inquiry.email)}</td>
                <td className="px-3 py-2.5 tabular-nums text-slate-600">{cell(inquiry.phone)}</td>
                <td className="px-3 py-2.5 text-slate-700">{cell(inquiry.product)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                  {formatInquiryQuantity(inquiry.quantity)}
                </td>
                <td className="max-w-[240px] px-3 py-2.5 text-slate-600" title={inquiry.note}>
                  {truncate(inquiry.note)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
