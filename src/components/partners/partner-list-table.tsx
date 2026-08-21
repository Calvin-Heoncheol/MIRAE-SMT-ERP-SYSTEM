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
    <ErpTableShell tableClassName="min-w-[1080px]">
      <ErpTableHead>
        <tr>
          <ErpTableTh>사업자번호</ErpTableTh>
          <ErpTableTh>거래처명</ErpTableTh>
          <ErpTableTh>대표자명</ErpTableTh>
          <ErpTableTh>업태</ErpTableTh>
          <ErpTableTh>주소</ErpTableTh>
          <ErpTableTh>전화</ErpTableTh>
          <ErpTableTh>결제조건</ErpTableTh>
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
            <ErpTableTd className="text-slate-700">{cell(partner.representativeName)}</ErpTableTd>
            <ErpTableTd className="text-slate-700">{cell(partner.businessType)}</ErpTableTd>
            <ErpTableTd text="wrap" className="max-w-[280px] text-slate-700">
              {cell(partner.address)}
            </ErpTableTd>
            <ErpTableTd className="text-slate-700">{cell(partner.phone)}</ErpTableTd>
            <ErpTableTd className="text-slate-700">{cell(formatPartnerPaymentTermLabel(partner))}</ErpTableTd>
          </tr>
        ))}
      </tbody>
    </ErpTableShell>
  )
}
