import { QUOTE_KRW_PER_USD } from './constants'
import type { QuoteType } from './types'

export function formatQuoteKrw(krw: number) {
  return `₩${Math.round(krw).toLocaleString('ko-KR')}`
}

export function formatQuoteUsd(krw: number, fractionDigits = 3) {
  const usd = (Number(krw) || 0) / QUOTE_KRW_PER_USD
  return `$${usd.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`
}

export function formatQuoteUsdUnit(krw: number) {
  return formatQuoteUsd(krw, 4)
}

export function formatQuoteUsdTotal(krw: number) {
  return formatQuoteUsd(krw, 3)
}

export function formatQuoteMoneyTotal(krw: number, quoteType: QuoteType) {
  return quoteType === 'domestic' ? formatQuoteKrw(krw) : formatQuoteUsdTotal(krw)
}

export function formatQuoteMoneyUnit(krw: number, quoteType: QuoteType) {
  return quoteType === 'domestic' ? formatQuoteKrw(krw) : formatQuoteUsdUnit(krw)
}

export function inferQuoteTypeFromNumber(quoteNumber: string): QuoteType {
  return quoteNumber.startsWith('MSK') ? 'domestic' : 'export'
}
