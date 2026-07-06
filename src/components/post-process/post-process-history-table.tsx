import type { PostProcessProductionHistoryRow } from '@/lib/post-process/types'
import { formatPostProcessHistoryDateTime } from '@/lib/post-process/history-utils'

type PostProcessHistoryTableProps = {
  rows: PostProcessProductionHistoryRow[]
  emptyMessage: string
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '-'
}

export function PostProcessHistoryTable({ rows, emptyMessage }: PostProcessHistoryTableProps) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">
          생산입력 탭에서 등록한 후공정 실적이 여기에 표시됩니다.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[880px] w-full border-collapse">
          <thead className="bg-emerald-50/80">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wide text-emerald-900 uppercase">
                기록일
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wide text-emerald-900 uppercase">
                등록시각
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wide text-emerald-900 uppercase">
                주문서번호
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-emerald-900 uppercase">
                고객사
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-emerald-900 uppercase">
                완제품명
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold tracking-wide text-emerald-900 uppercase">
                목표
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold tracking-wide text-emerald-900 uppercase">
                등록수량
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-emerald-900 uppercase">
                비고
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 hover:bg-emerald-50/40">
                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-700">{cell(row.recordDate)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-slate-600">
                  {formatPostProcessHistoryDateTime(row.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-slate-900">
                  {cell(row.orderNumber)}
                </td>
                <td className="px-4 py-2.5 text-sm text-slate-700">{cell(row.customer)}</td>
                <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{cell(row.productName)}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm tabular-nums text-slate-700">
                  {row.targetQuantity.toLocaleString('ko-KR')}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-bold tabular-nums text-emerald-700">
                  {row.quantity.toLocaleString('ko-KR')}
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
