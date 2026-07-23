'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { computePurchaseOrderRemainingQuantity } from '@/lib/materials/purchase-orders/utils'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import {
  ERP_SECONDARY_BUTTON_CLASS,
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

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
  if (!orders.length) {
    return <EmptyListState message={emptyMessage} />
  }

  return (
    <div className={`${ERP_TABLE_WRAP_CLASS} overflow-x-auto`}>
      <table className={`${ERP_TABLE_CLASS} min-w-[760px]`}>
        <thead className={ERP_TABLE_HEAD_CLASS}>
          <tr>
            <th className={`${ERP_TABLE_TH_CLASS} text-left`}>발주번호</th>
            <th className={`${ERP_TABLE_TH_CLASS} text-left`}>공급업체</th>
            <th className={`${ERP_TABLE_TH_CLASS} text-left`}>발주일</th>
            <th className={`${ERP_TABLE_TH_CLASS} text-left`}>입고예정일</th>
            <th className={`${ERP_TABLE_TH_CLASS} text-right`}>자재</th>
            <th className={`${ERP_TABLE_TH_CLASS} text-right`}>입고 잔량</th>
            <th className={`w-24 ${ERP_TABLE_TH_CLASS}`} />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
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
              <tr key={order.orderId} className="border-t border-slate-100 hover:bg-slate-50/80">
                <td className={`${ERP_TABLE_TD_CLASS} font-mono text-sm font-semibold text-slate-900`}>
                  {order.orderNumber}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} text-slate-700`}>
                  {order.supplier || '공급업체 미입력'}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} tabular-nums text-slate-700`}>
                  {order.orderDate || '—'}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} tabular-nums text-slate-700`}>
                  {order.deliveryDate || '—'}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums text-slate-700`}>
                  {order.items.length.toLocaleString('ko-KR')}종
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} text-right font-semibold tabular-nums text-slate-800`}>
                  {remaining.toLocaleString('ko-KR')}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} text-right`}>
                  <button
                    type="button"
                    onClick={() => onInboundClick(order)}
                    className={`${ERP_SECONDARY_BUTTON_CLASS} px-3 py-1.5`}
                  >
                    입고
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
