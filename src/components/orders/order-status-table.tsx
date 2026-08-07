'use client'

import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { formatShipmentRound } from '@/lib/delivery/history-utils'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import type { ProductionStatusLine } from '@/lib/production-status/types'
import { ERP_BADGE_COMPACT_CLASS, ERP_TABLE_TD_WRAP_CLASS } from '@/lib/ui/tokens'

type OrderStatusTableProps = {
  lines: ProductionStatusLine[]
}

function OrderStatusBadge({
  done,
  hasTarget,
  shipped,
  shipmentCount,
}: {
  done: boolean
  hasTarget: boolean
  shipped: number
  shipmentCount: number
}) {
  const base = ERP_BADGE_COMPACT_CLASS
  if (!hasTarget) {
    return <span className={`${base} bg-slate-100 text-slate-500 ring-slate-200`}>대상없음</span>
  }
  if (done) {
    return (
      <span className={`${base} bg-emerald-50 text-emerald-700 ring-emerald-200`}>
        완료
        {shipmentCount > 0 ? ` · ${formatShipmentRound(shipmentCount)}` : ''}
      </span>
    )
  }
  if (shipped > 0) {
    return (
      <span className={`${base} bg-amber-50 text-amber-800 ring-amber-200`}>
        부분출하
        {shipmentCount > 0 ? ` · ${formatShipmentRound(shipmentCount)}` : ''}
      </span>
    )
  }
  return (
    <span className={`${base} bg-slate-100 text-slate-600 ring-slate-200`}>미출하</span>
  )
}

export function OrderStatusTable({ lines }: OrderStatusTableProps) {
  if (!lines.length) {
    return (
      <EmptyListState
        message="표시할 주문서가 없습니다"
        hint="주문서를 등록하면 주문 현황이 여기에 표시됩니다."
      />
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
              const shipmentCount = Math.max(0, Math.floor(Number(line.deliveryShipmentCount) || 0))

              return (
                <tr
                  key={line.orderId}
                  className="border-t border-slate-200 bg-white hover:bg-slate-50/70"
                >
                  <td
                    className="px-4 py-3.5 font-mono text-sm font-bold whitespace-nowrap text-slate-900"
                    title={line.orderNumber}
                  >
                    {formatInternalCodeLabel(line.orderNumber)}
                  </td>
                  <td className={`px-4 py-3.5 text-sm font-semibold text-slate-800 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                    {line.customer || '—'}
                  </td>
                  <td className={`px-4 py-3.5 text-sm font-medium text-slate-900 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                    <span>{line.productName || '—'}</span>
                    {line.productCount > 1 ? (
                      <span className="ml-1.5 text-xs font-normal whitespace-nowrap text-slate-400">
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
                    <div>{shipped.toLocaleString('ko-KR')}</div>
                    {shipmentCount > 0 ? (
                      <div className="mt-0.5 text-xs font-medium text-sky-700">
                        {formatShipmentRound(shipmentCount)}까지
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm tabular-nums text-slate-700">
                    {remaining.toLocaleString('ko-KR')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <OrderStatusBadge
                      done={done}
                      hasTarget={target > 0}
                      shipped={shipped}
                      shipmentCount={shipmentCount}
                    />
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
