'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { CategoryBadge } from '@/components/ui/category-badge'
import { ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'
import {
  formatInternalCodeLabel,
  formatMaterialPurchaseOrderMoney,
  formatMaterialSummary,
  getMaterialPurchaseSourceKind,
  getMaterialPurchaseSourceLabel,
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
      <EmptyListState
        message={emptyMessage}
        hint="주문서 발주 또는 자재별 발주 탭에서 등록한 발주가 여기에 모입니다."
      />
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table className="min-w-[1240px] w-full border-collapse">
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
                구분
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                연결 주문서
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                커버수량
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                공급사
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                자재
              </th>
              <th className="min-w-[72px] whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                수량합계
              </th>
              <th className="min-w-[96px] whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                발주금액
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-slate-500 uppercase">
                상태
              </th>
              <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                등록자
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const sourceKind = getMaterialPurchaseSourceKind(order)
              const isOrderBased = sourceKind === 'order'

              return (
                <tr
                  key={order.orderNumber}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  onClick={() => onSelectOrder?.(order)}
                >
                  <td className="px-3 py-2.5 text-sm text-slate-700">{order.orderDate || '-'}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-700">{order.deliveryDate || '-'}</td>
                  <td
                    className="px-3 py-2.5 font-mono text-xs text-slate-800"
                    title={order.orderNumber}
                  >
                    {formatInternalCodeLabel(order.orderNumber)}
                  </td>
                  <td className="px-3 py-2.5">
                    <CategoryBadge
                      label={getMaterialPurchaseSourceLabel(sourceKind)}
                      className={
                        isOrderBased
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-slate-100 text-slate-700'
                      }
                    />
                  </td>
                  <td
                    className="px-3 py-2.5 font-mono text-xs text-slate-800"
                    title={order.sourceOrderId || undefined}
                  >
                    {order.sourceOrderId ? formatInternalCodeLabel(order.sourceOrderId) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700">
                    {isOrderBased && order.coveredProductQuantity > 0
                      ? order.coveredProductQuantity.toLocaleString('ko-KR')
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-slate-700">{order.supplier || '-'}</td>
                  <td className="px-3 py-2.5 text-sm text-slate-700">{formatMaterialSummary(order)}</td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums text-slate-700">
                    {order.totalQuantity.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                    {formatMaterialPurchaseOrderMoney(order.totalAmount)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <StatusBadge
                      label={order.hasInbound ? '일부입고' : '발주'}
                      className={
                        order.hasInbound
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm text-slate-700">
                    {order.createdByName || '-'}
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
