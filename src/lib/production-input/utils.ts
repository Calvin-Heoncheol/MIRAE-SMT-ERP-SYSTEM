import type { Product, ProductPcbSideMode, ProductProcessType } from '@/lib/products/types'
import { isSplitProductPcbSideMode, normalizeProductPcbSideMode } from '@/lib/products/utils'
import { buildSmtCountKey } from '@/lib/smt/count-keys'
import type { SmtPcbSide } from '@/lib/smt/types'
import type { OrderListGroup } from '@/lib/orders/types'
import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import type {
  ProductionCounts,
  ProductionInputConfig,
  ProductionOrderLine,
  ProductionOrderState,
} from './types'

export const PRODUCTION_ORDER_PAGE_SIZE = 5

/** 미설정('')은 기존 데이터 호환 — SMT·후공정 모두 노출 */
export function processTypeIncludesSmt(processType: ProductProcessType | null | undefined) {
  const value = processType || ''
  return value === '' || value === 'smt' || value === 'smt_post'
}

export function processTypeIncludesPostProcess(processType: ProductProcessType | null | undefined) {
  const value = processType || ''
  return value === '' || value === 'post' || value === 'smt_post'
}

/** 완제품 구성 판정용 — 명시적으로 후공정이 있는 경우만 */
function processTypeRequiresPostProcess(processType: ProductProcessType | null | undefined) {
  return processType === 'post' || processType === 'smt_post'
}

function resolveProductProcessType(
  productId: string | null | undefined,
  productById: Record<string, Product>,
): ProductProcessType {
  const id = productId?.trim() || ''
  if (!id) return ''
  return productById[id]?.processType ?? ''
}

/**
 * 후공정 후보 여부.
 * 완제품(조립 그룹): 구성 반제품 중 공정이 후공정 / SMD+후공정인 것이 하나라도 있을 때만 노출.
 * (SMD만인 반제품으로만 구성된 완제품은 후공정에 안 보임. 미설정 반제품은 후공정 필요로 보지 않음.)
 * 주문에 반제품만 있는 경우 완제품으로 합치지 않고 반제품 단독 그룹으로 노출한다.
 */
function assemblyGroupIncludesPostProcess(
  group: OrderAssemblyGroup,
  productById: Record<string, Product>,
): boolean {
  if (group.lines.length > 0) {
    return group.lines.some((line) =>
      processTypeRequiresPostProcess(resolveProductProcessType(line.childProductId, productById)),
    )
  }

  const parent = productById[group.parentProductId]
  if (parent?.productKind === 'assembly') {
    return false
  }

  return processTypeIncludesPostProcess(resolveProductProcessType(group.parentProductId, productById))
}

function resolveProductPcbSideMode(
  productId: string | null | undefined,
  productById: Record<string, Product>,
): ProductPcbSideMode {
  const id = productId?.trim() || ''
  if (!id) return 'single'
  return productById[id]?.pcbSideMode ?? 'single'
}

export function buildProductionCountKey(order: ProductionOrderLine, pcbSide: SmtPcbSide = 'SINGLE') {
  // 후공정·출하: assembly group id 가 카운트 키
  if (order.assemblyGroupId) {
    return order.assemblyGroupId
  }
  // SMT totals always use `${orderLineId}:${pcbSide}` (including SINGLE)
  return buildSmtCountKey(order.orderLineId, pcbSide)
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

      if (productionModule === 'smt' && !processTypeIncludesSmt(product?.processType)) {
        return
      }

      const pcbSideMode = resolveProductPcbSideMode(productId, productById)
      const splitPcbSides = productionModule === 'smt' && isSplitProductPcbSideMode(pcbSideMode)

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
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        deliveryDate: order.deliveryDate,
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
    if (!assemblyGroupIncludesPostProcess(group, productById)) continue

    const productName = group.parentProductName.trim()
    const productCode = group.parentProductCode.trim()
    if (!productName && !productCode) continue

    const parentProduct = productById[group.parentProductId]
    const isFinished = parentProduct?.productKind === 'assembly'
    const productKindLabel = isFinished ? '완제품' : '반제품'

    const labelParts: string[] = []
    if (productName) labelParts.push(productName)
    if (productCode) labelParts.push(`[${productCode}]`)
    labelParts.push(`수량${group.targetQuantity}`)

    lines.push({
      uiKey: `${order.orderNumber}\u001easm\u001e${group.id}`,
      countKey: group.id,
      orderLineId: group.id,
      orderId: order.orderId,
      assemblyGroupId: group.id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      deliveryDate: order.deliveryDate,
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

/** 불량 누적 — 양면은 면별 합산(한 면에만 있어도 현황 게이지에 표시) */
export function resolveProductionDefectCount(order: ProductionOrderLine, counts: ProductionCounts) {
  if (order.splitPcbSides) {
    const top = resolveProductionSideCount(order, counts, 'TOP')
    const bot = resolveProductionSideCount(order, counts, 'BOT')
    return top + bot
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

/** 양품(기존 색) + 불량(빨강) stacked 게이지용 너비. 잔량·완료는 양품만 기준으로 유지 */
export function getStackedProgressWidths(good: number, defect: number, target: number) {
  if (target <= 0) {
    return { goodPercent: 0, defectPercent: 0, totalPercent: 0 }
  }
  const safeGood = Math.max(0, good)
  const safeDefect = Math.max(0, defect)
  let goodPercent = Math.round((safeGood / target) * 100)
  let defectPercent = Math.round((safeDefect / target) * 100)

  // 양품이 목표를 채운 뒤에도 불량 구간이 보이도록, 합이 100%를 넘으면 비율로 압축
  if (goodPercent + defectPercent > 100) {
    const scale = 100 / (goodPercent + defectPercent)
    goodPercent = Math.round(goodPercent * scale)
    defectPercent = Math.max(0, 100 - goodPercent)
  }

  if (safeDefect > 0 && defectPercent === 0) {
    defectPercent = 1
    goodPercent = Math.min(goodPercent, 99)
  }

  return {
    goodPercent,
    defectPercent,
    totalPercent: Math.min(100, goodPercent + defectPercent),
  }
}

export function normalizeProductionPcbSideMode(value: string | null | undefined) {
  return normalizeProductPcbSideMode(value)
}
