'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

import { CategoryBadge } from '@/components/ui/category-badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { ITEM_CATEGORY_BADGE_CLASS, ITEM_CATEGORY_LABELS } from '@/lib/items/types'
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
  return (
    <StatusBadge
      label={registered ? '등록완료' : '미등록'}
      className={
        registered ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
      }
    />
  )
}

export function BomListTable({ rows, emptyMessage, onSelectRow }: BomListTableProps) {
  if (!rows.length) {
    return (
      <EmptyListState message={emptyMessage} hint="품목등록에서 반제품·완제품을 먼저 등록해 주세요." />
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                부모코드
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                부모명
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                부모구분
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                구성개수
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                소요량
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
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
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-sm font-semibold text-slate-800">
                    {cell(row.parentProductId)}
                  </td>
                  <td className="px-3 py-2.5 text-sm font-medium text-slate-900">
                    {cell(row.parentProductName)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-center">
                    <CategoryBadge
                      label={ITEM_CATEGORY_LABELS[row.parentItemCategory]}
                      className={ITEM_CATEGORY_BADGE_CLASS[row.parentItemCategory]}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-800">
                    {row.bomRegistered ? row.lines.length.toLocaleString('ko-KR') : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-800">
                    {row.bomRegistered ? quantityTotal.toLocaleString('ko-KR') : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-center">
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
