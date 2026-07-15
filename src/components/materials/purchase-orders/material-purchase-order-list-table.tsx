'use client'

import {
  formatInternalCodeLabel,
  formatMaterialPurchaseOrderMoney,
  formatMaterialSummary,
} from '@/lib/materials/purchase-orders/utils'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'

type MaterialPurchaseOrderListTableProps = {
  orders: MaterialPurchaseOrderListGroup[]
  emptyMessage: string
  onSelectOrder?: (order: MaterialPurchaseOrderListGroup) => void
}

export function MaterialPurchaseOrderListTable({
  orders,
  emptyMessage,
  onSelectOrder,
}: MaterialPurchaseOrderListTableProps) {
  if (!orders.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">
          발주등록에서 주문 카드를 열고 부족분 발주로 등록하세요.
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
                발주일
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                납기일
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                발주번호
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                공급사
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                자재
              </th>
              <th className="min-w-[72px] whitespace-nowrap px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                수량합계
              </th>
              <th className="min-w-[96px] whitespace-nowrap px-4 py-3 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                발주금액
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                상태
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
                <td className="px-4 py-3 font-mono text-xs text-violet-800" title={order.orderNumber}>
                  {formatInternalCodeLabel(order.orderNumber)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{order.supplier || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{formatMaterialSummary(order)}</td>
                <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                  {order.totalQuantity.toLocaleString('ko-KR')}
                </td>
                <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {formatMaterialPurchaseOrderMoney(order.totalAmount)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={[
                      'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      order.hasInbound
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-violet-100 text-violet-800',
                    ].join(' ')}
                  >
                    {order.hasInbound ? '일부입고' : '발주'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
