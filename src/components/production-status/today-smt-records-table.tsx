import type { SmtProductionHistoryRow } from '@/lib/smt/types'
import {
  formatSmtHistoryDateTime,
  formatSmtPcbSideLabel,
  formatSmtProductionSourceLabel,
} from '@/lib/smt/history-utils'

type TodaySmtRecordsTableProps = {
  records: SmtProductionHistoryRow[]
}

export function TodaySmtRecordsTable({ records }: TodaySmtRecordsTableProps) {
  if (!records.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center">
        <p className="text-sm font-semibold text-slate-600">오늘 등록된 SMT 생산 실적이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                등록시각
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                주문서번호
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                제품명
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                면
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                수량
              </th>
              <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">
                경로
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-600">
                  {formatSmtHistoryDateTime(record.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900">
                  {record.orderNumber}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{record.productName || '—'}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-center text-slate-600">
                  {formatSmtPcbSideLabel(record.pcbSide)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums text-sky-800">
                  {record.quantity.toLocaleString('ko-KR')}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-center text-slate-500">
                  {formatSmtProductionSourceLabel(record.source)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
