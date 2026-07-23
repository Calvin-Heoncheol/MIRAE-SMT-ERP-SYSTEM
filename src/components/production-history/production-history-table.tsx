'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

import { formatSmtPcbSideLabel } from '@/lib/smt/history-utils'
import type { ProductionHistoryRow } from '@/lib/production-history/types'

type ProductionHistoryTableProps = {
  rows: ProductionHistoryRow[]
  emptyMessage: string
  onRowClick?: (row: ProductionHistoryRow) => void
  /** SMT(생산1팀) 전용 컬럼 — 후공정 팀 필터 시 false */
  showSmtColumns?: boolean
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
}: ProductionHistoryTableProps) {
  if (!rows.length) {
    return (
      <EmptyListState message={emptyMessage} hint="각 팀 생산입력에서 등록한 실적이 여기에 모입니다." />
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table
          className={[
            'w-full border-collapse',
            showSmtColumns ? 'min-w-[1040px]' : 'min-w-[900px]',
          ].join(' ')}
        >
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                기록일
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                팀
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                주문서번호
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                고객사
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                제품명
              </th>
              {showSmtColumns ? (
                <>
                  <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    라인
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    면구분
                  </th>
                </>
              ) : null}
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                양품
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                불량
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                등록자
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                비고
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.module}-${row.id}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  'border-t border-slate-100',
                  onRowClick ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/60',
                ].join(' ')}
                title={onRowClick ? '클릭하여 상세·삭제' : undefined}
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                  {cell(row.recordDate)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm font-semibold text-slate-800">
                  {row.team}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-slate-900">
                  {cell(row.orderNumber)}
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
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                  {cell(row.createdByName)}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-500">{cell(row.note)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
