'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { OrderCategoryBadge } from '@/components/orders/order-category-badge'
import { ErpTableHead, ErpTableShell, ErpTableTd, ErpTableTh } from '@/components/ui/erp-table'
import {
  formatInternalCodeLabel,
  formatOrderDeliverySummary,
  formatOrderMoney,
  formatProductSummary,
} from '@/lib/orders/utils'
import type { OrderListGroup } from '@/lib/orders/types'
import { ERP_TABLE_ROW_CLASS } from '@/lib/ui/tokens'

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
    <ErpTableShell tableClassName="min-w-[800px] md:min-w-[1120px]">
      <ErpTableHead>
        <tr>
          <ErpTableTh>발주일</ErpTableTh>
          <ErpTableTh className="hidden sm:table-cell">납기일</ErpTableTh>
          <ErpTableTh>발주번호</ErpTableTh>
          <ErpTableTh>고객사</ErpTableTh>
          <ErpTableTh className="hidden md:table-cell">제품</ErpTableTh>
          <ErpTableTh align="right">수량</ErpTableTh>
          <ErpTableTh align="right" className="hidden sm:table-cell">
            발주금액
          </ErpTableTh>
          <ErpTableTh align="center" className="hidden lg:table-cell">
            구분
          </ErpTableTh>
          <ErpTableTh className="hidden lg:table-cell">등록자</ErpTableTh>
        </tr>
      </ErpTableHead>
      <tbody>
        {orders.map((order) => (
          <tr
            key={order.orderNumber}
            className={`${ERP_TABLE_ROW_CLASS} cursor-pointer`}
            onClick={() => onSelectOrder?.(order)}
          >
            <ErpTableTd className="text-slate-700">{order.orderDate || '-'}</ErpTableTd>
            <ErpTableTd className="hidden text-slate-700 sm:table-cell">
              {formatOrderDeliverySummary(order)}
            </ErpTableTd>
            <ErpTableTd
              className="font-mono text-xs text-emerald-800"
              title={order.customerPoNumber || undefined}
            >
              {order.customerPoNumber?.trim()
                ? formatInternalCodeLabel(order.customerPoNumber)
                : '—'}
            </ErpTableTd>
            <ErpTableTd text="wrap" className="max-w-[160px] text-slate-700">
              {order.customer || '-'}
            </ErpTableTd>
            <ErpTableTd text="wrap" className="hidden max-w-[200px] text-slate-700 md:table-cell">
              {formatProductSummary(order)}
            </ErpTableTd>
            <ErpTableTd align="right" className="tabular-nums text-slate-700">
              {order.totalQuantity.toLocaleString('ko-KR')}
            </ErpTableTd>
            <ErpTableTd
              align="right"
              className="hidden font-semibold tabular-nums text-slate-900 sm:table-cell"
            >
              {formatOrderMoney(order.totalAmount, order.currency)}
            </ErpTableTd>
            <ErpTableTd align="center" className="hidden lg:table-cell">
              <OrderCategoryBadge category={order.category} />
            </ErpTableTd>
            <ErpTableTd className="hidden text-slate-700 lg:table-cell">
              {order.createdByName || '-'}
            </ErpTableTd>
          </tr>
        ))}
      </tbody>
    </ErpTableShell>
  )
}
