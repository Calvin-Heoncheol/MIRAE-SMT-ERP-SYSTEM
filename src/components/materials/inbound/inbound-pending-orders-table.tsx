'use client'

import { computePurchaseOrderRemainingQuantity } from '@/lib/materials/purchase-orders/utils'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'

type InboundPendingOrdersTableProps = {
  orders: MaterialPurchaseOrderListGroup[]
  emptyMessage: string
  onInboundClick: (order: MaterialPurchaseOrderListGroup) => void
}

/** 입고 잔량이 남은 발주서 목록 — 스캐너 없이 발주서 기준으로 입고할 때의 진입점 */
export function InboundPendingOrdersTable({
  orders,
  emptyMessage,
  onInboundClick,
}: InboundPendingOrdersTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2.5 text-left font-semibold text-slate-600">발주번호</th>
            <th className="px-4 py-2.5 text-left font-semibold text-slate-600">공급업체</th>
            <th className="px-4 py-2.5 text-left font-semibold text-slate-600">발주일</th>
            <th className="px-4 py-2.5 text-left font-semibold text-slate-600">입고예정일</th>
            <th className="px-4 py-2.5 text-right font-semibold text-slate-600">자재</th>
            <th className="px-4 py-2.5 text-right font-semibold text-slate-600">입고 잔량</th>
            <th className="w-24 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            orders.map((order) => {
              const totalOrdered = order.items.reduce(
                (sum, item) => sum + (Number(item.quantity) || 0),
                0,
              )
              const totalReceived = order.items.reduce(
                (sum, item) => sum + (Number(item.inboundQuantity) || 0),
                0,
              )
              const remaining = computePurchaseOrderRemainingQuantity(totalOrdered, totalReceived)

              return (
                <tr key={order.orderId} className="border-t border-slate-100 hover:bg-blue-50/40">
                  <td className="px-4 py-2.5 font-mono text-sm font-semibold text-slate-900">
                    {order.orderNumber}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{order.supplier || '공급업체 미입력'}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-700">{order.orderDate || '—'}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-700">{order.deliveryDate || '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">
                    {order.items.length.toLocaleString('ko-KR')}종
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-blue-700">
                    {remaining.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onInboundClick(order)}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                    >
                      입고
                    </button>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
