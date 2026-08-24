'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { ERP_TABLE_SCROLL_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import { formatProductionHistoryRecordAt } from '@/lib/production-history/utils'
import { formatSmtPcbSideLabel } from '@/lib/smt/history-utils'
import type { ProductionHistoryRow } from '@/lib/production-history/types'

export function productionHistoryRowKey(row: Pick<ProductionHistoryRow, 'module' | 'id'>) {
  return `${row.module}-${row.id}`
}

type ProductionHistoryTableProps = {
  rows: ProductionHistoryRow[]
  emptyMessage: string
  onRowClick?: (row: ProductionHistoryRow) => void
  /** SMT(생산1팀) 전용 컬럼 — 후공정 팀 필터 시 false */
  showSmtColumns?: boolean
  selectedIds?: Set<string>
  onToggleSelectAll?: () => void
  onToggleSelectOne?: (key: string) => void
  selectionDisabled?: boolean
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

export function ProductionHistoryTable({
  rows,
  emptyMessage,
  onRowClick,
  showSmtColumns = true,
  selectedIds,
  onToggleSelectAll,
  onToggleSelectOne,
  selectionDisabled = false,
}: ProductionHistoryTableProps) {
  const selectable = Boolean(selectedIds && onToggleSelectAll && onToggleSelectOne)
  const allSelected =
    selectable && rows.length > 0 && rows.every((row) => selectedIds!.has(productionHistoryRowKey(row)))

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
        <table
          className={[
            'w-full border-collapse',
            showSmtColumns ? 'min-w-[1140px]' : 'min-w-[1000px]',
          ].join(' ')}
        >
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              {selectable ? (
                <th className="w-10 whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold text-slate-500">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={selectionDisabled}
                    onChange={onToggleSelectAll}
                    aria-label="전체 선택"
                    className="size-4 accent-slate-700"
                  />
                </th>
              ) : null}
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                기록일
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                팀
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                발주번호
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">고객사</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">제품명</th>
              {showSmtColumns ? (
                <>
                  <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold text-slate-500">
                    라인
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold text-slate-500">
                    면구분
                  </th>
                </>
              ) : null}
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                양품
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                불량
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                LOT
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                등록자
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = productionHistoryRowKey(row)
              const selected = selectedIds?.has(key) ?? false
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={[
                    'border-t border-slate-100',
                    onRowClick ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/60',
                  ].join(' ')}
                  title={onRowClick ? '클릭하여 상세 보기' : undefined}
                >
                  {selectable ? (
                    <td
                      className="whitespace-nowrap px-3 py-2.5 text-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={selectionDisabled}
                        onChange={() => onToggleSelectOne?.(key)}
                        aria-label={`${displayOrderPoNumber(row.customerPoNumber, row.orderNumber)} 생산이력 선택`}
                        className="size-4 accent-slate-700"
                      />
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-slate-700">
                    {formatProductionHistoryRecordAt(row)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm font-semibold text-slate-800">
                    {row.team}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-slate-900">
                    {cell(displayOrderPoNumber(row.customerPoNumber, row.orderNumber))}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-700">{cell(row.customer)}</td>
                  <td className="px-3 py-2.5 text-sm font-medium text-slate-900">
                    {cell(row.productName)}
                  </td>
                  {showSmtColumns ? (
                    <>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-slate-700">
                        {row.lineNo != null ? row.lineNo : '-'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-slate-700">
                        {row.pcbSide ? formatSmtPcbSideLabel(row.pcbSide) : '-'}
                      </td>
                    </>
                  ) : null}
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                    {row.quantity.toLocaleString('ko-KR')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-slate-600">
                    {row.defectQuantity > 0 ? row.defectQuantity.toLocaleString('ko-KR') : '-'}
                  </td>
                  <td className="max-w-[10rem] px-3 py-2.5 text-xs tabular-nums text-slate-600">
                    {cell(row.lotLabel)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                    {cell(row.createdByName)}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-500">{cell(row.note)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
