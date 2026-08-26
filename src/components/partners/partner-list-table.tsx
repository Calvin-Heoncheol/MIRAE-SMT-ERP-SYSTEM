'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpTableHead, ErpTableShell, ErpTableTd, ErpTableTh } from '@/components/ui/erp-table'
import { formatBusinessRegNo, formatPartnerPaymentTermLabel } from '@/lib/partners/utils'
import type { BusinessPartner } from '@/lib/partners/types'
import { ERP_TABLE_ROW_CLASS } from '@/lib/ui/tokens'

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
    <ErpTableShell tableClassName="min-w-[640px] md:min-w-[1080px]">
      <ErpTableHead>
        <tr>
          <ErpTableTh>사업자번호</ErpTableTh>
          <ErpTableTh>거래처명</ErpTableTh>
          <ErpTableTh className="hidden sm:table-cell">대표자명</ErpTableTh>
          <ErpTableTh className="hidden md:table-cell">업태</ErpTableTh>
          <ErpTableTh className="hidden lg:table-cell">주소</ErpTableTh>
          <ErpTableTh className="hidden sm:table-cell">전화</ErpTableTh>
          <ErpTableTh className="hidden md:table-cell">결제조건</ErpTableTh>
        </tr>
      </ErpTableHead>
      <tbody>
        {partners.map((partner) => (
          <tr
            key={partner.id || partner.businessRegNo}
            onClick={() => onSelectPartner?.(partner)}
            className={`${ERP_TABLE_ROW_CLASS} ${onSelectPartner ? 'cursor-pointer' : ''}`}
          >
            <ErpTableTd className="font-semibold text-slate-800">
              {formatBusinessRegNo(partner.businessRegNo) || '-'}
            </ErpTableTd>
            <ErpTableTd className="font-medium text-slate-900">{cell(partner.name)}</ErpTableTd>
            <ErpTableTd className="hidden text-slate-700 sm:table-cell">
              {cell(partner.representativeName)}
            </ErpTableTd>
            <ErpTableTd className="hidden text-slate-700 md:table-cell">
              {cell(partner.businessType)}
            </ErpTableTd>
            <ErpTableTd text="wrap" className="hidden max-w-[280px] text-slate-700 lg:table-cell">
              {cell(partner.address)}
            </ErpTableTd>
            <ErpTableTd className="hidden text-slate-700 sm:table-cell">
              {cell(partner.phone)}
            </ErpTableTd>
            <ErpTableTd className="hidden text-slate-700 md:table-cell">
              {cell(formatPartnerPaymentTermLabel(partner))}
            </ErpTableTd>
          </tr>
        ))}
      </tbody>
    </ErpTableShell>
  )
}
