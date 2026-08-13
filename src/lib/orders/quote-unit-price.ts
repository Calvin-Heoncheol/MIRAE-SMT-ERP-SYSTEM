import type { QuoteListItem } from '@/lib/quotes/types'
import type { Product } from '@/lib/products/types'
import { formatProductOptionLabel } from '@/lib/products/utils'

export type QuoteUnitPriceOption = {
  quoteId: string
  quoteNumber: string
  quoteDate: string
  unitPrice: number
  boardQty: number
  totalAmount: number
  /** 주문 고객사와 견적 고객사가 다를 때 true */
  customerMismatch?: boolean
}

function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[()[\]（）【】]/g, ' ')
    .replace(/[㈜]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** (주)/주식회사 등 상호 접두·접미 제거 후 비교용 */
function normalizeCustomer(value: string) {
  return normalizeName(value)
    .replace(/^주식회사\s*/u, '')
    .replace(/\s*주식회사$/u, '')
    .replace(/^주\s+/u, '')
    .replace(/\s+주$/u, '')
    .replace(/^유\s+/u, '')
    .replace(/\s+유$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "보드 A (V1)" / "보드 A V1" → "보드 a" */
function stripVersionNoise(value: string) {
  return normalizeName(value)
    .replace(/\s*\([^)]*\)\s*$/u, '')
    .replace(/\s+v\d+\s*$/i, '')
    .replace(/\s+rev\s*\d+\s*$/i, '')
    .replace(/\s+[a-z]\d+\s*$/i, '')
    .trim()
}

export function unitPriceFromQuote(quote: Pick<QuoteListItem, 'boardQty' | 'totalAmount'>) {
  const qty = Math.max(1, Math.floor(Number(quote.boardQty) || 0) || 1)
  return Math.max(0, Math.round((Number(quote.totalAmount) || 0) / qty))
}

export function quoteMatchesCustomer(quoteCustomer: string, orderCustomer: string) {
  const a = normalizeCustomer(quoteCustomer)
  const b = normalizeCustomer(orderCustomer)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

/** 견적 제품명 ↔ 품목마스터 매칭 (고객사 무관) */
export function quoteMatchesProductName(
  quote: Pick<QuoteListItem, 'productName' | 'detailInfo'>,
  product: Product,
) {
  const linkedProductId = quote.detailInfo?.settings?.productId?.trim()
  if (linkedProductId && linkedProductId === product.id) return true

  const quoteName = normalizeName(quote.productName)
  if (!quoteName) return false

  const productName = normalizeName(product.productName)
  const productCode = normalizeName(product.productCode)
  const optionLabel = normalizeName(formatProductOptionLabel(product))
  const quoteBase = stripVersionNoise(quote.productName)
  const productBase = stripVersionNoise(product.productName)
  const optionBase = stripVersionNoise(formatProductOptionLabel(product))

  if (productName && (quoteName === productName || quoteName === optionLabel)) return true
  if (productCode && (quoteName === productCode || quoteBase === productCode)) return true
  if (quoteBase && productBase && quoteBase === productBase) return true
  if (quoteBase && optionBase && quoteBase === optionBase) return true
  if (quoteBase && productName && quoteBase === productName) return true

  // 견적 제품명에 품명·코드가 포함된 경우 (수기 입력 견적 호환)
  if (productName && productName.length >= 2 && quoteName.includes(productName)) return true
  if (productCode && productCode.length >= 2 && quoteName.includes(productCode)) return true
  if (productName && productName.length >= 2 && productName.includes(quoteBase || quoteName)) {
    return true
  }
  if (optionBase && optionBase.length >= 2 && quoteName.includes(optionBase)) return true

  // "코드 품명" / "코드 · 품명" 형태
  if (productCode && productName) {
    const combo = normalizeName(`${productCode} ${product.productName}`)
    const comboDot = normalizeName(`${productCode} · ${product.productName}`)
    if (quoteName === combo || quoteName === comboDot || quoteBase === combo) return true
    if (quoteName.includes(combo) || combo.includes(quoteBase || quoteName)) return true
  }

  if (product.version) {
    const version = normalizeName(product.version)
    if (
      productName &&
      version &&
      quoteName.includes(productName) &&
      quoteName.includes(version)
    ) {
      return true
    }
  }

  return false
}

export function quoteMatchesProduct(
  quote: Pick<QuoteListItem, 'customer' | 'productName' | 'detailInfo'>,
  customer: string,
  product: Product,
) {
  if (!quoteMatchesCustomer(quote.customer, customer)) return false
  return quoteMatchesProductName(quote, product)
}

function toOption(
  quote: QuoteListItem,
  customerMismatch = false,
): QuoteUnitPriceOption {
  return {
    quoteId: quote.quoteId,
    quoteNumber: quote.quoteNumber,
    quoteDate: quote.quoteDate,
    unitPrice: unitPriceFromQuote(quote),
    boardQty: Math.max(0, Math.floor(Number(quote.boardQty) || 0)),
    totalAmount: Math.max(0, Math.round(Number(quote.totalAmount) || 0)),
    customerMismatch,
  }
}

export function findQuoteUnitPriceOptions(
  quotes: QuoteListItem[],
  customer: string,
  product: Product,
): QuoteUnitPriceOption[] {
  if (!product.id) return []

  const byProduct = quotes.filter((quote) => quoteMatchesProductName(quote, product))
  if (!byProduct.length) return []

  const orderCustomer = customer.trim()
  if (!orderCustomer) {
    return byProduct.map((quote) => toOption(quote, true))
  }

  const byCustomer = byProduct.filter((quote) =>
    quoteMatchesCustomer(quote.customer, orderCustomer),
  )
  if (byCustomer.length) return byCustomer.map((quote) => toOption(quote, false))

  return byProduct.map((quote) => toOption(quote, true))
}
