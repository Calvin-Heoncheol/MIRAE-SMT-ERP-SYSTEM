'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_SCROLL_CLASS, ERP_TABLE_TD_WRAP_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

import { getOutboundTypeLabel, formatOutboundMaterialSummary } from '@/lib/materials/outbound/utils'
import type { MaterialOutboundListGroup } from '@/lib/materials/outbound/types'

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
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className="w-full min-w-[1000px] table-fixed border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="w-[12%] px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                불출번호
              </th>
              <th className="w-[10%] px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                불출일
              </th>
              <th className="w-[8%] px-3 py-2.5 text-center text-xs font-semibold text-slate-500">
                유형
              </th>
              <th className="w-[12%] px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                발주번호
              </th>
              <th className="w-[22%] px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                품목
              </th>
              <th className="w-[10%] px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                총 수량
              </th>
              <th className="w-[10%] whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                등록자
              </th>
              <th className="w-[16%] px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                비고
              </th>
            </tr>
          </thead>
          <tbody>
            {outbounds.map((outbound) => (
              <tr
                key={outbound.outboundId}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => onSelectOutbound?.(outbound)}
              >
                <td className="px-3 py-2.5 font-mono text-sm font-medium text-orange-800">
                  {outbound.outboundNumber}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{outbound.outboundDate}</td>
                <td className="px-3 py-2.5 text-center text-sm font-medium text-slate-700">
                  {getOutboundTypeLabel(outbound.outboundType)}
                </td>
                <td className="px-3 py-2.5 font-mono text-sm text-slate-600">
                  {outbound.orderNumber || '-'}
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  {formatOutboundMaterialSummary(outbound)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {outbound.totalQuantity.toLocaleString('ko-KR')}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                  {outbound.createdByName || '-'}
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-500 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  {outbound.note.trim() || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
