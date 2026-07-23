'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { StatusBadge } from '@/components/ui/status-badge'
import type { NewCompanyInquiry } from '@/lib/new-companies/types'
import {
  NEW_COMPANY_STATUS_BADGE_CLASS,
  NEW_COMPANY_STATUS_LABELS,
} from '@/lib/new-companies/types'
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

export function NewCompanyListTable({
  inquiries,
  emptyMessage,
  onSelectInquiry,
}: NewCompanyListTableProps) {
  if (!inquiries.length) {
    return (
      <EmptyListState message={emptyMessage} />
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] border-collapse text-left text-sm">
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className="px-3 py-2.5">등록일</th>
              <th className="px-3 py-2.5">상태</th>
              <th className="px-3 py-2.5">회사명</th>
              <th className="max-w-[6rem] px-3 py-2.5">지역</th>
              <th className="max-w-[5.5rem] px-3 py-2.5">담당자</th>
              <th className="px-3 py-2.5">이메일</th>
              <th className="px-3 py-2.5">연락처</th>
              <th className="px-3 py-2.5">유입경로</th>
              <th className="max-w-[5.5rem] px-3 py-2.5">등록자</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.map((inquiry) => {
              const contactLabel = cell(inquiry.contactName)
              const registrantLabel = cell(inquiry.createdByName)
              const emailLabel = cell(inquiry.email)
              const regionLabel = cell(inquiry.region)
              return (
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
                    <StatusBadge
                      label={NEW_COMPANY_STATUS_LABELS[inquiry.status]}
                      className={`ring-1 ${NEW_COMPANY_STATUS_BADGE_CLASS[inquiry.status]}`}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">{cell(inquiry.companyName)}</td>
                  <td
                    className="max-w-[6rem] truncate px-3 py-2.5 text-slate-600"
                    title={regionLabel !== '-' ? regionLabel : undefined}
                  >
                    {regionLabel}
                  </td>
                  <td
                    className="max-w-[5.5rem] truncate px-3 py-2.5 text-slate-800"
                    title={contactLabel !== '-' ? contactLabel : undefined}
                  >
                    {contactLabel}
                  </td>
                  <td
                    className="max-w-[12rem] truncate px-3 py-2.5 text-slate-600"
                    title={emailLabel !== '-' ? emailLabel : undefined}
                  >
                    {emailLabel}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-slate-600">{cell(inquiry.phone)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{cell(inquiry.sourceChannel)}</td>
                  <td
                    className="max-w-[5.5rem] truncate px-3 py-2.5 text-slate-600"
                    title={registrantLabel !== '-' ? registrantLabel : undefined}
                  >
                    {registrantLabel}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
