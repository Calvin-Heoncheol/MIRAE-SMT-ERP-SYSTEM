import type { OrderLineItem, OrderListGroup } from './types'
import { isBillingOnlyOrderItem } from './utils'

function formatProgressProductSummary(items: OrderLineItem[]) {
  if (!items.length) return '—'
  const first = items[0]?.productName.trim() || '—'
  if (items.length === 1) return first
  return `${first} 외 ${items.length - 1}건`
}

export type OrderProgressStatus = 'open' | 'partial' | 'done'

export type OrderProgressRow = {
  orderId: string
  orderNumber: string
  orderDate: string
  deliveryDate: string
  customer: string
  customerPoNumber: string
  category: OrderListGroup['category']
  productSummary: string
  orderedQuantity: number
  shippedQuantity: number
  remainingQuantity: number
  status: OrderProgressStatus
  lineCount: number
  createdByName: string
}

export const ORDER_PROGRESS_STATUS_LABELS: Record<OrderProgressStatus, string> = {
  open: '미출하',
  partial: '부분출하',
  done: '완료',
}

/** 발주현황 집계용 — 금액전용·BOM 파생 라인 제외 */
export function commercialOrderItems(order: OrderListGroup) {
  return order.items.filter(
    (item) => !isBillingOnlyOrderItem(item) && !String(item.derivedFromLineId || '').trim(),
  )
}

export function resolveOrderProgressStatus(
  orderedQuantity: number,
  shippedQuantity: number,
): OrderProgressStatus {
  const ordered = Math.max(0, Math.floor(orderedQuantity))
  const shipped = Math.max(0, Math.floor(shippedQuantity))
  if (ordered > 0 && shipped >= ordered) return 'done'
  if (shipped > 0) return 'partial'
  return 'open'
}

export function buildOrderProgressRow(
  order: OrderListGroup,
  shippedQuantity: number,
): OrderProgressRow {
  const lines = commercialOrderItems(order)
  const orderedQuantity = lines.reduce(
    (sum, item) => sum + Math.max(0, Math.floor(Number(item.quantity) || 0)),
    0,
  )
  const shipped = Math.max(0, Math.floor(shippedQuantity))
  const remainingQuantity = Math.max(0, orderedQuantity - shipped)
  const status = resolveOrderProgressStatus(orderedQuantity, shipped)

  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    orderDate: order.orderDate,
    deliveryDate: order.deliveryDate,
    customer: order.customer,
    customerPoNumber: order.customerPoNumber,
    category: order.category,
    productSummary: formatProgressProductSummary(lines.length ? lines : order.items),
    orderedQuantity,
    shippedQuantity: shipped,
    remainingQuantity,
    status,
    lineCount: lines.length,
    createdByName: order.createdByName,
  }
}

export function buildOrderProgressRows(
  orders: OrderListGroup[],
  shippedByOrderId: Record<string, number>,
): OrderProgressRow[] {
  return orders
    .map((order) =>
      buildOrderProgressRow(
        order,
        shippedByOrderId[order.orderId] ?? shippedByOrderId[order.orderNumber] ?? 0,
      ),
    )
    .sort((a, b) => {
      const dateCmp = String(b.orderDate).localeCompare(String(a.orderDate))
      if (dateCmp !== 0) return dateCmp
      return String(b.orderNumber).localeCompare(String(a.orderNumber))
    })
}

export function summarizeOrderProgressKpi(rows: OrderProgressRow[]) {
  return {
    orderCount: rows.length,
    openCount: rows.filter((row) => row.status === 'open').length,
    partialCount: rows.filter((row) => row.status === 'partial').length,
    doneCount: rows.filter((row) => row.status === 'done').length,
    orderedQuantity: rows.reduce((sum, row) => sum + row.orderedQuantity, 0),
    shippedQuantity: rows.reduce((sum, row) => sum + row.shippedQuantity, 0),
    remainingQuantity: rows.reduce((sum, row) => sum + row.remainingQuantity, 0),
  }
}

export function matchesOrderProgressSearch(row: OrderProgressRow, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [
    row.orderNumber,
    row.orderId,
    row.customer,
    row.customerPoNumber,
    row.productSummary,
    row.orderDate,
    row.deliveryDate,
    ORDER_PROGRESS_STATUS_LABELS[row.status],
  ]
    .join(' ')
    .toLowerCase()
    .includes(q)
}
