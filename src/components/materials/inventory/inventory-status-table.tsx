'use client'

import { formatInventoryQuantity } from '@/lib/materials/inventory/utils'
import type { MaterialInventoryRow } from '@/lib/materials/inventory/types'

type InventoryStatusTableProps = {
  rows: MaterialInventoryRow[]
  emptyMessage: string
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

export function InventoryStatusTable({ rows, emptyMessage }: InventoryStatusTableProps) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">자재별 입고예정·현재고가 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse">
          <thead className="bg-blue-50/80">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-blue-900 uppercase">
                코드
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-blue-900 uppercase">
                고객사
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-blue-900 uppercase">
                자재명
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-blue-900 uppercase">
                규격
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-blue-900 uppercase">
                자재코드
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold tracking-wide text-blue-900 uppercase">
                MPN
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide text-blue-900 uppercase">
                구분
              </th>
              <th className="px-3 py-3 text-center text-xs font-semibold tracking-wide text-blue-900 uppercase">
                도급/사급
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold tracking-wide text-blue-900 uppercase">
                입고예정
              </th>
              <th className="px-3 py-3 text-right text-xs font-semibold tracking-wide text-blue-900 uppercase">
                현재고
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 hover:bg-blue-50/40">
                <td className={`px-3 py-2.5 font-medium text-blue-800 ${codeCellClass}`}>{row.id}</td>
                <td className="px-3 py-2.5">
                  <TruncatedText value={row.customer} maxWidthClass="max-w-28" />
                </td>
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
                <td className={`px-3 py-2.5 font-medium text-violet-800 ${codeCellClass}`}>
                  {cell(row.id)}
                </td>
                <td className={`px-3 py-2.5 text-slate-700 ${codeCellClass}`}>{cell(row.mpn)}</td>
                <td className="px-3 py-2.5 text-center text-sm text-slate-700">{cell(row.type)}</td>
                <td className="px-3 py-2.5 text-center text-sm text-slate-700">{cell(row.supplyType)}</td>
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
