'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpTableHead, ErpTableShell, ErpTableTd, ErpTableTh } from '@/components/ui/erp-table'
import { getOutboundTypeLabel, formatOutboundMaterialSummary } from '@/lib/materials/outbound/utils'
import type { MaterialOutboundListGroup } from '@/lib/materials/outbound/types'
import { ERP_CODE_TEXT_CLASS, ERP_TABLE_ROW_CLASS } from '@/lib/ui/tokens'

type OutboundListTableProps = {
  outbounds: MaterialOutboundListGroup[]
  emptyMessage: string
  onSelectOutbound?: (outbound: MaterialOutboundListGroup) => void
}

export function OutboundListTable({
  outbounds,
  emptyMessage,
  onSelectOutbound,
}: OutboundListTableProps) {
  if (!outbounds.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <ErpTableShell tableClassName="min-w-[1100px]">
      <ErpTableHead>
        <tr>
          <ErpTableTh>불출번호</ErpTableTh>
          <ErpTableTh>불출일</ErpTableTh>
          <ErpTableTh align="center">유형</ErpTableTh>
          <ErpTableTh>발주번호</ErpTableTh>
          <ErpTableTh>품목</ErpTableTh>
          <ErpTableTh align="right">총 수량</ErpTableTh>
          <ErpTableTh>등록자</ErpTableTh>
          <ErpTableTh>비고</ErpTableTh>
        </tr>
      </ErpTableHead>
      <tbody>
        {outbounds.map((outbound) => (
          <tr
            key={outbound.outboundId}
            className={`${ERP_TABLE_ROW_CLASS} cursor-pointer`}
            onClick={() => onSelectOutbound?.(outbound)}
          >
            <ErpTableTd className={`${ERP_CODE_TEXT_CLASS} font-medium`}>
              {outbound.outboundNumber}
            </ErpTableTd>
            <ErpTableTd className="text-slate-700">{outbound.outboundDate}</ErpTableTd>
            <ErpTableTd align="center" className="font-medium text-slate-700">
              {getOutboundTypeLabel(outbound.outboundType)}
            </ErpTableTd>
            <ErpTableTd className={ERP_CODE_TEXT_CLASS}>{outbound.orderNumber || '-'}</ErpTableTd>
            <ErpTableTd text="wrap" className="max-w-[220px] text-slate-700">
              {formatOutboundMaterialSummary(outbound)}
            </ErpTableTd>
            <ErpTableTd align="right" className="font-semibold tabular-nums text-slate-900">
              {outbound.totalQuantity.toLocaleString('ko-KR')}
            </ErpTableTd>
            <ErpTableTd className="text-slate-700">{outbound.createdByName || '-'}</ErpTableTd>
            <ErpTableTd text="wrap" className="max-w-[180px] text-slate-500">
              {outbound.note.trim() || '-'}
            </ErpTableTd>
          </tr>
        ))}
      </tbody>
    </ErpTableShell>
  )
}
