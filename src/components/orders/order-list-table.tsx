'use client'

import { OrderCategoryBadge } from '@/components/orders/order-category-badge'
import { formatInternalCodeLabel, formatOrderMoney, formatProductSummary } from '@/lib/orders/utils'
import type { OrderListGroup } from '@/lib/orders/types'

type OrderListTableProps = {
  orders: OrderListGroup[]
  emptyMessage: string
  onSelectOrder?: (order: OrderListGroup) => void
}

export function OrderListTable({ orders, emptyMessage, onSelectOrder }: OrderListTableProps) {
  if (!orders.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">
          신규 주문 버튼으로 주문서를 등록하거나, 견적서 관리에서 주문서를 생성하세요.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1040px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                주문일
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                납기일
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                주문서번호
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                고객사
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                제품
              </th>
              <th className="min-w-[72px] whitespace-nowrap px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                수량합계
              </th>
              <th className="min-w-[96px] whitespace-nowrap px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                주문금액
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                등록자
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                구분
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
                <td className="px-4 py-3 text-sm text-slate-700">{order.orderDate || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{order.deliveryDate || '-'}</td>
                <td className="px-4 py-3 font-mono text-xs text-emerald-800" title={order.orderNumber}>
                  {formatInternalCodeLabel(order.orderNumber)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{order.customer || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{formatProductSummary(order)}</td>
                <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                  {order.totalQuantity.toLocaleString('ko-KR')}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {formatOrderMoney(order.totalAmount)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                  {order.createdByName || '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <OrderCategoryBadge category={order.category} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
