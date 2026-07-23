'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

import { formatInventoryQuantity } from '@/lib/materials/inventory/utils'
import type { MaterialInventoryRow } from '@/lib/materials/inventory/types'

type InventoryStatusTableProps = {
  rows: MaterialInventoryRow[]
  emptyMessage: string
  onSelectRow?: (row: MaterialInventoryRow) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

const codeCellClass =
  'whitespace-nowrap text-sm tabular-nums [word-break:keep-all] [overflow-wrap:normal]'

function TruncatedText({
  value,
  className = '',
  maxWidthClass = 'max-w-48',
}: {
  value: string
  className?: string
  maxWidthClass?: string
}) {
  const text = cell(value)
  if (text === '-') {
    return <span className={`text-sm text-slate-400 ${className}`}>-</span>
  }

  return (
    <span className={`block truncate text-sm ${maxWidthClass} ${className}`} title={text}>
      {text}
    </span>
  )
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

export function InventoryStatusTable({ rows, emptyMessage, onSelectRow }: InventoryStatusTableProps) {
  if (!rows.length) {
    return (
      <EmptyListState message={emptyMessage} hint="자재별 입고예정·현재고가 여기에 표시됩니다." />
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] table-fixed border-collapse">
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
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                입고예정
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                현재고
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                안전재고
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={[
                  'border-t border-slate-100',
                  row.belowSafetyStock ? 'bg-amber-50/70' : '',
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
                <td className="px-3 py-2.5">
                  <TruncatedText
                    value={row.materialName}
                    className="font-medium text-slate-900"
                    maxWidthClass="max-w-36"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <TruncatedText value={row.specification} maxWidthClass="max-w-44" />
                </td>
                <td className="max-w-0 overflow-hidden px-3 py-2.5">
                  <TruncatedText
                    value={row.mpn}
                    className="text-slate-700"
                    maxWidthClass="max-w-full"
                  />
                </td>
                <td className="px-3 py-2.5 text-center text-sm text-slate-700">{cell(row.type)}</td>
                <td className="px-3 py-2.5 text-center text-sm text-slate-700">{cell(row.supplyType)}</td>
                <td
                  className={`px-3 py-2.5 text-right text-sm tabular-nums ${quantityClass(row.expectedInboundQuantity, 'expected')}`}
                >
                  {formatInventoryQuantity(row.expectedInboundQuantity)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right text-sm tabular-nums ${quantityClass(row.onHandQuantity, 'onHand')}${
                    row.belowSafetyStock && row.onHandQuantity >= 0 ? ' text-amber-800 font-semibold' : ''
                  }`}
                >
                  {formatInventoryQuantity(row.onHandQuantity)}
                  {row.belowSafetyStock ? (
                    <span className="ml-1 text-[10px] font-bold text-amber-700">미달</span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-600">
                  {formatInventoryQuantity(row.safetyStock)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
