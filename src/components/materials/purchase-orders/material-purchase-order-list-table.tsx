'use client'

import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpTableHead, ErpTableShell, ErpTableTd, ErpTableTh } from '@/components/ui/erp-table'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  formatInternalCodeLabel,
  formatMaterialPurchaseOrderMoney,
  formatMaterialSummary,
  getMaterialPurchaseInboundStatusLabel,
  resolveMaterialPurchaseInboundStatus,
  type MaterialPurchaseInboundStatus,
} from '@/lib/materials/purchase-orders/utils'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import { ERP_TABLE_ROW_CLASS } from '@/lib/ui/tokens'
import type { ErpStatusTone } from '@/lib/ui/tokens'

type MaterialPurchaseOrderListTableProps = {
  orders: MaterialPurchaseOrderListGroup[]
  emptyMessage: string
  onSelectOrder?: (order: MaterialPurchaseOrderListGroup) => void
}

function inboundStatusTone(status: MaterialPurchaseInboundStatus): ErpStatusTone {
  if (status === 'done') return 'success'
  if (status === 'partial') return 'warning'
  return 'neutral'
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
    <ErpTableShell tableClassName="min-w-[640px] md:min-w-[900px]">
      <ErpTableHead>
        <tr>
          <ErpTableTh>구매발주일</ErpTableTh>
          <ErpTableTh className="hidden sm:table-cell">납기일</ErpTableTh>
          <ErpTableTh>구매발주번호</ErpTableTh>
          <ErpTableTh className="hidden md:table-cell">연결 발주서</ErpTableTh>
          <ErpTableTh>공급사</ErpTableTh>
          <ErpTableTh className="hidden lg:table-cell">자재</ErpTableTh>
          <ErpTableTh align="right">수량합계</ErpTableTh>
          <ErpTableTh align="right" className="hidden sm:table-cell">
            구매발주금액
          </ErpTableTh>
          <ErpTableTh align="center">상태</ErpTableTh>
        </tr>
      </ErpTableHead>
      <tbody>
        {orders.map((order) => {
          const inboundStatus = resolveMaterialPurchaseInboundStatus(order)

          return (
            <tr
              key={order.orderNumber}
              className={`${ERP_TABLE_ROW_CLASS} cursor-pointer`}
              onClick={() => onSelectOrder?.(order)}
            >
              <ErpTableTd className="text-slate-700">{order.orderDate || '-'}</ErpTableTd>
              <ErpTableTd className="hidden text-slate-700 sm:table-cell">
                {order.deliveryDate || '-'}
              </ErpTableTd>
              <ErpTableTd className="font-mono text-xs text-slate-800" title={order.orderNumber}>
                {formatInternalCodeLabel(order.orderNumber)}
              </ErpTableTd>
              <ErpTableTd
                className="hidden font-mono text-xs text-slate-800 md:table-cell"
                title={order.sourceOrderId || undefined}
              >
                {order.sourceOrderId ? formatInternalCodeLabel(order.sourceOrderId) : '—'}
              </ErpTableTd>
              <ErpTableTd text="wrap" className="max-w-[140px] text-slate-700">
                {order.supplier || '-'}
              </ErpTableTd>
              <ErpTableTd text="wrap" className="hidden max-w-[180px] text-slate-700 lg:table-cell">
                {formatMaterialSummary(order)}
              </ErpTableTd>
              <ErpTableTd align="right" className="tabular-nums text-slate-700">
                {order.totalQuantity.toLocaleString('ko-KR')}
              </ErpTableTd>
              <ErpTableTd
                align="right"
                className="hidden font-semibold tabular-nums text-slate-900 sm:table-cell"
              >
                {formatMaterialPurchaseOrderMoney(order.totalAmount)}
              </ErpTableTd>
              <ErpTableTd align="center">
                <StatusBadge
                  label={getMaterialPurchaseInboundStatusLabel(inboundStatus)}
                  tone={inboundStatusTone(inboundStatus)}
                />
              </ErpTableTd>
            </tr>
          )
        })}
      </tbody>
    </ErpTableShell>
  )
}
