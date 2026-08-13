'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_SCROLL_CLASS, ERP_TABLE_TD_WRAP_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

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
              <th className="w-[12%] px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                입고번호
              </th>
              <th className="w-[10%] px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                입고일
              </th>
              <th className="w-[8%] px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                유형
              </th>
              <th className="w-[12%] px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                구매발주번호
              </th>
              <th className="w-[22%] px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                품목
              </th>
              <th className="w-[10%] px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                총 수량
              </th>
              <th className="w-[10%] whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                등록자
              </th>
              <th className="w-[16%] px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
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
                <td className="px-3 py-2.5 font-mono text-sm font-medium text-slate-800">{inbound.inboundNumber}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{inbound.inboundDate}</td>
                <td className="px-3 py-2.5 text-center text-sm font-medium text-slate-700">
                  {getInboundTypeLabel(inbound.inboundType)}
                </td>
                <td className="px-3 py-2.5 font-mono text-sm text-slate-600">
                  {inbound.purchaseOrderNumber || '-'}
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  {formatInboundMaterialSummary(inbound)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {inbound.totalQuantity.toLocaleString('ko-KR')}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                  {inbound.createdByName || '-'}
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-500 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  {inbound.note.trim() || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
