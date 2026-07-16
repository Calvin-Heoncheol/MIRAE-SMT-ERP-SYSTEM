'use client'

import { ITEM_CATEGORY_LABELS } from '@/lib/items/types'
import type { BomListRow } from '@/lib/bom/types'

type BomListTableProps = {
  rows: BomListRow[]
  emptyMessage: string
  onSelectRow?: (row: BomListRow) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '—'
}

function BomStatusBadge({ registered }: { registered: boolean }) {
  if (registered) {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
        등록완료
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
      미등록
    </span>
  )
}

export function BomListTable({ rows, emptyMessage, onSelectRow }: BomListTableProps) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">품목등록에서 반제품·완제품을 먼저 등록해 주세요.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
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
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const quantityTotal = row.lines.reduce((sum, line) => sum + line.quantityPer, 0)

              return (
                <tr
                  key={row.parentProductId}
                  onClick={() => onSelectRow?.(row)}
                  className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                    onSelectRow ? 'cursor-pointer' : ''
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-sm font-semibold text-slate-800">
                    {cell(row.parentProductId)}
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-900">
                    {cell(row.parentProductName)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-center text-sm text-slate-700">
                    {ITEM_CATEGORY_LABELS[row.parentItemCategory]}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-slate-800">
                    {row.bomRegistered ? row.lines.length.toLocaleString('ko-KR') : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-slate-800">
                    {row.bomRegistered ? quantityTotal.toLocaleString('ko-KR') : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-center">
                    <BomStatusBadge registered={row.bomRegistered} />
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
