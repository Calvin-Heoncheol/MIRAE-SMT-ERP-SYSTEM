import { QUOTE_KRW_PER_USD } from './constants'
import type { QuoteDisplayCurrency, QuoteType } from './types'

const EXPORT_USD_FRACTION_DIGITS = 4

export function formatQuoteKrw(krw: number) {
  return `₩${Math.round(krw).toLocaleString('ko-KR')}`
}

export function roundUsd(usd: number) {
  const factor = 10 ** EXPORT_USD_FRACTION_DIGITS
  return Math.round(usd * factor) / factor
}

export function krwToUsd(krw: number) {
  return roundUsd((Number(krw) || 0) / QUOTE_KRW_PER_USD)
}

export function formatUsdAmount(usd: number) {
  return `$${usd.toLocaleString('en-US', {
    minimumFractionDigits: EXPORT_USD_FRACTION_DIGITS,
    maximumFractionDigits: EXPORT_USD_FRACTION_DIGITS,
  })}`
}

export function formatQuoteUsd(krw: number) {
  return formatUsdAmount(krwToUsd(krw))
}

/** 해외용 1페이지 요약: 합계(USD) 기준으로 단가를 역산해 검산 오차를 최소화 */
export function exportSummaryFromKrw(grandTotalKrw: number, qty: number) {
  const totalUsd = krwToUsd(grandTotalKrw)
  const safeQty = qty || 1
  const unitUsd = roundUsd(totalUsd / safeQty)

  return {
    totalUsd,
    unitUsd,
    totalFormatted: formatUsdAmount(totalUsd),
    unitFormatted: formatUsdAmount(unitUsd),
  }
}

export function resolveQuoteDisplayCurrency(
  quoteType: QuoteType,
  displayCurrency: QuoteDisplayCurrency = 'usd',
): QuoteDisplayCurrency {
  return quoteType === 'domestic' ? 'krw' : displayCurrency
}

export function formatQuoteMoneyByDisplay(
  krw: number,
  quoteType: QuoteType,
  displayCurrency: QuoteDisplayCurrency = 'usd',
) {
  return resolveQuoteDisplayCurrency(quoteType, displayCurrency) === 'usd'
    ? formatQuoteUsd(krw)
    : formatQuoteKrw(krw)
}

export function formatQuoteMoneyTotal(krw: number, quoteType?: QuoteType) {
  return quoteType === 'export' ? formatQuoteUsd(krw) : formatQuoteKrw(krw)
}

export function formatQuoteMoneyUnit(krw: number, quoteType?: QuoteType) {
  return quoteType === 'export' ? formatQuoteUsd(krw) : formatQuoteKrw(krw)
}

export function formatQuotePreviewSummary(
  grandTotalKrw: number,
  qty: number,
  quoteType: QuoteType,
  displayCurrency: QuoteDisplayCurrency = 'usd',
) {
  if (quoteType === 'export' && resolveQuoteDisplayCurrency(quoteType, displayCurrency) === 'usd') {
    return exportSummaryFromKrw(grandTotalKrw, qty)
  }

  const safeQty = qty || 1
  return {
    unitFormatted: formatQuoteKrw(Math.floor(grandTotalKrw / safeQty)),
    totalFormatted: formatQuoteKrw(grandTotalKrw),
  }
}

export function inferQuoteTypeFromNumber(quoteNumber: string): QuoteType {
  return quoteNumber.startsWith('MSK') ? 'domestic' : 'export'
}

export const QUOTE_VALIDITY_DAYS = 14

export function formatQuoteValidUntil(issueDate: string, validDays = QUOTE_VALIDITY_DAYS) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(issueDate.trim())
  if (!match) return '-'

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const base = new Date(Date.UTC(year, month - 1, day))
  base.setUTCDate(base.getUTCDate() + validDays)

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base)
}

export function formatQuoteValidityText(issueDate: string, validDays = QUOTE_VALIDITY_DAYS) {
  return formatQuoteValidUntil(issueDate, validDays)
}

export function formatQuoteSetupMinutes(minutes: number, quoteType?: QuoteType) {
  const rounded = Math.round(minutes * 10) / 10
  const value = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return quoteType === 'export' ? `${value} min` : `${value}분`
}
