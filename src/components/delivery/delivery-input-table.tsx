'use client'

import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { StatusBadge } from '@/components/ui/status-badge'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductName } from '@/lib/production-input/utils'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import {
  getDeliveryStatusLabel,
  getDeliveryStatusTone,
  resolveDeliveryAvailabilityForOrder,
} from '@/lib/delivery/utils'
import {
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

type DeliveryInputTableProps = {
  orders: ProductionOrderLine[]
  availabilityByGroupId: Record<string, DeliveryAvailability>
  selectedKey: string
  emptyMessage: string
  onSelect: (uiKey: string) => void
}

function statusBadgeClass(tone: ReturnType<typeof getDeliveryStatusTone>) {
  if (tone === 'shippable') return 'bg-emerald-50 text-emerald-800'
  if (tone === 'partial') return 'bg-amber-50 text-amber-800'
  if (tone === 'complete') return 'bg-slate-100 text-slate-600'
  return 'bg-rose-50 text-rose-700'
}

export function DeliveryInputTable({
  orders,
  availabilityByGroupId,
  selectedKey,
  emptyMessage,
  onSelect,
}: DeliveryInputTableProps) {
  if (!orders.length) {
    return (
      <EmptyListState
        message={emptyMessage}
        hint="조건을 바꾸거나 목록에서 주문을 선택해 출하를 등록하세요."
      />
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className="overflow-x-auto">
        <table className={`${ERP_TABLE_CLASS} min-w-[920px]`}>
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>주문번호</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>고객사</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>완제품</th>
              <th className={`${ERP_TABLE_TH_CLASS} whitespace-nowrap text-left`}>납기</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-right`}>주문</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-right`}>출하</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-right`}>가능</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>상태</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const availability = resolveDeliveryAvailabilityForOrder(order, availabilityByGroupId)
              const tone = getDeliveryStatusTone(availability)
              const selected = selectedKey === order.uiKey

              return (
                <tr
                  key={order.uiKey}
                  onClick={() => onSelect(order.uiKey)}
                  className={[
                    'cursor-pointer border-t border-slate-100 transition-colors',
                    selected ? 'bg-slate-100' : 'hover:bg-slate-50/80',
                  ].join(' ')}
                >
                  <td className={`${ERP_TABLE_TD_CLASS} font-mono text-xs font-semibold text-slate-800`}>
                    {order.orderNumber}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} text-slate-700`}>{order.customer || '—'}</td>
                  <td className={`${ERP_TABLE_TD_CLASS} font-medium text-slate-900`}>
                    {formatProductionProductName(order)}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} whitespace-nowrap`}>
                    <DeliveryDueBadge deliveryDate={order.deliveryDate} done={tone === 'complete'} />
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums text-slate-700`}>
                    {availability.targetQuantity.toLocaleString('ko-KR')}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums text-slate-700`}>
                    {availability.shipped.toLocaleString('ko-KR')}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} text-right font-semibold tabular-nums text-slate-800`}>
                    {availability.shippable.toLocaleString('ko-KR')}
                  </td>
                  <td className={ERP_TABLE_TD_CLASS}>
                    <StatusBadge
                      label={getDeliveryStatusLabel(availability)}
                      className={statusBadgeClass(tone)}
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
