'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  formatInternalCodeLabel,
  formatMaterialPurchaseOrderMoney,
  formatMaterialSummary,
  getMaterialPurchaseInboundStatusClassName,
  getMaterialPurchaseInboundStatusLabel,
  resolveMaterialPurchaseInboundStatus,
} from '@/lib/materials/purchase-orders/utils'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import {
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_FIXED_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

type MaterialPurchaseOrderListTableProps = {
  orders: MaterialPurchaseOrderListGroup[]
  emptyMessage: string
  onSelectOrder?: (order: MaterialPurchaseOrderListGroup) => void
}

/** 목록은 핵심 열만 — 커버수량·등록자는 상세 모달에서 확인 */
export function MaterialPurchaseOrderListTable({
  orders,
  emptyMessage,
  onSelectOrder,
}: MaterialPurchaseOrderListTableProps) {
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
        <table className="min-w-[900px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                구매발주일
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                납기일
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                구매발주번호
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                연결 발주서
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                공급사
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                자재
              </th>
              <th className="min-w-[72px] whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                수량합계
              </th>
              <th className="min-w-[96px] whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                구매발주금액
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-500">
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const inboundStatus = resolveMaterialPurchaseInboundStatus(order)

              return (
                <tr
                  key={order.orderNumber}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                  onClick={() => onSelectOrder?.(order)}
                >
                  <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_FIXED_CLASS}`}>
                    {order.orderDate || '-'}
                  </td>
                  <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_FIXED_CLASS}`}>
                    {order.deliveryDate || '-'}
                  </td>
                  <td
                    className={`px-3 py-2.5 font-mono text-xs text-slate-800 ${ERP_TABLE_TD_FIXED_CLASS}`}
                    title={order.orderNumber}
                  >
                    {formatInternalCodeLabel(order.orderNumber)}
                  </td>
                  <td
                    className={`px-3 py-2.5 font-mono text-xs text-slate-800 ${ERP_TABLE_TD_FIXED_CLASS}`}
                    title={order.sourceOrderId || undefined}
                  >
                    {order.sourceOrderId ? formatInternalCodeLabel(order.sourceOrderId) : '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                    {order.supplier || '-'}
                  </td>
                  <td className={`px-3 py-2.5 text-sm text-slate-700 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                    {formatMaterialSummary(order)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right text-sm tabular-nums text-slate-700 ${ERP_TABLE_TD_FIXED_CLASS}`}
                  >
                    {order.totalQuantity.toLocaleString('ko-KR')}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-slate-900 ${ERP_TABLE_TD_FIXED_CLASS}`}
                  >
                    {formatMaterialPurchaseOrderMoney(order.totalAmount)}
                  </td>
                  <td className={`px-3 py-2.5 text-center ${ERP_TABLE_TD_FIXED_CLASS}`}>
                    <StatusBadge
                      label={getMaterialPurchaseInboundStatusLabel(inboundStatus)}
                      className={getMaterialPurchaseInboundStatusClassName(inboundStatus)}
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
