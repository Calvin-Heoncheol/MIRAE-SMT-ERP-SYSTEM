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
        <table className="w-full min-w-[980px] border-collapse">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase">
                부모코드
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase">
                부모명
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-700 uppercase">
                부모구분
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase">
                구성코드
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-700 uppercase">
                구성명
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-700 uppercase">
                구성구분
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-700 uppercase">
                소요량
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) =>
              group.lines.map((line, index) => (
                <tr
                  key={`${line.parentProductId}-${line.childProductId}`}
                  onClick={() => onSelectGroup?.(group)}
                  className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                    onSelectGroup ? 'cursor-pointer' : ''
                  } ${index === 0 ? 'border-t-slate-200' : ''}`}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm font-semibold text-slate-800">
                    {index === 0 ? cell(group.parentProductId) : ''}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-900">
                    {index === 0 ? cell(group.parentProductName) : ''}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm text-slate-700">
                    {index === 0 ? ITEM_CATEGORY_LABELS[group.parentItemCategory] : ''}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm text-slate-800">
                    {cell(line.childProductId)}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-800">{cell(line.childProductName)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm text-slate-700">
                    {ITEM_CATEGORY_LABELS[line.childItemCategory]}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-slate-800">
                    {line.quantityPer.toLocaleString('ko-KR')}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
