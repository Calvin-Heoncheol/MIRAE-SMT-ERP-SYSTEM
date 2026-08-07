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

const BOM_LIST_COLUMNS = [
  { key: 'code', label: '품목코드', align: 'left' },
  { key: 'name', label: '품목명', align: 'left' },
  { key: 'version', label: '버전', align: 'center' },
  { key: 'category', label: '부모구분', align: 'center' },
  { key: 'count', label: '구성개수', align: 'right' },
  { key: 'quantity', label: '소요량', align: 'right' },
  { key: 'status', label: '상태', align: 'center' },
] as const

const ALIGN_CLASS = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const

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

function renderBomListCell(
  columnKey: (typeof BOM_LIST_COLUMNS)[number]['key'],
  row: BomListRow,
  quantityTotal: number,
) {
  switch (columnKey) {
    case 'code':
      return (
        <td key={columnKey} className="whitespace-nowrap px-3 py-2.5 font-mono text-sm font-semibold text-slate-800">
          {cell(row.parentBaseCode || row.parentProductId)}
        </td>
      )
    case 'name':
      return (
        <td key={columnKey} className="px-3 py-2.5 text-sm font-medium text-slate-900">
          {cell(row.parentProductName)}
        </td>
      )
    case 'version':
      return (
        <td key={columnKey} className="whitespace-nowrap px-3 py-2.5 text-center text-sm font-medium text-slate-700">
          {cell(row.parentVersion || '')}
        </td>
      )
    case 'category':
      return (
        <td key={columnKey} className="whitespace-nowrap px-3 py-2.5 text-center">
          <CategoryBadge
            label={ITEM_CATEGORY_LABELS[row.parentItemCategory]}
            className={ITEM_CATEGORY_BADGE_CLASS[row.parentItemCategory]}
          />
        </td>
      )
    case 'count':
      return (
        <td key={columnKey} className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-800">
          {row.bomRegistered ? row.lines.length.toLocaleString('ko-KR') : '—'}
        </td>
      )
    case 'quantity':
      return (
        <td key={columnKey} className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-800">
          {row.bomRegistered ? quantityTotal.toLocaleString('ko-KR') : '—'}
        </td>
      )
    case 'status':
      return (
        <td key={columnKey} className="whitespace-nowrap px-3 py-2.5 text-center">
          <BomStatusBadge registered={row.bomRegistered} />
        </td>
      )
  }
}

export function BomListTable({ rows, emptyMessage, onSelectRow }: BomListTableProps) {
  if (!rows.length) {
    return (
      <EmptyListState message={emptyMessage} />
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {BOM_LIST_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-2.5 text-xs font-semibold tracking-wide text-slate-500 uppercase ${ALIGN_CLASS[column.align]}`}
                >
                  {column.label}
                </th>
              ))}
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
                  {BOM_LIST_COLUMNS.map((column) => renderBomListCell(column.key, row, quantityTotal))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
