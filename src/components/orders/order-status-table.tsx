'use client'

import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import { getProgressPercent } from '@/lib/production-input/utils'
import type {
  ProductionStatusLine,
  ProductionStatusProductLine,
} from '@/lib/production-status/types'
import { ERP_BADGE_COMPACT_CLASS, ERP_TABLE_SCROLL_CLASS, ERP_TABLE_TD_WRAP_CLASS } from '@/lib/ui/tokens'

type OrderStatusTableProps = {
  lines: ProductionStatusLine[]
  availabilityByGroupId?: Record<string, DeliveryAvailability>
}

type ShipmentRow = {
  key: string
  orderNumber: string
  customer: string
  productName: string
  productCode: string
  deliveryDate: string
  target: number
  shipped: number
  shippable: number
}

function OrderStatusBadge({
  done,
  hasTarget,
  shipped,
}: {
  done: boolean
  hasTarget: boolean
  shipped: number
}) {
  const base = ERP_BADGE_COMPACT_CLASS
  if (!hasTarget) {
    return <span className={`${base} bg-slate-100 text-slate-500 ring-slate-200`}>대상없음</span>
  }
  if (done) {
    return (
      <span className={`${base} bg-emerald-50 text-emerald-700 ring-emerald-200`}>완료</span>
    )
  }
  if (shipped > 0) {
    return (
      <span className={`${base} bg-amber-50 text-amber-800 ring-amber-200`}>일부출하</span>
    )
  }
  return (
    <span className={`${base} bg-slate-100 text-slate-600 ring-slate-200`}>미출하</span>
  )
}

/** 수량(48/100) 위 + 막대 — %는 표시하지 않음 */
function ShipmentProgress({
  value,
  target,
  barClass,
}: {
  value: number
  target: number
  barClass: string
}) {
  if (target <= 0) {
    return <span className="text-sm tabular-nums text-slate-400">—</span>
  }

  const percent = getProgressPercent(value, target)

  return (
    <div className="min-w-[108px]">
      <p className="mb-1.5 text-xs font-semibold tabular-nums text-slate-700">
        {value.toLocaleString('ko-KR')} / {target.toLocaleString('ko-KR')}
      </p>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        {percent > 0 ? (
          <div className={`h-full shrink-0 ${barClass}`} style={{ width: `${percent}%` }} />
        ) : null}
      </div>
    </div>
  )
}

function sumShippable(
  assemblyGroupIds: string[],
  availabilityByGroupId: Record<string, DeliveryAvailability>,
) {
  let total = 0
  for (const id of assemblyGroupIds) {
    total += Math.max(0, availabilityByGroupId[id]?.shippable ?? 0)
  }
  return total
}

function buildShipmentRows(
  lines: ProductionStatusLine[],
  availabilityByGroupId: Record<string, DeliveryAvailability>,
): ShipmentRow[] {
  const rows: ShipmentRow[] = []

  for (const line of lines) {
    if (line.products.length > 0) {
      for (const product of line.products) {
        rows.push({
          key: `${line.orderId}:${product.key}`,
          orderNumber: line.orderNumber,
          customer: line.customer,
          productName: product.productName,
          productCode: product.productCode,
          deliveryDate: line.deliveryDate,
          target: Math.max(0, product.deliveryTarget || product.quantity),
          shipped: Math.max(0, product.deliveryProduced),
          shippable: sumShippable(product.assemblyGroupIds, availabilityByGroupId),
        })
      }
      continue
    }

    rows.push({
      key: line.orderId,
      orderNumber: line.orderNumber,
      customer: line.customer,
      productName: line.productName,
      productCode: '',
      deliveryDate: line.deliveryDate,
      target: Math.max(0, line.deliveryTarget || line.quantity),
      shipped: Math.max(0, line.deliveryProduced),
      shippable: 0,
    })
  }

  return rows
}

export function OrderStatusTable({
  lines,
  availabilityByGroupId = {},
}: OrderStatusTableProps) {
  const rows = buildShipmentRows(lines, availabilityByGroupId)

  if (!rows.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState
          message="표시할 주문서가 없습니다"
          hint="주문서를 등록하면 출하 현황이 여기에 표시됩니다."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className="min-w-[880px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50/95 backdrop-blur-sm">
            <tr>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                주문서
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                고객사
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                제품
              </th>
              <th className="whitespace-nowrap px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                납기
              </th>
              <th className="min-w-[140px] px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                출하가능
              </th>
              <th className="min-w-[140px] px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                출하누적
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const done = row.target > 0 && row.shipped >= row.target

              return (
                <tr key={row.key} className="border-t border-slate-200 bg-white hover:bg-slate-50/70">
                  <td
                    className="px-4 py-3.5 font-mono text-sm font-bold whitespace-nowrap text-slate-900"
                    title={row.orderNumber}
                  >
                    {formatInternalCodeLabel(row.orderNumber)}
                  </td>
                  <td className={`px-4 py-3.5 text-sm font-semibold text-slate-800 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                    {row.customer || '—'}
                  </td>
                  <td className={`px-4 py-3.5 text-sm text-slate-900 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                    <span className="font-medium">{row.productName || '—'}</span>
                    {row.productCode ? (
                      <span className="ml-1.5 font-mono text-[11px] whitespace-nowrap text-slate-400">
                        [{row.productCode}]
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <DeliveryDueBadge deliveryDate={row.deliveryDate} done={done} />
                  </td>
                  <td className="px-4 py-3.5">
                    <ShipmentProgress
                      value={row.shippable}
                      target={row.target}
                      barClass={row.shippable > 0 ? 'bg-sky-500' : 'bg-slate-300'}
                    />
                  </td>
                  <td className="px-4 py-3.5">
                    <ShipmentProgress
                      value={row.shipped}
                      target={row.target}
                      barClass={done ? 'bg-emerald-500' : row.shipped > 0 ? 'bg-amber-500' : 'bg-slate-300'}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <OrderStatusBadge done={done} hasTarget={row.target > 0} shipped={row.shipped} />
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

/** 주문 내 모든 출하 대상 제품이 완료되면 true */
export function isOrderShipmentComplete(line: ProductionStatusLine) {
  if (line.products.length > 0) {
    const targets = line.products.filter((product) => product.deliveryTarget > 0 || product.quantity > 0)
    if (!targets.length) return false
    return targets.every(isProductShipmentComplete)
  }
  return line.deliveryTarget > 0 && line.deliveryProduced >= line.deliveryTarget
}

function isProductShipmentComplete(product: ProductionStatusProductLine) {
  const target = Math.max(0, product.deliveryTarget || product.quantity)
  return target > 0 && product.deliveryProduced >= target
}
