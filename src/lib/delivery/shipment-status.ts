import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import type { OrderListGroup } from '@/lib/orders/types'
import { displayOrderPoNumber, isBillingOnlyOrderItem } from '@/lib/orders/utils'
import { matchesDateRange, type DateRangeFilterValue } from '@/lib/ui/date-range'

/** 출하 1건 (차수) */
export type ShipmentRoundEntry = {
  id: string
  /** 거래명세서 묶음번호 */
  shipmentId: string
  recordDate: string
  quantity: number
  round: number
}

/** 출하현황 — 발주서 제품(라인) 1줄 */
export type ShipmentStatusRow = {
  key: string
  orderId: string
  assemblyGroupId: string
  orderDate: string
  deliveryDate: string
  /** 고객 PO 우선, 없으면 내부 발주ID */
  poNumber: string
  customer: string
  productName: string
  productCode: string
  orderQuantity: number
  shippedQuantity: number
  /** 출하일 오름차순 — 1차, 2차… */
  shipments: ShipmentRoundEntry[]
}

export type ShipmentRecordInput = Omit<ShipmentRoundEntry, 'round'> & {
  assemblyGroupId: string
  createdAt: string
}

export function groupShipmentRoundsByAssemblyGroup(records: ShipmentRecordInput[]) {
  const sorted = [...records].sort(
    (a, b) => a.recordDate.localeCompare(b.recordDate) || a.createdAt.localeCompare(b.createdAt),
  )
  const map = new Map<string, ShipmentRoundEntry[]>()
  for (const record of sorted) {
    if (!record.assemblyGroupId || record.quantity <= 0) continue
    const list = map.get(record.assemblyGroupId) ?? []
    list.push({
      id: record.id,
      shipmentId: record.shipmentId,
      recordDate: record.recordDate,
      quantity: record.quantity,
      round: list.length + 1,
    })
    map.set(record.assemblyGroupId, list)
  }
  return map
}

export type ShipmentStatusBucket = 'pending' | 'partial' | 'done'

export type ShipmentStatusFilter = 'open' | ShipmentStatusBucket | 'all'

export function classifyShipmentStatusRow(row: ShipmentStatusRow): ShipmentStatusBucket {
  if (row.orderQuantity > 0 && row.shippedQuantity >= row.orderQuantity) return 'done'
  if (row.shippedQuantity > 0) return 'partial'
  return 'pending'
}

export function matchesShipmentStatusFilter(row: ShipmentStatusRow, filter: ShipmentStatusFilter) {
  if (filter === 'all') return true
  const bucket = classifyShipmentStatusRow(row)
  if (filter === 'open') return bucket !== 'done'
  return bucket === filter
}

export function buildShipmentStatusRows(
  orders: OrderListGroup[],
  assemblyGroups: OrderAssemblyGroup[],
  deliveryCounts: Record<string, number>,
  roundsByAssemblyGroupId: Map<string, ShipmentRoundEntry[]> = new Map(),
): ShipmentStatusRow[] {
  const groupsByOrderId = new Map<string, OrderAssemblyGroup[]>()
  for (const group of assemblyGroups) {
    const list = groupsByOrderId.get(group.orderId) ?? []
    list.push(group)
    groupsByOrderId.set(group.orderId, list)
  }

  const rows: ShipmentStatusRow[] = []

  for (const order of orders) {
    const byParentProductId = new Map<string, OrderAssemblyGroup>()
    const byChildLineId = new Map<string, OrderAssemblyGroup>()
    for (const group of groupsByOrderId.get(order.orderId) ?? []) {
      byParentProductId.set(group.parentProductId, group)
      for (const line of group.lines) byChildLineId.set(line.orderLineId, group)
    }

    order.items.forEach((item, index) => {
      if (isBillingOnlyOrderItem(item)) return
      if (String(item.derivedFromLineId || '').trim()) return

      const productId = String(item.productId || '').trim()
      const lineId = String(item.lineId || '').trim()
      const group = byParentProductId.get(productId) ?? (lineId ? byChildLineId.get(lineId) : undefined)
      const shipped = group ? Math.max(0, Math.floor(Number(deliveryCounts[group.id]) || 0)) : 0

      rows.push({
        key: `${order.orderId}:${lineId || index}`,
        orderId: order.orderId,
        assemblyGroupId: group?.id ?? '',
        orderDate: order.orderDate,
        deliveryDate: String(item.deliveryDate || '').trim() || order.deliveryDate,
        poNumber: displayOrderPoNumber(order.customerPoNumber, order.orderId),
        customer: order.customer,
        productName: item.productName,
        productCode: item.productCode,
        orderQuantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
        shippedQuantity: shipped,
        shipments: group ? (roundsByAssemblyGroupId.get(group.id) ?? []) : [],
      })
    })
  }

  return rows.sort(
    (a, b) =>
      b.orderDate.localeCompare(a.orderDate) ||
      b.poNumber.localeCompare(a.poNumber) ||
      a.productName.localeCompare(b.productName),
  )
}

export function matchesShipmentStatusSearch(row: ShipmentStatusRow, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const shipmentIds = row.shipments.map((shipment) => shipment.shipmentId)
  return [row.poNumber, row.orderId, row.customer, row.productName, row.productCode, ...shipmentIds]
    .join(' ')
    .toLowerCase()
    .includes(q)
}

export function filterShipmentStatusRowsByDate(rows: ShipmentStatusRow[], range: DateRangeFilterValue) {
  return rows.filter((row) => matchesDateRange(row.deliveryDate, range))
}
