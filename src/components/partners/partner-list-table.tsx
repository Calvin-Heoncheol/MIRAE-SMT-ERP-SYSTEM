'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_SCROLL_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

import { PARTNER_TRADE_ROLE_LABELS } from '@/lib/partners/types'
import { formatBusinessRegNo } from '@/lib/partners/utils'
import type { BusinessPartner } from '@/lib/partners/types'

type PartnerListTableProps = {
  partners: BusinessPartner[]
  emptyMessage: string
  onSelectPartner?: (partner: BusinessPartner) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

export function PartnerListTable({ partners, emptyMessage, onSelectPartner }: PartnerListTableProps) {
  if (!partners.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className="w-full min-w-[1180px] border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                거래처ID
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                사업자번호
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                거래처명
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                대표자명
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                업태
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                주소
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                전화
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                매입/매출
              </th>
            </tr>
          </thead>
          <tbody>
            {partners.map((partner) => (
              <tr
                key={partner.id || partner.businessRegNo}
                onClick={() => onSelectPartner?.(partner)}
                className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                  onSelectPartner ? 'cursor-pointer' : ''
                }`}
              >
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-medium text-slate-500">
                  {cell(partner.id)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm font-semibold tabular-nums text-slate-800">
                  {formatBusinessRegNo(partner.businessRegNo) || '-'}
                </td>
                <td className="px-3 py-2.5 text-sm font-medium text-slate-900">{cell(partner.name)}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{cell(partner.representativeName)}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{cell(partner.businessType)}</td>
                <td className="max-w-[280px] px-3 py-2.5 text-sm text-slate-700">{cell(partner.address)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">{cell(partner.phone)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm font-medium text-slate-700">
                  {PARTNER_TRADE_ROLE_LABELS[partner.tradeRole]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
