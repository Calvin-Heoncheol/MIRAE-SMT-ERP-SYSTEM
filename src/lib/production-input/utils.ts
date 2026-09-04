import type { Product, ProductPcbSideMode } from '@/lib/products/types'
import {
  formatProductPcbSideModeLabel,
  isSplitProductPcbSideMode,
  normalizeProductPcbSideMode,
} from '@/lib/products/utils'
import { buildSmtCountKey } from '@/lib/smt/count-keys'
import type { SmtPcbSide } from '@/lib/smt/types'
import type { OrderListGroup } from '@/lib/orders/types'
import { isBillingOnlyOrderItem } from '@/lib/orders/utils'
import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import { parseItemVersionCode, stripTrailingVersionFromName } from '@/lib/items/version-code'
import {
  processTypeIncludesPostProcess,
  processTypeIncludesSmt,
  resolveProductionFlagsForAssemblyParent,
  resolveProductionFlagsForOrderLine,
} from '@/lib/quotes/production-flags'
import type { QuoteListItem } from '@/lib/quotes/types'
import type {
  ProductionCounts,
  ProductionInputConfig,
  ProductionOrderLine,
  ProductionOrderState,
} from './types'

export const PRODUCTION_ORDER_PAGE_SIZE = 5

/** @deprecated production-flags.processTypeIncludesSmt 사용 */
export { processTypeIncludesSmt } from '@/lib/quotes/production-flags'

/** @deprecated production-flags.processTypeIncludesPostProcess 사용 */
export { processTypeIncludesPostProcess } from '@/lib/quotes/production-flags'

/**
 * 후공정 후보 여부 — 품목 공정구분 우선, 견적은 레거시 보조.
 */
export function assemblyGroupIncludesPostProcess(
  group: OrderAssemblyGroup,
  productById: Record<string, Product>,
  quotes?: QuoteListItem[],
  order?: OrderListGroup,
): boolean {
  const flags = resolveProductionFlagsForAssemblyParent({
    quotes: quotes ?? [],
    order,
    parentProduct:
      productById[group.parentProductId] ||
      productById[String(group.parentProductCode || '').trim()],
    childProductIds: group.lines.map((line) => line.childProductId),
    productById,
  })
  return flags.hasPost
}

/** SMT(SMD) 공정이 필요한 조립 그룹인지 — 품목 공정구분 우선 */
export function assemblyGroupIncludesSmt(
  group: OrderAssemblyGroup,
  productById: Record<string, Product>,
  quotes?: QuoteListItem[],
  order?: OrderListGroup,
): boolean {
  const flags = resolveProductionFlagsForAssemblyParent({
    quotes: quotes ?? [],
    order,
    parentProduct:
      productById[group.parentProductId] ||
      productById[String(group.parentProductCode || '').trim()],
    childProductIds: group.lines.map((line) => line.childProductId),
    productById,
  })
  return flags.hasSmd
}

/** 출하 대상: SMD·후공정 중 하나라도 있는 조립 그룹 (품목 공정구분 기준) */
export function assemblyGroupIsDeliveryEligible(
  group: OrderAssemblyGroup,
  productById: Record<string, Product>,
  quotes?: QuoteListItem[],
  order?: OrderListGroup,
): boolean {
  return (
    assemblyGroupIncludesSmt(group, productById, quotes, order) ||
    assemblyGroupIncludesPostProcess(group, productById, quotes, order)
  )
}

/**
 * 출하·재고용 생산완료 상한.
 * - SMD+후공정 모두 필요 → 조립/반제품 무관하게 min(SMT, 후공정)
 * - 조립제품: SMD만 → SMT / 후공정만 → 후공정
 * - 반제품(단일 공정): SMT만 또는 후공정만 해당 실적
 */
export function resolveAssemblyProductionCap(input: {
  group: OrderAssemblyGroup
  smtSets: number
  postProduced: number
  productById: Record<string, Product>
  quotes?: QuoteListItem[]
  order?: OrderListGroup
}) {
  const parent =
    input.productById[input.group.parentProductId] ||
    input.productById[String(input.group.parentProductCode || '').trim()]
  // 품목을 못 찾으면 반제품으로 단정하지 않음 (후공정 병목이 무시되는 것을 방지)
  const isSemiFinished = Boolean(parent) && parent.productKind !== 'assembly'

  const needsSmt = assemblyGroupIncludesSmt(
    input.group,
    input.productById,
    input.quotes,
    input.order,
  )
  const needsPost = assemblyGroupIncludesPostProcess(
    input.group,
    input.productById,
    input.quotes,
    input.order,
  )
  const smtSets = Math.max(0, Math.floor(input.smtSets))
  const postProduced = Math.max(0, Math.floor(input.postProduced))

  // SMD·후공정이 모두 필요하면 병목(min) — 반제품이어도 동일
  if (needsSmt && needsPost) return Math.min(smtSets, postProduced)

  if (isSemiFinished) {
    if (needsSmt) return smtSets
    if (needsPost) return postProduced
    if (smtSets > 0) return smtSets
    if (postProduced > 0) return postProduced
    return 0
  }

  if (needsSmt) return smtSets
  if (needsPost) return postProduced
  // 공정구분이 비어 있어도 생산실적이 있으면 출하 가능
  if (smtSets > 0 && postProduced > 0) return Math.min(smtSets, postProduced)
  if (smtSets > 0) return smtSets
  if (postProduced > 0) return postProduced
  return 0
}

function resolveProductPcbSideMode(
  productId: string | null | undefined,
  productById: Record<string, Product>,
): ProductPcbSideMode {
  const id = productId?.trim() || ''
  if (!id) return 'single'
  return productById[id]?.pcbSideMode ?? 'single'
}

/** 주문 라인 스냅샷보다 품목 마스터(현재 등록)를 우선 */
function resolveMasterProduct(
  productId: string | null | undefined,
  productCode: string | null | undefined,
  productById: Record<string, Product>,
): Product | undefined {
  const id = String(productId || '').trim()
  if (id && productById[id]) return productById[id]
  const code = String(productCode || '').trim()
  if (code && productById[code]) return productById[code]
  const needle = (id || code).trim()
  if (!needle) return undefined
  const upper = needle.toUpperCase()
  const matches = Object.values(productById).filter((product) => {
    const pc = String(product.productCode || '').trim()
    return product.id === needle || pc === needle || pc.toUpperCase() === upper
  })
  return matches[0]
}

function resolveLineProductFields(
  item: { productId?: string | null; productCode: string; productName: string },
  productById: Record<string, Product>,
) {
  const snapshotCode = item.productCode.trim()
  const snapshotName = item.productName.trim()
  const linkedId = String(item.productId || '').trim()
  const product = resolveMasterProduct(linkedId, snapshotCode, productById)
  return {
    product,
    // 임시 품목: product_id 없으면 코드(TEMP)를 생산 키로 쓰지 않음
    productId: (product?.id || linkedId).trim(),
    productCode: (product?.productCode || snapshotCode).trim(),
    productName: (product?.productName || snapshotName).trim(),
  }
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
  quotes: QuoteListItem[] = [],
): ProductionOrderLine[] {
  const lines: ProductionOrderLine[] = []

  for (const order of orders) {
    order.items.forEach((item, index) => {
      const orderLineId = item.lineId?.trim() || ''
      if (!orderLineId) return
      // 임시 품목(금액 전용)은 SMT·생산실적 라인에서 제외
      if (isBillingOnlyOrderItem(item)) return

      const resolved = resolveLineProductFields(item, productById)
      const { product, productCode, productName } = resolved
      if (!productName && !productCode) return

      const productId = resolved.productId
      if (!productId) return
      const isDerivedLine = Boolean(item.derivedFromLineId)

      if (
        productionModule === 'smt' &&
        product?.productKind === 'assembly' &&
        !isDerivedLine
      ) {
        return
      }

      if (productionModule === 'smt') {
        const flags = resolveProductionFlagsForOrderLine({
          quotes,
          order,
          item,
          product,
          productById,
        })
        if (!flags.hasSmd) return
      }

      const pcbSideMode = resolveProductPcbSideMode(productId, productById)
      const splitPcbSides = productionModule === 'smt' && isSplitProductPcbSideMode(pcbSideMode)

      const labelParts: string[] = []
      if (productName) labelParts.push(productName)
      if (productCode) labelParts.push(`[${productCode}]`)
      if (productionModule === 'smt') {
        labelParts.push(formatProductPcbSideModeLabel(pcbSideMode))
      }
      labelParts.push(`수량${item.quantity}`)
      labelParts.push(`단가${Math.round(item.unitPrice)}`)

      const productLabel = labelParts.join(' · ')
      const uiKey = `${order.orderNumber}\u001e${index}\u001e${orderLineId}`
      const countKey = orderLineId

      const productVersion =
        product?.version?.trim() ||
        parseItemVersionCode(productId).version ||
        parseItemVersionCode(productCode).version ||
        null

      lines.push({
        uiKey,
        countKey,
        orderLineId,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        customerPoNumber: order.customerPoNumber || '',
        workNumber: String(item.workNumber || '').trim(),
        orderDate: order.orderDate,
        deliveryDate: item.deliveryDate || order.deliveryDate,
        customer: order.customer,
        productId,
        productCode,
        productVersion,
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
  quotes: QuoteListItem[] = [],
): ProductionOrderLine[] {
  return buildAssemblyGroupProductionLines(assemblyGroups, orders, productById, 'post', quotes)
}

/** 출하용 — 조립그룹 부모 품목에 대응하는 발주서 라인 단가 (추가작업 행 제외) */
export function resolveAssemblyGroupOrderUnitPrice(
  order: OrderListGroup,
  parentProductId: string,
  productCode: string,
) {
  const parentId = String(parentProductId || '').trim()
  const code = String(productCode || '').trim()
  const items = (order.items || []).filter(
    (item) => !item.derivedFromLineId && !isBillingOnlyOrderItem(item),
  )

  const match =
    items.find(
      (item) =>
        (parentId && item.productId === parentId) ||
        (code && (item.productCode === code || item.productId === code)),
    ) || null

  return Math.max(0, Math.round(Number(match?.unitPrice) || 0))
}

function resolveAssemblyGroupWorkNumber(
  order: OrderListGroup,
  parentProductId: string,
  productCode: string,
) {
  const parentId = String(parentProductId || '').trim()
  const code = String(productCode || '').trim()
  const items = (order.items || []).filter(
    (item) => !item.derivedFromLineId && !isBillingOnlyOrderItem(item),
  )

  const match =
    items.find(
      (item) =>
        (parentId && item.productId === parentId) ||
        (code && (item.productCode === code || item.productId === code)),
    ) || null

  return String(match?.workNumber || '').trim()
}

/** 출하 입력용 — SMD·DIP 중 하나라도 있는 조립 그룹 */
export function buildDeliveryAssemblyLines(
  assemblyGroups: OrderAssemblyGroup[],
  orders: OrderListGroup[],
  productById: Record<string, Product> = {},
  quotes: QuoteListItem[] = [],
): ProductionOrderLine[] {
  return buildAssemblyGroupProductionLines(assemblyGroups, orders, productById, 'delivery', quotes)
}

function buildAssemblyGroupProductionLines(
  assemblyGroups: OrderAssemblyGroup[],
  orders: OrderListGroup[],
  productById: Record<string, Product>,
  mode: 'post' | 'delivery',
  quotes: QuoteListItem[] = [],
): ProductionOrderLine[] {
  const orderById = Object.fromEntries(orders.map((order) => [order.orderId, order]))
  const lines: ProductionOrderLine[] = []

  for (const group of assemblyGroups) {
    const order = orderById[group.orderId]
    if (!order) continue
    if (mode === 'post' && !assemblyGroupIncludesPostProcess(group, productById, quotes, order)) {
      continue
    }

    const parentProduct = resolveMasterProduct(
      group.parentProductId,
      group.parentProductCode,
      productById,
    )
    // parent 가 마스터에 없으면 TEMP 등으로 잘못 생긴 그룹
    if (!parentProduct) continue
    const productName = (
      parentProduct?.productName || group.parentProductName
    ).trim()
    const productCode = (parentProduct?.productCode || group.parentProductCode).trim()
    if (!productName && !productCode) continue

    const isFinished = parentProduct?.productKind === 'assembly'
    const productKindLabel = isFinished ? '조립제품' : '반제품'

    const labelParts: string[] = []
    if (productName) labelParts.push(productName)
    if (productCode) labelParts.push(`[${productCode}]`)
    labelParts.push(`수량${group.targetQuantity}`)

    const productVersion =
      parentProduct?.version?.trim() ||
      parseItemVersionCode(group.parentProductId).version ||
      parseItemVersionCode(productCode).version ||
      null

    const unitPrice =
      resolveAssemblyGroupOrderUnitPrice(order, group.parentProductId, productCode) ||
      Math.max(0, Math.round(Number(parentProduct?.defaultUnitPrice) || 0))
    const workNumber = resolveAssemblyGroupWorkNumber(order, group.parentProductId, productCode)

    lines.push({
      uiKey: `${order.orderNumber}\u001easm\u001e${group.id}`,
      countKey: group.id,
      orderLineId: group.id,
      orderId: order.orderId,
      assemblyGroupId: group.id,
      orderNumber: order.orderNumber,
      customerPoNumber: order.customerPoNumber || '',
      workNumber,
      orderDate: order.orderDate,
      deliveryDate: order.deliveryDate,
      customer: order.customer,
      productId: parentProduct.id || group.parentProductId,
      productCode,
      productVersion,
      productName,
      productLabel: labelParts.join(' · '),
      quantity: group.targetQuantity,
      unitPrice,
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

/** 버전 라벨 — 마스터/스냅샷 기준 */
export function resolveProductionProductVersion(order: ProductionOrderLine): string | null {
  if (order.productVersion?.trim()) return order.productVersion.trim()
  return parseItemVersionCode(order.productCode.trim() || order.productLabel.trim()).version
}

/**
 * 카드 표시용 — 구 데이터(이름에 버전 포함)는 이름에서 버전을 떼고 오른쪽에만 표시
 */
export function formatProductionProductDisplay(order: ProductionOrderLine): {
  name: string
  version: string | null
} {
  const version = resolveProductionProductVersion(order)
  const rawName = formatProductionProductName(order)
  if (!version || rawName === '—') return { name: rawName, version }
  return {
    name: stripTrailingVersionFromName(rawName, version),
    version,
  }
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
    const version = resolveProductionProductVersion(order)
    const haystack = [
      order.orderNumber,
      order.customerPoNumber,
      order.workNumber,
      order.customer,
      order.productName,
      order.productCode,
      order.productLabel,
      version || '',
      formatProductPcbSideModeLabel(order.pcbSideMode),
      order.splitPcbSides ? 'top bot' : '',
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
