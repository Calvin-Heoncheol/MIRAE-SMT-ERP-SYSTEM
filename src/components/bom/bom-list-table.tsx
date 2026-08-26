'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_HEAD_CLASS, ERP_TABLE_SCROLL_CLASS, ERP_TABLE_TH_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

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
    <StatusBadge label={registered ? '등록완료' : '미등록'} tone={registered ? 'success' : 'warning'} />
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
          <span className="block">{cell(row.parentProductName)}</span>
          {row.parentBaseCode && row.parentProductId !== row.parentBaseCode ? (
            <span className="mt-0.5 block font-mono text-[11px] font-normal text-slate-400">
              {row.parentProductId}
            </span>
          ) : null}
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
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className="w-full min-w-[640px] border-collapse">
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              {BOM_LIST_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={`${ERP_TABLE_TH_CLASS} ${ALIGN_CLASS[column.align]}`}
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
