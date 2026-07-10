import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import type { Product, ProductPcbSideMode } from '@/lib/products/types'
import { buildSmtCountKey } from '@/lib/smt/count-keys'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import { buildPostProcessAssemblyLines } from '@/lib/production-input/utils'

export type DeliveryAvailability = {
  targetQuantity: number
  smtSets: number
  postProduced: number
  shipped: number
  productionCap: number
  shippable: number
}

export type DeliveryInputPageData = {
  orders: ProductionOrderLine[]
  deliveryCounts: Record<string, number>
  availabilityByGroupId: Record<string, DeliveryAvailability>
}

export function resolveSmtProducedForLine(
  orderLineId: string,
  pcbSideMode: ProductPcbSideMode,
  smtCounts: Record<string, number>,
) {
  if (pcbSideMode === 'dual') {
    const top = Math.max(0, Math.floor(Number(smtCounts[buildSmtCountKey(orderLineId, 'TOP')]) || 0))
    const bot = Math.max(0, Math.floor(Number(smtCounts[buildSmtCountKey(orderLineId, 'BOT')]) || 0))
    return Math.min(top, bot)
  }

  return Math.max(0, Math.floor(Number(smtCounts[buildSmtCountKey(orderLineId, 'SINGLE')]) || 0))
}

export function computeAssemblySmtSets(
  group: Pick<OrderAssemblyGroup, 'lines'>,
  smtCounts: Record<string, number>,
  productById: Record<string, Product>,
) {
  if (!group.lines.length) return 0

  let minSets = Number.POSITIVE_INFINITY

  for (const line of group.lines) {
    const product = productById[line.childProductId]
    const pcbSideMode = product?.pcbSideMode ?? 'single'
    const produced = resolveSmtProducedForLine(line.orderLineId, pcbSideMode, smtCounts)
    const quantityPer = Math.max(1, Math.floor(Number(line.quantityPer) || 1))
    minSets = Math.min(minSets, Math.floor(produced / quantityPer))
  }

  return Number.isFinite(minSets) ? Math.max(0, minSets) : 0
}

export function computeDeliveryAvailability(
  group: OrderAssemblyGroup,
  smtCounts: Record<string, number>,
  postCounts: Record<string, number>,
  deliveryCounts: Record<string, number>,
  productById: Record<string, Product>,
): DeliveryAvailability {
  const smtSets = computeAssemblySmtSets(group, smtCounts, productById)
  const postProduced = Math.max(0, Math.floor(Number(postCounts[group.id]) || 0))
  const shipped = Math.max(0, Math.floor(Number(deliveryCounts[group.id]) || 0))
  const productionCap = Math.min(smtSets, postProduced)
  const shippable = Math.max(0, productionCap - shipped)

  return {
    targetQuantity: Math.max(0, Math.floor(group.targetQuantity)),
    smtSets,
    postProduced,
    shipped,
    productionCap,
    shippable,
  }
}

export function buildDeliveryAvailabilityMap(
  groups: OrderAssemblyGroup[],
  smtCounts: Record<string, number>,
  postCounts: Record<string, number>,
  deliveryCounts: Record<string, number>,
  productById: Record<string, Product>,
) {
  const map: Record<string, DeliveryAvailability> = {}
  for (const group of groups) {
    map[group.id] = computeDeliveryAvailability(group, smtCounts, postCounts, deliveryCounts, productById)
  }
  return map
}

export function buildDeliveryInputOrders(
  groups: OrderAssemblyGroup[],
  orders: Parameters<typeof buildPostProcessAssemblyLines>[1],
  productById: Record<string, Product>,
) {
  return buildPostProcessAssemblyLines(groups, orders, productById)
}

export type DeliveryOrderState = 'none' | 'progress' | 'full'

export function getDeliveryOrderState(availability: DeliveryAvailability): DeliveryOrderState {
  const { shipped, targetQuantity } = availability

  if (targetQuantity > 0 && shipped >= targetQuantity) return 'full'
  if (shipped > 0) return 'progress'
  return 'none'
}

export function getDeliveryOrderPrefix(state: DeliveryOrderState) {
  if (state === 'full') return '●'
  if (state === 'progress') return '◐'
  return '○'
}

export function describeDeliveryBlockReason(availability: DeliveryAvailability) {
  const { smtSets, postProduced, shipped, productionCap, shippable, targetQuantity } = availability

  if (shippable > 0) {
    return `최대 ${shippable.toLocaleString('ko-KR')}대까지 출하할 수 있습니다.`
  }

  if (targetQuantity > 0 && shipped >= targetQuantity) {
    return '주문 수량만큼 출하가 완료되었습니다.'
  }

  if (productionCap > 0 && shipped >= productionCap) {
    return '생산 완료분은 모두 출하되었습니다.'
  }

  if (smtSets <= 0 && postProduced <= 0) {
    return 'SMT·후공정 생산 입력이 필요합니다.'
  }

  if (smtSets < postProduced) {
    return `SMT 생산이 부족합니다. (SMT ${smtSets.toLocaleString('ko-KR')}대 · 후공정 ${postProduced.toLocaleString('ko-KR')}대)`
  }

  if (postProduced < smtSets) {
    return `후공정 생산이 부족합니다. (SMT ${smtSets.toLocaleString('ko-KR')}대 · 후공정 ${postProduced.toLocaleString('ko-KR')}대)`
  }

  return '출하 가능한 수량이 없습니다.'
}

export function filterDeliveryOrders(orders: ProductionOrderLine[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return orders

  return orders.filter((order) =>
    [order.orderNumber, order.customer, order.productName, order.productCode, order.productLabel]
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
}

export const DELIVERY_ORDER_PAGE_SIZE = 8

export type DeliveryInputFilter = 'all' | 'shippable' | 'partial' | 'complete' | 'blocked'

export function resolveDeliveryAvailabilityForOrder(
  order: ProductionOrderLine,
  availabilityByGroupId: Record<string, DeliveryAvailability>,
): DeliveryAvailability {
  const groupId = order.assemblyGroupId || order.orderLineId
  return (
    availabilityByGroupId[groupId] ?? {
      targetQuantity: order.quantity,
      smtSets: 0,
      postProduced: 0,
      shipped: 0,
      productionCap: 0,
      shippable: 0,
    }
  )
}

export type DeliveryInputSummary = {
  total: number
  shippable: number
  partial: number
  complete: number
  blocked: number
}

export function summarizeDeliveryInputOrders(
  orders: ProductionOrderLine[],
  availabilityByGroupId: Record<string, DeliveryAvailability>,
): DeliveryInputSummary {
  let shippable = 0
  let partial = 0
  let complete = 0
  let blocked = 0

  for (const order of orders) {
    const availability = resolveDeliveryAvailabilityForOrder(order, availabilityByGroupId)
    const state = getDeliveryOrderState(availability)

    if (state === 'full') {
      complete += 1
      continue
    }

    if (availability.shippable > 0) {
      shippable += 1
      if (state === 'progress') partial += 1
      continue
    }

    if (state === 'progress') {
      partial += 1
      blocked += 1
      continue
    }

    blocked += 1
  }

  return { total: orders.length, shippable, partial, complete, blocked }
}

export function filterDeliveryOrdersByStatus(
  orders: ProductionOrderLine[],
  availabilityByGroupId: Record<string, DeliveryAvailability>,
  filter: DeliveryInputFilter,
) {
  if (filter === 'all') return orders

  return orders.filter((order) => {
    const availability = resolveDeliveryAvailabilityForOrder(order, availabilityByGroupId)
    const state = getDeliveryOrderState(availability)

    if (filter === 'complete') return state === 'full'
    if (filter === 'shippable') return availability.shippable > 0
    if (filter === 'partial') return state === 'progress'
    if (filter === 'blocked') return state !== 'full' && availability.shippable <= 0
    return true
  })
}

export function getDeliveryStatusLabel(availability: DeliveryAvailability) {
  const state = getDeliveryOrderState(availability)
  if (state === 'full') return '완료'
  if (availability.shippable > 0) return '출하가능'
  if (state === 'progress') return '부분출하'
  return '출하불가'
}

export function getDeliveryStatusTone(availability: DeliveryAvailability) {
  const state = getDeliveryOrderState(availability)
  if (state === 'full') return 'complete' as const
  if (availability.shippable > 0) return 'shippable' as const
  if (state === 'progress') return 'partial' as const
  return 'blocked' as const
}
