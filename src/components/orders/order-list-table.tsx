'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'

import { ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

import { OrderCategoryBadge } from '@/components/orders/order-category-badge'
import {
  formatInternalCodeLabel,
  formatOrderDeliverySummary,
  formatOrderMoney,
  formatProductSummary,
} from '@/lib/orders/utils'
import type { OrderListGroup } from '@/lib/orders/types'

type OrderListTableProps = {
  orders: OrderListGroup[]
  emptyMessage: string
  onSelectOrder?: (order: OrderListGroup) => void
}

export function OrderListTable({ orders, emptyMessage, onSelectOrder }: OrderListTableProps) {
  if (!orders.length) {
    return (
      <EmptyListState message={emptyMessage} hint="신규 주문 버튼으로 등록하거나, 견적서에서 「주문서로 전환」을 사용하세요." />
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                주문일
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                납기일
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                주문서번호
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                고객사
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                제품
              </th>
              <th className="min-w-[72px] whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                수량합계
              </th>
              <th className="min-w-[96px] whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                주문금액
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
                <td className="px-3 py-2.5 text-sm text-slate-700">{order.orderDate || '-'}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700">
                  {formatOrderDeliverySummary(order)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-emerald-800" title={order.orderNumber}>
                  {formatInternalCodeLabel(order.orderNumber)}
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{order.customer || '-'}</td>
                <td className="px-3 py-2.5 text-sm text-slate-700">{formatProductSummary(order)}</td>
                <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700">
                  {order.totalQuantity.toLocaleString('ko-KR')}
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {formatOrderMoney(order.totalAmount)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <OrderCategoryBadge category={order.category} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
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
