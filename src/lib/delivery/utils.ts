import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import type { OrderListGroup } from '@/lib/orders/types'
import { isBillingOnlyOrderItem } from '@/lib/orders/utils'
import type { Product, ProductPcbSideMode } from '@/lib/products/types'
import { isSplitProductPcbSideMode } from '@/lib/products/utils'
import { buildSmtCountKey } from '@/lib/smt/count-keys'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import {
  assemblyGroupIncludesPostProcess,
  assemblyGroupIncludesSmt,
  buildDeliveryAssemblyLines,
  processTypeIncludesSmt,
  resolveAssemblyProductionCap,
} from '@/lib/production-input/utils'
import { parseItemVersionCode } from '@/lib/items/version-code'

/** 거래명세서·출하 화면용 품목코드 — 내부 id 대신 품목등록 base_code 우선 */
export function resolveStatementDisplayProductCode(input: {
  productCode?: string
  productId?: string
  orderProductCode?: string
  masterProductCode?: string
}): string {
  const shipped = String(input.productCode || '').trim()
  const orderCode = String(input.orderProductCode || '').trim()
  const productId = String(input.productId || '').trim()
  const master = String(input.masterProductCode || '').trim()

  if (master) return master
  if (orderCode && (!shipped || shipped === productId)) return orderCode
  if (shipped && productId && shipped !== productId) return shipped
  if (orderCode) return orderCode
  if (shipped) return shipped
  if (productId) return parseItemVersionCode(productId).base || productId
  return ''
}

export type DeliveryAvailability = {
  targetQuantity: number
  smtSets: number
  postProduced: number
  shipped: number
  productionCap: number
  shippable: number
  needsSmt: boolean
  needsPost: boolean
}

export type DeliveryBillingOnlyLine = {
  orderLineId: string
  orderNumber: string
  customerPoNumber: string
  customer: string
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
}

export type DeliveryInputPageData = {
  orders: ProductionOrderLine[]
  /** 발주 추가작업(금액 전용) — 출하 시 명세에 별도 행으로 붙음 */
  billingOnlyLines: DeliveryBillingOnlyLine[]
  deliveryCounts: Record<string, number>
  availabilityByGroupId: Record<string, DeliveryAvailability>
}

/** 발주서의 추가작업(금액 전용) 라인을 출하 UI용으로 추출 */
export function buildDeliveryBillingOnlyLines(orders: OrderListGroup[]): DeliveryBillingOnlyLine[] {
  const lines: DeliveryBillingOnlyLine[] = []
  for (const order of orders) {
    for (const item of order.items || []) {
      if (item.derivedFromLineId) continue
      if (!isBillingOnlyOrderItem(item)) continue
      const orderLineId = String(item.lineId || '').trim()
      if (!orderLineId) continue
      const productName = String(item.productName || '').trim()
      if (!productName) continue
      lines.push({
        orderLineId,
        orderNumber: order.orderNumber,
        customerPoNumber: order.customerPoNumber || '',
        customer: order.customer,
        productCode: String(item.productCode || '').trim() || 'TEMP',
        productName,
        quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
        unitPrice: Math.max(0, Math.round(Number(item.unitPrice) || 0)),
      })
    }
  }
  return lines
}

export type BillingShippedQuantityLine = {
  productCode: string
  productName?: string
  /** 발주서 product_id — 출하 이력(품목 id)과 추가작업 코드 매칭용 */
  productId?: string
  quantity: number
}

/**
 * 추가작업(금액 전용) 수량 = 같은 발주에서 이번에 출하하는 제품 수량 기준.
 * 품목코드가 같으면 해당 제품 출하 수량, TEMP 등이면 발주 출하 제품 수량 합.
 */
export function resolveBillingQuantityFromShipped(input: {
  billingProductCode: string
  billingProductName: string
  shippedLines: BillingShippedQuantityLine[]
}): number {
  const billingCode = String(input.billingProductCode || '').trim().toLowerCase()
  const billingName = String(input.billingProductName || '').trim().toLowerCase()
  const lines = input.shippedLines

  if (!lines.length) return 0

  const sumQty = (matched: BillingShippedQuantityLine[]) =>
    matched.reduce((sum, line) => sum + Math.max(0, Math.floor(Number(line.quantity) || 0)), 0)

  if (billingCode && billingCode !== 'temp') {
    const byCode = lines.filter((line) => {
      const code = String(line.productCode || '').trim().toLowerCase()
      const id = String(line.productId || '').trim().toLowerCase()
      return code === billingCode || (id && id === billingCode)
    })
    if (byCode.length) return sumQty(byCode)
  }

  if (billingName) {
    const byName = lines.filter(
      (line) => String(line.productName || '').trim().toLowerCase() === billingName,
    )
    if (byName.length) return sumQty(byName)
  }

  if (!billingCode || billingCode === 'temp') {
    return sumQty(lines)
  }

  return 0
}

function normalizeBillingMatchText(value: string) {
  return String(value || '').trim().toLowerCase()
}

export function isGenericBillingProductCode(productCode: string) {
  const code = normalizeBillingMatchText(productCode)
  return !code || code === 'temp'
}

/** 추가작업 행이 어느 제품 출하 행 아래에 붙을지 판별 */
export function billingLineMatchesProductRow(
  billing: Pick<DeliveryBillingOnlyLine, 'orderNumber' | 'productCode' | 'productName'>,
  product: Pick<BillingShippedQuantityLine, 'productCode' | 'productName' | 'productId'> & {
    orderNumber: string
  },
  options?: { isLastProductRowForOrder?: boolean },
): boolean {
  if (billing.orderNumber.trim() !== product.orderNumber.trim()) return false

  const billingCode = normalizeBillingMatchText(billing.productCode)
  const productCode = normalizeBillingMatchText(product.productCode)
  const productId = normalizeBillingMatchText(product.productId || '')
  if (billingCode && billingCode !== 'temp') {
    return (
      billingCode === productCode || Boolean(productId && billingCode === productId)
    )
  }

  const billingName = normalizeBillingMatchText(billing.productName)
  const productName = normalizeBillingMatchText(product.productName || '')
  if (billingName && productName) {
    return billingName === productName
  }

  return Boolean(options?.isLastProductRowForOrder)
}

export type StatementShippedProductLine = {
  orderNumber: string
  productCode: string
  productName: string
  qty: number
  unitPrice?: number | null
  productId?: string
  /** 발주서 product_code — 출하 이력(품목 id)과 추가작업 코드 매칭용 */
  orderProductCode?: string
}

export type StatementShippedLine = StatementShippedProductLine & {
  billingOnly?: boolean
  orderLineId?: string
}

/** 제품 출하 행 사이에 추가작업 행을 끼워 넣는다 (출하 등록 UI와 동일 규칙) */
export function interleaveStatementShippedLinesWithBilling(
  productLines: StatementShippedProductLine[],
  billingLines: DeliveryBillingOnlyLine[],
): StatementShippedLine[] {
  const orderIds = new Set(productLines.map((line) => line.orderNumber.trim()).filter(Boolean))
  const matchProducts = productLines.map((line) => ({
    orderNumber: line.orderNumber,
    productCode: line.orderProductCode || line.productCode,
    productName: line.productName,
    productId: line.productId,
  }))

  const insertAfter = new Map<number, StatementShippedLine[]>()

  for (const billing of billingLines) {
    if (!orderIds.has(billing.orderNumber.trim())) continue

    const anchorIndex = findBillingAnchorProductIndex(billing, matchProducts)
    if (anchorIndex < 0) continue

    const orderProducts = productLines.filter(
      (item) => item.orderNumber.trim() === billing.orderNumber.trim(),
    )
    const shippedForQty = orderProducts.map((item) => ({
      productCode: item.orderProductCode || item.productCode,
      productName: item.productName,
      productId: item.productId,
      quantity: item.qty,
    }))

    let qty = resolveBillingQuantityFromShipped({
      billingProductCode: billing.productCode,
      billingProductName: billing.productName,
      shippedLines: shippedForQty,
    })
    if (qty <= 0) {
      qty = isGenericBillingProductCode(billing.productCode)
        ? shippedForQty.reduce((sum, line) => sum + line.quantity, 0)
        : (productLines[anchorIndex]?.qty ?? 0)
    }
    if (qty <= 0) continue

    const bucket = insertAfter.get(anchorIndex) ?? []
    bucket.push({
      orderNumber: billing.orderNumber,
      productCode: billing.productCode,
      productName: billing.productName,
      qty,
      unitPrice: billing.unitPrice,
      billingOnly: true,
      orderLineId: billing.orderLineId,
    })
    insertAfter.set(anchorIndex, bucket)
  }

  const result: StatementShippedLine[] = []
  productLines.forEach((product, index) => {
    result.push({ ...product, billingOnly: false })
    result.push(...(insertAfter.get(index) ?? []))
  })
  return result
}

type HistoryStatementLineInput = {
  id: string
  orderNumber: string
  assemblyGroupId: string
  productId: string
  productCode: string
  productName: string
  quantity: number
}

type HistoryStatementProductionOrder = {
  assemblyGroupId?: string
  orderNumber: string
  productId?: string
  productCode: string
  productName: string
  unitPrice: number
}

/** 출하 이력(제품 행만) + 발주 추가작업 → 거래명세서 품목 입력 */
export function buildShipmentStatementLinesFromHistory(input: {
  lines: HistoryStatementLineInput[]
  unitPriceByDeliveryId?: Record<string, number>
  billingOnlyLines: DeliveryBillingOnlyLine[]
  productionOrders: HistoryStatementProductionOrder[]
}): StatementShippedLine[] {
  const productLines: StatementShippedProductLine[] = input.lines.map((line) => {
    const production =
      input.productionOrders.find((order) => order.assemblyGroupId === line.assemblyGroupId) ||
      input.productionOrders.find(
        (order) =>
          order.orderNumber === line.orderNumber &&
          (order.productId === line.productId || order.productCode === line.productCode),
      )
    const unitPrice = input.unitPriceByDeliveryId?.[line.id]
    const productId = line.productId || production?.productId || line.productCode
    const productCode = production?.productCode || line.productCode
    return {
      orderNumber: line.orderNumber,
      productCode,
      productName: line.productName,
      qty: line.quantity,
      unitPrice:
        unitPrice != null
          ? unitPrice
          : production?.unitPrice != null
            ? production.unitPrice
            : null,
      productId,
      orderProductCode: production?.productCode || line.productCode,
    }
  })

  const orderIds = new Set(productLines.map((line) => line.orderNumber.trim()).filter(Boolean))
  const billingLines = input.billingOnlyLines.filter((line) => orderIds.has(line.orderNumber.trim()))

  return interleaveStatementShippedLinesWithBilling(productLines, billingLines)
}

export function findBillingAnchorProductIndex(
  billingLine: DeliveryBillingOnlyLine,
  productItems: Array<
    Pick<BillingShippedQuantityLine, 'productCode' | 'productName' | 'productId'> & {
      orderNumber: string
    }
  >,
): number {
  const orderNumber = billingLine.orderNumber.trim()
  const orderIndexes = productItems
    .map((item, index) => (item.orderNumber.trim() === orderNumber ? index : -1))
    .filter((index) => index >= 0)

  if (!orderIndexes.length) return -1

  for (const index of orderIndexes) {
    const product = productItems[index]!
    if (
      billingLineMatchesProductRow(billingLine, product, {
        isLastProductRowForOrder: false,
      })
    ) {
      return index
    }
  }

  return orderIndexes[orderIndexes.length - 1]!
}

export function resolveSmtProducedForLine(
  orderLineId: string,
  pcbSideMode: ProductPcbSideMode,
  smtCounts: Record<string, number>,
) {
  const single = Math.max(0, Math.floor(Number(smtCounts[buildSmtCountKey(orderLineId, 'SINGLE')]) || 0))
  if (isSplitProductPcbSideMode(pcbSideMode)) {
    const top = Math.max(0, Math.floor(Number(smtCounts[buildSmtCountKey(orderLineId, 'TOP')]) || 0))
    const bot = Math.max(0, Math.floor(Number(smtCounts[buildSmtCountKey(orderLineId, 'BOT')]) || 0))
    const paired = Math.min(top, bot)
    // 양면인데 SINGLE로만 찍힌 실적도 출하 가능으로 인정
    return paired > 0 ? paired : single
  }

  if (single > 0) return single
  const top = Math.max(0, Math.floor(Number(smtCounts[buildSmtCountKey(orderLineId, 'TOP')]) || 0))
  const bot = Math.max(0, Math.floor(Number(smtCounts[buildSmtCountKey(orderLineId, 'BOT')]) || 0))
  return Math.max(top, bot)
}

export function computeAssemblySmtSets(
  group: Pick<OrderAssemblyGroup, 'lines'>,
  smtCounts: Record<string, number>,
  productById: Record<string, Product>,
) {
  if (!group.lines.length) return 0

  let minSets = Number.POSITIVE_INFINITY
  let counted = 0

  for (const line of group.lines) {
    const childId = String(line.childProductId || '').trim()
    const product =
      productById[childId] ||
      Object.values(productById).find((item) => {
        const code = String(item.productCode || '').trim()
        return (
          item.id === childId ||
          code === childId ||
          code.toUpperCase() === childId.toUpperCase()
        )
      })
    const pcbSideMode = product?.pcbSideMode ?? 'single'
    const produced = resolveSmtProducedForLine(line.orderLineId, pcbSideMode, smtCounts)
    // 공정구분이 비어 있어도 SMT 실적이 있으면 출하 세트로 인정
    if (!processTypeIncludesSmt(product?.processType) && produced <= 0) continue

    const quantityPer = Math.max(1, Math.floor(Number(line.quantityPer) || 1))
    minSets = Math.min(minSets, Math.floor(produced / quantityPer))
    counted += 1
  }

  if (!counted) return 0
  return Number.isFinite(minSets) ? Math.max(0, minSets) : 0
}

export function computeDeliveryAvailability(
  group: OrderAssemblyGroup,
  smtCounts: Record<string, number>,
  postCounts: Record<string, number>,
  deliveryCounts: Record<string, number>,
  productById: Record<string, Product>,
): DeliveryAvailability {
  const needsSmt = assemblyGroupIncludesSmt(group, productById)
  const needsPost = assemblyGroupIncludesPostProcess(group, productById)
  const smtSets = computeAssemblySmtSets(group, smtCounts, productById)
  const postProduced = Math.max(0, Math.floor(Number(postCounts[group.id]) || 0))
  const shipped = Math.max(0, Math.floor(Number(deliveryCounts[group.id]) || 0))
  const productionCap = resolveAssemblyProductionCap({
    group,
    smtSets,
    postProduced,
    productById,
  })
  const shippable = Math.max(0, productionCap - shipped)

  return {
    targetQuantity: Math.max(0, Math.floor(group.targetQuantity)),
    smtSets,
    postProduced,
    shipped,
    productionCap,
    shippable,
    needsSmt,
    needsPost,
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
  orders: Parameters<typeof buildDeliveryAssemblyLines>[1],
  productById: Record<string, Product>,
  quotes: Parameters<typeof buildDeliveryAssemblyLines>[3] = [],
) {
  return buildDeliveryAssemblyLines(groups, orders, productById, quotes)
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
  const { smtSets, postProduced, shipped, productionCap, shippable, targetQuantity, needsSmt, needsPost } =
    availability

  if (shippable > 0) {
    return `최대 ${shippable.toLocaleString('ko-KR')}대까지 출하할 수 있습니다.`
  }

  if (targetQuantity > 0 && shipped >= targetQuantity) {
    return '발주 수량만큼 출하가 완료되었습니다.'
  }

  if (productionCap > 0 && shipped >= productionCap) {
    return '생산 완료분은 모두 출하되었습니다.'
  }

  if (needsSmt && needsPost) {
    if (smtSets <= 0 && postProduced <= 0) {
      return 'SMT·후공정 생산 입력이 필요합니다.'
    }
    if (smtSets <= 0) {
      return `SMT 생산이 필요합니다. (후공정 ${postProduced.toLocaleString('ko-KR')}대)`
    }
    if (postProduced <= 0) {
      return `후공정 생산이 필요합니다. (SMT ${smtSets.toLocaleString('ko-KR')}대)`
    }
    if (smtSets < postProduced) {
      return `SMT 생산이 부족합니다. (SMT ${smtSets.toLocaleString('ko-KR')}대 · 후공정 ${postProduced.toLocaleString('ko-KR')}대)`
    }
    if (postProduced < smtSets) {
      return `후공정 생산이 부족합니다. (SMT ${smtSets.toLocaleString('ko-KR')}대 · 후공정 ${postProduced.toLocaleString('ko-KR')}대)`
    }
  } else if (needsSmt) {
    if (smtSets <= 0) return 'SMT 생산 입력이 필요합니다.'
  } else if (needsPost) {
    if (postProduced <= 0) return '후공정 생산 입력이 필요합니다.'
  } else {
    return '출하 대상 공정이 없는 품목입니다.'
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
      needsSmt: true,
      needsPost: true,
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
  if (state === 'full') return '출하완료'
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

export function buildOrderLineToAssemblyGroupMap(groups: OrderAssemblyGroup[]) {
  const map = new Map<string, string>()
  for (const group of groups) {
    for (const line of group.lines) {
      map.set(line.orderLineId, group.id)
    }
  }
  return map
}

export function isAssemblyGroupDeliveryComplete(
  groupId: string,
  groups: OrderAssemblyGroup[],
  deliveryCounts: Record<string, number>,
) {
  const group = groups.find((item) => item.id === groupId)
  if (!group) return false

  const target = Math.max(0, Math.floor(group.targetQuantity))
  if (target <= 0) return false

  const shipped = Math.max(0, Math.floor(Number(deliveryCounts[groupId]) || 0))
  return shipped >= target
}

/**
 * 모든 조립 그룹이 목표 수량까지 출하된(= 출하 완료) 주문 ID 집합을 만듭니다.
 * 조립 그룹이 하나도 없는 주문은 완료로 취급하지 않습니다.
 */
export function buildFullyShippedOrderIdSet(
  groups: OrderAssemblyGroup[],
  deliveryCounts: Record<string, number>,
): Set<string> {
  const groupsByOrderId = new Map<string, OrderAssemblyGroup[]>()
  for (const group of groups) {
    if (Math.floor(group.targetQuantity) <= 0) continue
    const list = groupsByOrderId.get(group.orderId) ?? []
    list.push(group)
    groupsByOrderId.set(group.orderId, list)
  }

  const fullyShipped = new Set<string>()
  for (const [orderId, orderGroups] of groupsByOrderId) {
    const complete = orderGroups.every(
      (group) =>
        Math.max(0, Math.floor(Number(deliveryCounts[group.id]) || 0)) >=
        Math.floor(group.targetQuantity),
    )
    if (complete) fullyShipped.add(orderId)
  }
  return fullyShipped
}

/** 출하가 목표 수량까지 완료된 조립 그룹에 연결된 생산입력 주문 카드를 제외합니다. */
export function excludeDeliveryCompleteProductionOrders(
  orders: ProductionOrderLine[],
  groups: OrderAssemblyGroup[],
  deliveryCounts: Record<string, number>,
) {
  const lineToGroup = buildOrderLineToAssemblyGroupMap(groups)

  return orders.filter((order) => {
    const groupId = order.assemblyGroupId || lineToGroup.get(order.orderLineId) || ''
    if (!groupId) return true
    return !isAssemblyGroupDeliveryComplete(groupId, groups, deliveryCounts)
  })
}
