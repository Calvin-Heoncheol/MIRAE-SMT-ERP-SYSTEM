import type { DeliveryHistoryRow } from '@/lib/delivery/types'

type DeliveryHistoryTableProps = {
  rows: DeliveryHistoryRow[]
  emptyMessage: string
  onRowClick?: (row: DeliveryHistoryRow) => void
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

export function DeliveryHistoryTable({ rows, emptyMessage, onRowClick }: DeliveryHistoryTableProps) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">출하입력 탭에서 등록한 출하 실적이 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                출하번호
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                기록일
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                주문서번호
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                고객사
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                완제품명
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                목표
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                출하수량
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                등록자
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                비고
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row)}
                className={`border-t border-slate-100 hover:bg-violet-50/40 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                <td className="whitespace-nowrap px-4 py-2.5 text-sm font-semibold tabular-nums text-violet-800">
                  {cell(row.id)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-700">{cell(row.recordDate)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-slate-900">
                  {cell(row.orderNumber)}
                </td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{cell(row.customer)}</td>
                <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{cell(row.productName)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-slate-700">
                  {row.targetQuantity.toLocaleString('ko-KR')}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-bold tabular-nums text-violet-700">
                  {row.quantity.toLocaleString('ko-KR')}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-700">
                  {cell(row.createdByName)}
                </td>
                <td className="px-4 py-2.5 text-sm text-slate-600">{cell(row.note)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
