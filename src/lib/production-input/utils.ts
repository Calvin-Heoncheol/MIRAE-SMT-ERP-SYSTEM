import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import type { Product, ProductPcbSideMode } from '@/lib/products/types'
import { normalizeProductPcbSideMode } from '@/lib/products/utils'
import { buildSmtCountKey } from '@/lib/smt/count-keys'
import type { SmtPcbSide } from '@/lib/smt/types'
import type { OrderListGroup } from '@/lib/orders/types'
import type {
  ProductionCounts,
  ProductionInputConfig,
  ProductionOrderLine,
  ProductionOrderState,
} from './types'

export const PRODUCTION_ORDER_PAGE_SIZE = 5

function resolveProductPcbSideMode(
  productId: string | null | undefined,
  productById: Record<string, Product>,
): ProductPcbSideMode {
  const id = productId?.trim() || ''
  if (!id) return 'single'
  return productById[id]?.pcbSideMode ?? 'single'
}

export function buildProductionCountKey(order: ProductionOrderLine, pcbSide: SmtPcbSide = 'SINGLE') {
  if (order.splitPcbSides) {
    return buildSmtCountKey(order.orderLineId, pcbSide)
  }
  if (order.assemblyGroupId) {
    return order.assemblyGroupId
  }
  return order.orderLineId
}

export function buildProductionOrderLines(
  orders: OrderListGroup[],
  productKindLabel: string,
  productById: Record<string, Product> = {},
  productionModule: ProductionInputConfig['productionModule'] = 'smt',
): ProductionOrderLine[] {
  const lines: ProductionOrderLine[] = []

  for (const order of orders) {
    order.items.forEach((item, index) => {
      const productName = item.productName.trim()
      const productCode = item.productCode.trim()
      const orderLineId = item.lineId?.trim() || ''
      if (!orderLineId) return
      if (!productName && !productCode) return

      const productId = (item.productId || productCode).trim()
      const product = productById[productId]
      const isDerivedLine = Boolean(item.derivedFromLineId)

      if (
        productionModule === 'smt' &&
        product?.productKind === 'assembly' &&
        !isDerivedLine
      ) {
        return
      }

      const pcbSideMode = resolveProductPcbSideMode(productId, productById)
      const splitPcbSides = productionModule === 'smt' && pcbSideMode === 'dual'

      const labelParts: string[] = []
      if (productName) labelParts.push(productName)
      if (productCode) labelParts.push(`[${productCode}]`)
      if (splitPcbSides) labelParts.push('양면')
      labelParts.push(`수량${item.quantity}`)
      labelParts.push(`단가${Math.round(item.unitPrice)}`)

      const productLabel = labelParts.join(' · ')
      const uiKey = `${order.orderNumber}\u001e${index}\u001e${orderLineId}`
      const countKey = orderLineId

      lines.push({
        uiKey,
        countKey,
        orderLineId,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        customer: order.customer,
        productCode,
        productName,
        productLabel,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineSeq: index,
        productKind: 'semi',
        productKindLabel,
        pcbSideMode,
        splitPcbSides,
      })
    })
  }

  return lines
}

export function buildPostProcessAssemblyLines(
  assemblyGroups: OrderAssemblyGroup[],
  orders: OrderListGroup[],
  productById: Record<string, Product> = {},
): ProductionOrderLine[] {
  const orderById = Object.fromEntries(orders.map((order) => [order.orderId, order]))
  const lines: ProductionOrderLine[] = []

  for (const group of assemblyGroups) {
    const order = orderById[group.orderId]
    if (!order) continue

    const productName = group.parentProductName.trim()
    const productCode = group.parentProductCode.trim()
    if (!productName && !productCode) continue

    const parentProduct = productById[group.parentProductId]
    const isFinished = parentProduct?.productKind === 'assembly'
    const productKindLabel = isFinished ? '완제품' : '반제품'

    const labelParts: string[] = []
    if (productName) labelParts.push(productName)
    if (productCode) labelParts.push(`[${productCode}]`)
    if (isFinished && group.lines.length) {
      labelParts.push(`구성 ${group.lines.map((line) => line.childProductId).join('+')}`)
    }
    labelParts.push(`수량${group.targetQuantity}`)

    lines.push({
      uiKey: `${order.orderNumber}\u001easm\u001e${group.id}`,
      countKey: group.id,
      orderLineId: group.id,
      assemblyGroupId: group.id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      customer: order.customer,
      productCode,
      productName,
      productLabel: labelParts.join(' · '),
      quantity: group.targetQuantity,
      unitPrice: 0,
      lineSeq: group.groupSeq,
      productKind: isFinished ? 'finished' : 'semi',
      productKindLabel,
      pcbSideMode: parentProduct?.pcbSideMode ?? 'single',
      splitPcbSides: false,
    })
  }

  return lines.sort((a, b) => {
    const dateCompare = b.orderDate.localeCompare(a.orderDate)
    if (dateCompare !== 0) return dateCompare
    const orderCompare = b.orderNumber.localeCompare(a.orderNumber)
    if (orderCompare !== 0) return orderCompare
    return a.lineSeq - b.lineSeq
  })
}

export function resolveProductionSideCount(
  order: ProductionOrderLine,
  counts: ProductionCounts,
  pcbSide: SmtPcbSide = 'SINGLE',
) {
  const key = buildProductionCountKey(order, pcbSide)
  if (counts[key] != null) {
    return Math.max(0, Math.floor(Number(counts[key]) || 0))
  }
  return 0
}

export function resolveProductionCount(order: ProductionOrderLine, counts: ProductionCounts) {
  if (order.splitPcbSides) {
    const top = resolveProductionSideCount(order, counts, 'TOP')
    const bot = resolveProductionSideCount(order, counts, 'BOT')
    return Math.min(top, bot)
  }
  return resolveProductionSideCount(order, counts, 'SINGLE')
}

export function getProductionSideCounts(order: ProductionOrderLine, counts: ProductionCounts) {
  if (order.splitPcbSides) {
    return {
      TOP: resolveProductionSideCount(order, counts, 'TOP'),
      BOT: resolveProductionSideCount(order, counts, 'BOT'),
    }
  }
  return {
    SINGLE: resolveProductionSideCount(order, counts, 'SINGLE'),
  }
}

export function getProductionOrderState(
  order: ProductionOrderLine,
  counts: ProductionCounts,
): ProductionOrderState {
  const total = Math.max(0, Math.floor(order.quantity))

  if (order.splitPcbSides) {
    const top = resolveProductionSideCount(order, counts, 'TOP')
    const bot = resolveProductionSideCount(order, counts, 'BOT')
    if (top <= 0 && bot <= 0) return 'none'
    if (total > 0 && top >= total && bot >= total) return 'full'
    return 'progress'
  }

  const cumulative = resolveProductionSideCount(order, counts, 'SINGLE')
  if (cumulative <= 0) return 'none'
  if (total > 0 && cumulative >= total) return 'full'
  return 'progress'
}

export function getProductionOrderPrefix(state: ProductionOrderState) {
  if (state === 'full') return '●'
  if (state === 'progress') return '◐'
  return '○'
}

export function formatProductionProductName(order: ProductionOrderLine) {
  return order.productName.trim() || order.productCode.trim() || '—'
}

export function formatProductionSideProgressLabel(order: ProductionOrderLine, counts: ProductionCounts) {
  if (!order.splitPcbSides) {
    const cumulative = resolveProductionSideCount(order, counts, 'SINGLE')
    return `${cumulative.toLocaleString('ko-KR')}`
  }

  const top = resolveProductionSideCount(order, counts, 'TOP')
  const bot = resolveProductionSideCount(order, counts, 'BOT')
  return `TOP ${top.toLocaleString('ko-KR')} · BOT ${bot.toLocaleString('ko-KR')}`
}

export function filterProductionOrders(orders: ProductionOrderLine[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return orders
  return orders.filter((order) => {
    const haystack = [
      order.orderNumber,
      order.customer,
      order.productName,
      order.productCode,
      order.productLabel,
      order.splitPcbSides ? '양면 top bot' : '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function getProgressPercent(cumulative: number, target: number) {
  if (target <= 0) return 0
  return Math.min(100, Math.round((cumulative / target) * 100))
}

export function normalizeProductionPcbSideMode(value: string | null | undefined) {
  return normalizeProductPcbSideMode(value)
}
