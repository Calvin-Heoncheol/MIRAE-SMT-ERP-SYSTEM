import type { ProductionOrderLine } from '@/lib/production-input/types'
import { matchesDateRange, type DateRangeFilterValue } from '@/lib/ui/date-range'
import type {
  MaterialManualHistoryKind,
  MaterialManualHistoryKindFilter,
  MaterialManualHistoryRow,
} from './types'

export type MaterialInboundFilter = 'all' | 'none' | 'partial' | 'full'

export type MaterialInboundState = 'none' | 'partial' | 'full'

export function resolveMaterialInboundSets(
  order: ProductionOrderLine,
  inboundByLineId: Record<string, number>,
) {
  return Math.max(0, Math.floor(inboundByLineId[order.orderLineId] ?? 0))
}

export function getMaterialInboundState(
  order: ProductionOrderLine,
  inboundSets: number,
): MaterialInboundState {
  const target = Math.max(0, Math.floor(order.quantity))
  const inbound = Math.max(0, Math.floor(inboundSets))
  if (inbound <= 0) return 'none'
  if (target > 0 && inbound >= target) return 'full'
  return 'partial'
}

export function materialInboundFilterLabel(state: MaterialInboundState) {
  if (state === 'none') return '미입고'
  if (state === 'partial') return '일부입고'
  return '입고완료'
}

export function materialOutboundProgressPercent(inboundSets: number, outboundSets: number) {
  const inbound = Math.max(0, Math.floor(inboundSets))
  const outbound = Math.max(0, Math.floor(outboundSets))
  if (inbound <= 0) return 0
  return Math.min(100, Math.round((outbound / inbound) * 100))
}

export function resolveMaterialOutboundSets(
  order: ProductionOrderLine,
  outboundByLineId: Record<string, number>,
) {
  return Math.max(0, Math.floor(outboundByLineId[order.orderLineId] ?? 0))
}

export function materialInboundProgressPercent(order: ProductionOrderLine, inboundSets: number) {
  const target = Math.max(0, Math.floor(order.quantity))
  if (target <= 0) return 0
  return Math.min(100, Math.round((Math.max(0, inboundSets) / target) * 100))
}

export function countMaterialInboundStates(
  orders: ProductionOrderLine[],
  inboundByLineId: Record<string, number>,
) {
  let none = 0
  let partial = 0
  let full = 0
  for (const order of orders) {
    const state = getMaterialInboundState(order, resolveMaterialInboundSets(order, inboundByLineId))
    if (state === 'none') none += 1
    else if (state === 'partial') partial += 1
    else full += 1
  }
  return { all: orders.length, none, partial, full }
}

export function filterOrdersByMaterialInbound(
  orders: ProductionOrderLine[],
  filter: MaterialInboundFilter,
  inboundByLineId: Record<string, number>,
) {
  if (filter === 'all') return orders
  return orders.filter(
    (order) =>
      getMaterialInboundState(order, resolveMaterialInboundSets(order, inboundByLineId)) === filter,
  )
}

export function materialManualHistoryKindLabel(kind: MaterialManualHistoryKind) {
  return kind === 'inbound' ? '입고' : '불출'
}

export function filterMaterialManualHistory(
  rows: MaterialManualHistoryRow[],
  query: string,
  kindFilter: MaterialManualHistoryKindFilter,
  dateRange: DateRangeFilterValue = {},
) {
  const q = query.trim().toLowerCase()

  return rows.filter((row) => {
    if (kindFilter !== 'all' && row.kind !== kindFilter) return false
    if (!matchesDateRange(row.recordDate, dateRange)) return false
    if (!q) return true

    const haystack = [
      materialManualHistoryKindLabel(row.kind),
      row.recordDate,
      row.orderNumber,
      row.customerPoNumber,
      row.customer,
      row.productName,
      row.productCode,
      row.createdByName,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
