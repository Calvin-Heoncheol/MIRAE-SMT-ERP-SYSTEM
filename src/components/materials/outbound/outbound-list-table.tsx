'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

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
      <EmptyListState message={emptyMessage} hint="불출 등록 내역이 여기에 표시됩니다." />
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] table-fixed border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                불출번호
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                불출일
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                유형
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                주문번호
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                품목
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                총 수량
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                등록자
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
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
                <td className="px-3 py-2.5 text-sm text-slate-700">
                  <span className="block truncate" title={formatOutboundMaterialSummary(outbound)}>
                    {formatOutboundMaterialSummary(outbound)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {outbound.totalQuantity.toLocaleString('ko-KR')}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                  {outbound.createdByName || '-'}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-500">
                  <span className="block truncate" title={outbound.note || '-'}>
                    {outbound.note.trim() || '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
