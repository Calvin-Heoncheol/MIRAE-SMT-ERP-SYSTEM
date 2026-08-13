'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import {
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_FIXED_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

import { formatInventoryQuantity } from '@/lib/materials/inventory/utils'
import type { MaterialInventoryRow } from '@/lib/materials/inventory/types'

type InventoryStatusTableProps = {
  rows: MaterialInventoryRow[]
  emptyMessage: string
  /** 사급 필터 시 '고객사', 기본 '공급사' */
  supplierColumnLabel?: string
  onSelectRow?: (row: MaterialInventoryRow) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

const codeCellClass =
  `${ERP_TABLE_TD_FIXED_CLASS} text-sm tabular-nums [word-break:keep-all] [overflow-wrap:normal]`

function CellText({
  value,
  className = '',
}: {
  value: string
  className?: string
}) {
  const text = cell(value)
  if (text === '-') {
    return <span className={`text-sm text-slate-400 ${className}`}>-</span>
  }

  return <span className={`block text-sm ${ERP_TABLE_TD_WRAP_CLASS} ${className}`}>{text}</span>
}

function quantityClass(value: number, variant: 'onHand' | 'expected') {
  if (variant === 'onHand' && value < 0) {
    return 'font-semibold text-rose-700'
  }
  if (variant === 'expected' && value > 0) {
    return 'font-semibold text-amber-700'
  }
  return 'font-medium text-slate-900'
}

export function InventoryStatusTable({
  rows,
  emptyMessage,
  supplierColumnLabel = '공급사',
  onSelectRow,
}: InventoryStatusTableProps) {
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
        <table className="w-full min-w-[940px] table-fixed border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                품목코드
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                품목명
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                규격
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                MPN
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                구분
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                도급/사급
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {supplierColumnLabel}
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                입고예정
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                현재고
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={[
                  'border-t border-slate-100',
                  onSelectRow
                    ? 'cursor-pointer hover:bg-blue-50/70'
                    : 'hover:bg-slate-50/60',
                ].join(' ')}
                onClick={onSelectRow ? () => onSelectRow(row) : undefined}
                onKeyDown={
                  onSelectRow
                    ? (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onSelectRow(row)
                        }
                      }
                    : undefined
                }
                tabIndex={onSelectRow ? 0 : undefined}
                title={onSelectRow ? '클릭하여 현재고 설정' : undefined}
              >
                <td className={`px-3 py-2.5 font-medium text-blue-800 ${codeCellClass}`}>{row.id}</td>
                <td className={`px-3 py-2.5 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  <CellText value={row.materialName} className="font-medium text-slate-900" />
                </td>
                <td className={`px-3 py-2.5 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  <CellText value={row.specification} />
                </td>
                <td className={`px-3 py-2.5 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  <CellText value={row.mpn} className="text-slate-700" />
                </td>
                <td className="px-3 py-2.5 text-center text-sm text-slate-700">{cell(row.type)}</td>
                <td className="px-3 py-2.5 text-center text-sm text-slate-700">{cell(row.supplyType)}</td>
                <td className={`px-3 py-2.5 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  <CellText value={row.supplier} className="text-slate-700" />
                </td>
                <td
                  className={`px-3 py-2.5 text-right text-sm tabular-nums ${quantityClass(row.expectedInboundQuantity, 'expected')}`}
                >
                  {formatInventoryQuantity(row.expectedInboundQuantity)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right text-sm tabular-nums ${quantityClass(row.onHandQuantity, 'onHand')}`}
                >
                  {formatInventoryQuantity(row.onHandQuantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
