'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { OrderCategoryBadge } from '@/components/orders/order-category-badge'
import {
  formatInternalCodeLabel,
  formatOrderDeliverySummary,
  formatOrderMoney,
  formatProductSummary,
} from '@/lib/orders/utils'
import type { OrderListGroup } from '@/lib/orders/types'
import {
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_FIXED_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

type OrderListTableProps = {
  orders: OrderListGroup[]
  emptyMessage: string
  onSelectOrder?: (order: OrderListGroup) => void
}

export function OrderListTable({ orders, emptyMessage, onSelectOrder }: OrderListTableProps) {
  if (!orders.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className="min-w-[1040px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                발주일
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                납기일
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                발주번호
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                고객사
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                제품
              </th>
              <th className="min-w-[72px] whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                수량
              </th>
              <th className="min-w-[96px] whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                발주금액
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                구분
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                등록자
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.orderNumber}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => onSelectOrder?.(order)}
              >
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_FIXED_CLASS}`}>
                  {order.orderDate || '-'}
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_FIXED_CLASS}`}>
                  {formatOrderDeliverySummary(order)}
                </td>
                <td
                  className={`px-3 py-2.5 font-mono text-xs text-emerald-800 ${ERP_TABLE_TD_FIXED_CLASS}`}
                  title={order.customerPoNumber || undefined}
                >
                  {order.customerPoNumber?.trim()
                    ? formatInternalCodeLabel(order.customerPoNumber)
                    : '—'}
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  {order.customer || '-'}
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                  {formatProductSummary(order)}
                </td>
                <td
                  className={`px-3 py-2.5 text-right text-sm tabular-nums text-slate-700 ${ERP_TABLE_TD_FIXED_CLASS}`}
                >
                  {order.totalQuantity.toLocaleString('ko-KR')}
                </td>
                <td
                  className={`px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900 ${ERP_TABLE_TD_FIXED_CLASS}`}
                >
                  {formatOrderMoney(order.totalAmount)}
                </td>
                <td className={`px-3 py-2.5 text-center ${ERP_TABLE_TD_FIXED_CLASS}`}>
                  <OrderCategoryBadge category={order.category} />
                </td>
                <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_FIXED_CLASS}`}>
                  {order.createdByName || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
