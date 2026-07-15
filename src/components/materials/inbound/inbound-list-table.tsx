'use client'

import { getInboundTypeLabel } from '@/lib/materials/inbound/utils'
import type { MaterialInboundListGroup } from '@/lib/materials/inbound/types'
import { formatInboundMaterialSummary } from '@/lib/materials/inbound/utils'

type InboundListTableProps = {
  inbounds: MaterialInboundListGroup[]
  emptyMessage: string
  onSelectInbound?: (inbound: MaterialInboundListGroup) => void
}

export function InboundListTable({ inbounds, emptyMessage, onSelectInbound }: InboundListTableProps) {
  if (!inbounds.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">입고 등록 내역이 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] table-fixed border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                입고번호
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                입고일
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                유형
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                발주번호
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                품목
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                총 수량
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                비고
              </th>
            </tr>
          </thead>
          <tbody>
            {inbounds.map((inbound) => (
              <tr
                key={inbound.inboundId}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => onSelectInbound?.(inbound)}
              >
                <td className="px-3 py-2.5 font-mono text-sm font-medium text-blue-800">{inbound.inboundNumber}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{inbound.inboundDate}</td>
                <td className="px-3 py-2.5 text-center text-sm font-medium text-slate-700">
                  {getInboundTypeLabel(inbound.inboundType)}
                </td>
                <td className="px-3 py-2.5 font-mono text-sm text-slate-600">
                  {inbound.purchaseOrderNumber || '-'}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-700">
                  <span className="block truncate" title={formatInboundMaterialSummary(inbound)}>
                    {formatInboundMaterialSummary(inbound)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {inbound.totalQuantity.toLocaleString('ko-KR')}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-500">
                  <span className="block truncate" title={inbound.note || '-'}>
                    {inbound.note.trim() || '-'}
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
