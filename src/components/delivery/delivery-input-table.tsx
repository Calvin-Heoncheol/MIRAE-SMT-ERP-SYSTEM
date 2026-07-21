'use client'

import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductName } from '@/lib/production-input/utils'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import {
  getDeliveryStatusLabel,
  getDeliveryStatusTone,
  resolveDeliveryAvailabilityForOrder,
} from '@/lib/delivery/utils'

type DeliveryInputTableProps = {
  orders: ProductionOrderLine[]
  availabilityByGroupId: Record<string, DeliveryAvailability>
  selectedKey: string
  emptyMessage: string
  onSelect: (uiKey: string) => void
}

function statusBadgeClass(tone: ReturnType<typeof getDeliveryStatusTone>) {
  if (tone === 'shippable') return 'bg-blue-50 text-blue-700 ring-blue-100'
  if (tone === 'partial') return 'bg-amber-50 text-amber-800 ring-amber-100'
  if (tone === 'complete') return 'bg-slate-100 text-slate-600 ring-slate-200'
  return 'bg-rose-50 text-rose-700 ring-rose-100'
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
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">{emptyMessage}</p>
        <p className="mt-2 text-sm text-slate-500">조건을 바꾸거나 목록에서 주문을 선택해 출하를 등록하세요.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                주문번호
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                고객사
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                완제품
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                납기
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                주문
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                출하
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                가능
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                상태
              </th>
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
                    selected ? 'bg-blue-50/80' : 'hover:bg-slate-50',
                  ].join(' ')}
                >
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                    {order.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{order.customer || '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatProductionProductName(order)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <DeliveryDueBadge deliveryDate={order.deliveryDate} done={tone === 'complete'} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {availability.targetQuantity.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {availability.shipped.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-700">
                    {availability.shippable.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
                        statusBadgeClass(tone),
                      ].join(' ')}
                    >
                      {getDeliveryStatusLabel(availability)}
                    </span>
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
