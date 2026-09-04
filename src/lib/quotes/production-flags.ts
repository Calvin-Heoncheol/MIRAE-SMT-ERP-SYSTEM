import {
  findQuoteUnitPriceOptions,
  quoteMatchesProductName,
} from '@/lib/orders/quote-unit-price'
import { ITEM_PROCESS_TYPE_LABELS } from '@/lib/items/types'
import type { OrderLineItem, OrderListGroup } from '@/lib/orders/types'
import type { Product, ProductProcessType } from '@/lib/products/types'
import type { QuoteListItem } from '@/lib/quotes/types'

export type QuoteProductionFlags = {
  hasSmd: boolean
  hasPost: boolean
}

const EMPTY_FLAGS: QuoteProductionFlags = { hasSmd: false, hasPost: false }

function money(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0))
}

export function processTypeIncludesSmt(processType: ProductProcessType | null | undefined) {
  const value = processType || ''
  return value === 'smt' || value === 'smt_post'
}

export function processTypeIncludesPostProcess(processType: ProductProcessType | null | undefined) {
  const value = processType || ''
  return value === 'post' || value === 'smt_post'
}

/** 품목 마스터 공정구분 → 생산 대상 (견적 없이도 사용) */
export function flagsFromProductProcessType(product: Product | undefined): QuoteProductionFlags {
  if (!product) return EMPTY_FLAGS
  return {
    hasSmd: processTypeIncludesSmt(product.processType),
    hasPost: processTypeIncludesPostProcess(product.processType),
  }
}

/** 견적 금액 기준으로 SMT / 후공정 생산 대상 여부 */
export function getQuoteProductionFlags(
  quote: Pick<QuoteListItem, 'detailInfo'>,
): QuoteProductionFlags {
  const legacy = quote.detailInfo?.settings?.legacyCosts
  if (legacy) {
    return {
      hasSmd: money(legacy.smd) > 0,
      hasPost: money(legacy.post) > 0,
    }
  }

  const amounts = quote.detailInfo?.amounts
  if (!amounts) return EMPTY_FLAGS

  return {
    hasSmd: money(amounts.smt) > 0 || money(amounts.setupCost) > 0,
    hasPost:
      money(amounts.dip) > 0 ||
      money(amounts.assembly) > 0 ||
      money(amounts.download) > 0 ||
      money(amounts.test) > 0 ||
      money(amounts.packing) > 0 ||
      money(amounts.postProcessProfit) > 0,
  }
}

/** 견적 금액 기준 공정 라벨 — SMD / 후공정 / SMD+후공정 */
export function formatQuoteProcessLabel(quote: Pick<QuoteListItem, 'detailInfo'>): string {
  const { hasSmd, hasPost } = getQuoteProductionFlags(quote)
  if (hasSmd && hasPost) return ITEM_PROCESS_TYPE_LABELS.smt_post
  if (hasSmd) return ITEM_PROCESS_TYPE_LABELS.smt
  if (hasPost) return ITEM_PROCESS_TYPE_LABELS.post
  return '—'
}

function flagsFromQuoteId(quotes: QuoteListItem[], quoteId: string | null | undefined) {
  const id = String(quoteId || '').trim()
  if (!id) return null
  const quote = quotes.find((entry) => entry.quoteId === id || entry.quoteNumber === id)
  return quote ? getQuoteProductionFlags(quote) : null
}

/** 고객사+제품에 맞는 최신 견적의 생산 플래그 (레거시·보조) */
export function resolveProductionFlagsForProduct(
  quotes: QuoteListItem[],
  customer: string,
  product: Product,
): QuoteProductionFlags {
  const options = findQuoteUnitPriceOptions(quotes, customer, product)
  const latestId = options[0]?.quoteId
  if (!latestId) return EMPTY_FLAGS
  return flagsFromQuoteId(quotes, latestId) || EMPTY_FLAGS
}

function resolveQuoteFlagsForOrderLine(input: {
  quotes: QuoteListItem[]
  order: OrderListGroup
  item: OrderLineItem
  product: Product | undefined
  productById: Record<string, Product>
}): QuoteProductionFlags {
  const { quotes, order, item, product, productById } = input

  if (product) {
    const direct = resolveProductionFlagsForProduct(quotes, order.customer, product)
    if (direct.hasSmd || direct.hasPost) return direct
  }

  const parentLineId = String(item.derivedFromLineId || '').trim()
  if (parentLineId) {
    const parentItem = order.items.find((entry) => entry.lineId === parentLineId)
    if (parentItem) {
      const parentProduct =
        productById[String(parentItem.productId || '').trim()] ||
        productById[parentItem.productCode.trim()]
      if (parentProduct) {
        const parentFlags = resolveProductionFlagsForProduct(quotes, order.customer, parentProduct)
        if (parentFlags.hasSmd || parentFlags.hasPost) return parentFlags
      }
    }
  }

  const fromSource = flagsFromQuoteId(quotes, order.sourceQuoteId)
  if (fromSource) {
    const sourceQuote = quotes.find(
      (entry) => entry.quoteId === order.sourceQuoteId || entry.quoteNumber === order.sourceQuoteId,
    )
    if (!product || !sourceQuote || quoteMatchesProductName(sourceQuote, product)) {
      return fromSource
    }
  }

  return EMPTY_FLAGS
}

/**
 * 주문 라인 기준 생산 플래그.
 * 1) 품목 공정구분 → 2) 파생 라인 부모 품목 → 3) 견적(레거시 보조)
 */
export function resolveProductionFlagsForOrderLine(input: {
  quotes: QuoteListItem[]
  order: OrderListGroup
  item: OrderLineItem
  product: Product | undefined
  productById: Record<string, Product>
}): QuoteProductionFlags {
  const { order, item, product, productById } = input

  const fromProduct = flagsFromProductProcessType(product)
  if (fromProduct.hasSmd || fromProduct.hasPost) return fromProduct

  const parentLineId = String(item.derivedFromLineId || '').trim()
  if (parentLineId) {
    const parentItem = order.items.find((entry) => entry.lineId === parentLineId)
    if (parentItem) {
      const parentProduct =
        productById[String(parentItem.productId || '').trim()] ||
        productById[parentItem.productCode.trim()]
      const fromParent = flagsFromProductProcessType(parentProduct)
      if (fromParent.hasSmd || fromParent.hasPost) return fromParent
    }
  }

  return resolveQuoteFlagsForOrderLine(input)
}

function resolveQuoteFlagsForAssemblyParent(input: {
  quotes: QuoteListItem[]
  order?: OrderListGroup | null
  parentProduct: Product | undefined
  childProductIds?: string[]
  productById: Record<string, Product>
}): QuoteProductionFlags {
  const { quotes, order, parentProduct, childProductIds = [], productById } = input
  if (!order) return EMPTY_FLAGS

  if (parentProduct) {
    const parentFlags = resolveProductionFlagsForProduct(quotes, order.customer, parentProduct)
    if (parentFlags.hasSmd || parentFlags.hasPost) return parentFlags
  }

  let hasSmd = false
  let hasPost = false
  for (const childId of childProductIds) {
    const child = productById[childId]
    if (!child) continue
    const flags = resolveProductionFlagsForProduct(quotes, order.customer, child)
    hasSmd = hasSmd || flags.hasSmd
    hasPost = hasPost || flags.hasPost
  }

  if (hasSmd || hasPost) return { hasSmd, hasPost }

  const fromSource = flagsFromQuoteId(quotes, order.sourceQuoteId)
  return fromSource || EMPTY_FLAGS
}

/** 조립그룹 부모·자식 품목 공정구분 */
export function flagsFromAssemblyGroupProducts(input: {
  parentProduct: Product | undefined
  childProductIds: string[]
  productById: Record<string, Product>
}): QuoteProductionFlags {
  const { parentProduct, childProductIds, productById } = input

  if (childProductIds.length > 0) {
    let hasSmd = false
    let hasPost = false
    for (const childId of childProductIds) {
      const flags = flagsFromProductProcessType(productById[childId])
      hasSmd = hasSmd || flags.hasSmd
      hasPost = hasPost || flags.hasPost
    }
    if (hasSmd || hasPost) return { hasSmd, hasPost }
  }

  if (parentProduct?.productKind === 'assembly') {
    return EMPTY_FLAGS
  }

  return flagsFromProductProcessType(parentProduct)
}

/**
 * 조립그룹 기준 생산 플래그.
 * 1) 품목 공정구분 → 2) 견적(레거시 보조)
 */
export function resolveProductionFlagsForAssemblyParent(input: {
  quotes: QuoteListItem[]
  order?: OrderListGroup | null
  parentProduct: Product | undefined
  childProductIds?: string[]
  productById: Record<string, Product>
}): QuoteProductionFlags {
  const childProductIds = input.childProductIds ?? []
  const fromItems = flagsFromAssemblyGroupProducts({
    parentProduct: input.parentProduct,
    childProductIds,
    productById: input.productById,
  })
  if (fromItems.hasSmd || fromItems.hasPost) return fromItems

  return resolveQuoteFlagsForAssemblyParent(input)
}
