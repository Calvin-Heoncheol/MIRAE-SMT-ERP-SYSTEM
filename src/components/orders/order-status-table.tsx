'use client'

import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import type { ProductionStatusLine } from '@/lib/production-status/types'

type OrderStatusTableProps = {
  lines: ProductionStatusLine[]
}

function OrderStatusBadge({ done, hasTarget }: { done: boolean; hasTarget: boolean }) {
  if (!hasTarget) {
    return (
      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
        대상없음
      </span>
    )
  }
  if (done) {
    return (
      <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
        완료
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
      진행중
    </span>
  )
}

export function OrderStatusTable({ lines }: OrderStatusTableProps) {
  if (!lines.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">표시할 주문서가 없습니다</p>
        <p className="mt-2 text-sm text-slate-500">주문서를 등록하면 주문 현황이 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-[880px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50/95 backdrop-blur-sm">
            <tr>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                주문서
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                고객사
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                제품
              </th>
              <th className="whitespace-nowrap px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                납기
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                주문수량
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                출하누적
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                잔량
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const target = Math.max(0, line.deliveryTarget || line.quantity)
              const shipped = Math.max(0, line.deliveryProduced)
              const remaining = Math.max(0, target - shipped)
              const done = target > 0 && shipped >= target

              return (
                <tr
                  key={line.orderId}
                  className="border-t border-slate-200 bg-white hover:bg-slate-50/70"
                >
                  <td
                    className="px-4 py-3.5 font-mono text-sm font-bold text-slate-900"
                    title={line.orderNumber}
                  >
                    {formatInternalCodeLabel(line.orderNumber)}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">
                    {line.customer || '—'}
                  </td>
                  <td className="px-4 py-3.5 text-sm font-medium text-slate-900">
                    <span>{line.productName || '—'}</span>
                    {line.productCount > 1 ? (
                      <span className="ml-1.5 text-xs font-normal text-slate-400">
                        ({line.productCount.toLocaleString('ko-KR')}개)
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <DeliveryDueBadge deliveryDate={line.deliveryDate} done={done} />
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm tabular-nums text-slate-700">
                    {target.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                    {shipped.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm tabular-nums text-slate-700">
                    {remaining.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3.5">
                    <OrderStatusBadge done={done} hasTarget={target > 0} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
