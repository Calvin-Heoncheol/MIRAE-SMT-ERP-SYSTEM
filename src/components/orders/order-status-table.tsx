'use client'

import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import { getProgressPercent } from '@/lib/production-input/utils'
import type {
  ProductionStatusLine,
  ProductionStatusProductLine,
} from '@/lib/production-status/types'
import {
  ERP_BADGE_COMPACT_CLASS,
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_ROW_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TD_FIXED_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

type OrderStatusTableProps = {
  lines: ProductionStatusLine[]
  availabilityByGroupId?: Record<string, DeliveryAvailability>
  emptyMessage?: string
}

type ShipmentRow = {
  key: string
  orderNumber: string
  customerPoNumber: string
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
          customerPoNumber: line.customerPoNumber,
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
      customerPoNumber: line.customerPoNumber,
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

export function summarizeOrderShipmentKpi(
  lines: ProductionStatusLine[],
  availabilityByGroupId: Record<string, DeliveryAvailability> = {},
) {
  const rows = buildShipmentRows(lines, availabilityByGroupId)
  return {
    activeCount: lines.filter((line) => !isOrderShipmentComplete(line)).length,
    doneCount: lines.filter(isOrderShipmentComplete).length,
    shippable: rows.reduce((sum, row) => sum + row.shippable, 0),
    shipped: rows.reduce((sum, row) => sum + row.shipped, 0),
    remaining: rows.reduce((sum, row) => sum + Math.max(0, row.target - row.shipped), 0),
  }
}

export function OrderStatusTable({
  lines,
  availabilityByGroupId = {},
  emptyMessage,
}: OrderStatusTableProps) {
  const rows = buildShipmentRows(lines, availabilityByGroupId)

  if (!rows.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage ?? '표시할 발주서가 없습니다'} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className={`${ERP_TABLE_CLASS} min-w-[980px]`}>
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>발주서</th>
              <th className={ERP_TABLE_TH_CLASS}>고객사</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>품목코드</th>
              <th className={ERP_TABLE_TH_CLASS}>제품</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>납기</th>
              <th className={`${ERP_TABLE_TH_CLASS} min-w-[140px]`}>출하가능</th>
              <th className={`${ERP_TABLE_TH_CLASS} min-w-[140px]`}>출하누적</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const done = row.target > 0 && row.shipped >= row.target

              return (
                <tr key={row.key} className={ERP_TABLE_ROW_CLASS}>
                  <td
                    className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-mono text-sm font-bold text-slate-900`}
                    title={displayOrderPoNumber(row.customerPoNumber, row.orderNumber)}
                  >
                    {displayOrderPoNumber(row.customerPoNumber, row.orderNumber) || '—'}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_WRAP_CLASS} font-semibold text-slate-800`}>
                    {row.customer || '—'}
                  </td>
                  <td
                    className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-mono text-xs text-slate-700`}
                    title={row.productCode || undefined}
                  >
                    {row.productCode || '—'}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_WRAP_CLASS} font-medium text-slate-900`}>
                    {row.productName || '—'}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
                    <DeliveryDueBadge deliveryDate={row.deliveryDate} done={done} />
                  </td>
                  <td className={ERP_TABLE_TD_CLASS}>
                    <ShipmentProgress
                      value={row.shippable}
                      target={row.target}
                      barClass={row.shippable > 0 ? 'bg-sky-500' : 'bg-slate-300'}
                    />
                  </td>
                  <td className={ERP_TABLE_TD_CLASS}>
                    <ShipmentProgress
                      value={row.shipped}
                      target={row.target}
                      barClass={done ? 'bg-emerald-500' : row.shipped > 0 ? 'bg-amber-500' : 'bg-slate-300'}
                    />
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
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
