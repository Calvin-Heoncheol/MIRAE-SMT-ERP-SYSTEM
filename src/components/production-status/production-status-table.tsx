import { formatInternalCodeLabel } from '@/lib/orders/utils'
import type { ProductionStatusLine } from '@/lib/production-status/types'

type ProductionStatusTableProps = {
  lines: ProductionStatusLine[]
}

function MiniProgress({ percent, tone }: { percent: number; tone: 'sky' | 'emerald' }) {
  const barClass = tone === 'sky' ? 'bg-sky-500' : 'bg-emerald-500'

  return (
    <div className="min-w-[88px]">
      <div className="mb-1 flex justify-between text-[11px] font-medium text-slate-500">
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

export function ProductionStatusTable({ lines }: ProductionStatusTableProps) {
  if (!lines.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">표시할 주문서가 없습니다</p>
        <p className="mt-2 text-sm text-slate-500">주문서를 등록하면 생산 현황이 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[800px] w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                주문서번호
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                고객사
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                제품
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                수량
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                SMT
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                후공정
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.orderId} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900" title={line.orderNumber}>
                  {formatInternalCodeLabel(line.orderNumber)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{line.customer || '—'}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{line.productName || '—'}</td>
                <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                  {line.quantity.toLocaleString('ko-KR')}
                </td>
                <td className="px-4 py-3">
                  <MiniProgress percent={line.smtPercent} tone="sky" />
                  <p className="mt-1 text-[11px] tabular-nums text-slate-400">
                    {line.smtProduced.toLocaleString('ko-KR')} / {line.quantity.toLocaleString('ko-KR')}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <MiniProgress percent={line.postPercent} tone="emerald" />
                  <p className="mt-1 text-[11px] tabular-nums text-slate-400">
                    {line.postTarget > 0
                      ? `${line.postProduced.toLocaleString('ko-KR')} / ${line.postTarget.toLocaleString('ko-KR')}`
                      : '—'}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
