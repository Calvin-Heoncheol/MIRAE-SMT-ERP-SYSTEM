'use client'

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
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">불출 등록 내역이 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] table-fixed border-collapse">
          <thead className="bg-orange-50/80">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-orange-900 uppercase">
                불출번호
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-orange-900 uppercase">
                불출일
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide text-orange-900 uppercase">
                유형
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-orange-900 uppercase">
                주문번호
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-orange-900 uppercase">
                품목
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold tracking-wide text-orange-900 uppercase">
                총 수량
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-orange-900 uppercase">
                비고
              </th>
            </tr>
          </thead>
          <tbody>
            {outbounds.map((outbound) => (
              <tr
                key={outbound.outboundId}
                className="cursor-pointer border-t border-slate-100 hover:bg-orange-50/40"
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
