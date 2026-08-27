'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpTableHead, ErpTableShell, ErpTableTd, ErpTableTh } from '@/components/ui/erp-table'
import { getInboundTypeLabel, formatInboundMaterialSummary } from '@/lib/materials/inbound/utils'
import type { MaterialInboundListGroup } from '@/lib/materials/inbound/types'
import { ERP_TABLE_ROW_CLASS } from '@/lib/ui/tokens'

type InboundListTableProps = {
  inbounds: MaterialInboundListGroup[]
  emptyMessage: string
  onSelectInbound?: (inbound: MaterialInboundListGroup) => void
}

export function InboundListTable({ inbounds, emptyMessage, onSelectInbound }: InboundListTableProps) {
  if (!inbounds.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <ErpTableShell tableClassName="min-w-[720px] md:min-w-[1080px]">
      <ErpTableHead>
        <tr>
          <ErpTableTh>입고번호</ErpTableTh>
          <ErpTableTh>입고일</ErpTableTh>
          <ErpTableTh align="center">유형</ErpTableTh>
          <ErpTableTh className="hidden sm:table-cell">구매발주번호</ErpTableTh>
          <ErpTableTh>품목</ErpTableTh>
          <ErpTableTh align="right">총 수량</ErpTableTh>
          <ErpTableTh className="hidden md:table-cell">등록자</ErpTableTh>
          <ErpTableTh className="hidden lg:table-cell">비고</ErpTableTh>
        </tr>
      </ErpTableHead>
      <tbody>
        {inbounds.map((inbound) => (
          <tr
            key={inbound.inboundId}
            className={`${ERP_TABLE_ROW_CLASS} cursor-pointer`}
            onClick={() => onSelectInbound?.(inbound)}
          >
            <ErpTableTd className="font-mono font-medium text-slate-800">
              {inbound.inboundNumber}
            </ErpTableTd>
            <ErpTableTd className="text-slate-700">{inbound.inboundDate}</ErpTableTd>
            <ErpTableTd align="center" className="font-medium text-slate-700">
              {getInboundTypeLabel(inbound.inboundType)}
            </ErpTableTd>
            <ErpTableTd className="hidden font-mono text-slate-600 sm:table-cell">
              {inbound.purchaseOrderNumber || '-'}
            </ErpTableTd>
            <ErpTableTd text="wrap" className="max-w-[220px] text-slate-700">
              {formatInboundMaterialSummary(inbound)}
            </ErpTableTd>
            <ErpTableTd align="right" className="font-semibold tabular-nums text-slate-900">
              {inbound.totalQuantity.toLocaleString('ko-KR')}
            </ErpTableTd>
            <ErpTableTd className="hidden text-slate-700 md:table-cell">
              {inbound.createdByName || '-'}
            </ErpTableTd>
            <ErpTableTd text="wrap" className="hidden max-w-[180px] text-slate-500 lg:table-cell">
              {inbound.note.trim() || '-'}
            </ErpTableTd>
          </tr>
        ))}
      </tbody>
    </ErpTableShell>
  )
}
