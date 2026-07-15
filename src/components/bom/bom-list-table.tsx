'use client'

import { ITEM_CATEGORY_LABELS } from '@/lib/items/types'
import type { BomGroup } from '@/lib/bom/types'

type BomListTableProps = {
  groups: BomGroup[]
  emptyMessage: string
  onSelectGroup?: (group: BomGroup) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '—'
}

export function BomListTable({ groups, emptyMessage, onSelectGroup }: BomListTableProps) {
  if (!groups.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">BOM을 등록하면 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                부모코드
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                부모명
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                부모구분
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                구성개수
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                소요량
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const quantityTotal = group.lines.reduce((sum, line) => sum + line.quantityPer, 0)

              return (
              <tr
                key={group.parentProductId}
                onClick={() => onSelectGroup?.(group)}
                className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                  onSelectGroup ? 'cursor-pointer' : ''
                }`}
              >
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm font-semibold text-slate-800">
                  {cell(group.parentProductId)}
                </td>
                <td className="px-4 py-2.5 text-sm font-medium text-slate-900">
                  {cell(group.parentProductName)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm text-slate-700">
                  {ITEM_CATEGORY_LABELS[group.parentItemCategory]}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-slate-800">
                  {group.lines.length.toLocaleString('ko-KR')}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-slate-800">
                  {quantityTotal.toLocaleString('ko-KR')}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
