'use client'

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
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">거래처를 등록하면 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                사업자번호
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                거래처명
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                대표자명
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                업태
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                전화
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                매입/매출
              </th>
            </tr>
          </thead>
          <tbody>
            {partners.map((partner) => (
              <tr
                key={partner.businessRegNo}
                onClick={() => onSelectPartner?.(partner)}
                className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                  onSelectPartner ? 'cursor-pointer' : ''
                }`}
              >
                <td className="whitespace-nowrap px-4 py-2.5 text-sm font-semibold tabular-nums text-slate-800">
                  {formatBusinessRegNo(partner.businessRegNo) || '-'}
                </td>
                <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{cell(partner.name)}</td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{cell(partner.representativeName)}</td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{cell(partner.businessType)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-700">{cell(partner.phone)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm font-medium text-slate-700">
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
