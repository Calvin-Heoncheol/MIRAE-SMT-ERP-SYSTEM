import { QUOTE_KRW_PER_USD } from './constants'
import type { QuoteDisplayCurrency, QuoteType } from './types'

const EXPORT_USD_FRACTION_DIGITS = 4
/** 해외용 1페이지 요약(Unit Price · Total) */
const EXPORT_USD_SUMMARY_FRACTION_DIGITS = 2

function roundExportSummaryUsd(usd: number) {
  const factor = 10 ** EXPORT_USD_SUMMARY_FRACTION_DIGITS
  return Math.round(usd * factor) / factor
}

/** 국내용 대당·합계 — 원 단위 반올림 */
export function roundDomesticKrw(krw: number) {
  return Math.round(Number(krw) || 0)
}

export function formatUsdAmount(usd: number, fractionDigits = EXPORT_USD_FRACTION_DIGITS) {
  return `$${usd.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`
}

/** 해외용 1페이지: 단가(2dp) × 수량 = 합계(2dp) 검산 일치 */
export function exportPage1SummaryAmounts(grandTotalKrw: number, qty: number) {
  const totalUsdPrecise = krwToUsd(grandTotalKrw)
  const safeQty = qty || 1
  const unitUsd = roundExportSummaryUsd(totalUsdPrecise / safeQty)
  const totalUsd = roundExportSummaryUsd(unitUsd * safeQty)
  return { unitUsd, totalUsd, totalUsdPrecise }
}

/** 해외용 1페이지 요약 금액 — 소수점 2자리 */
export function formatExportSummaryUsd(usd: number) {
  return formatUsdAmount(roundExportSummaryUsd(usd), EXPORT_USD_SUMMARY_FRACTION_DIGITS)
}

/** @deprecated Use formatExportSummaryUsd */
export function formatExportUnitPrice(usd: number) {
  return formatExportSummaryUsd(usd)
}

export function formatQuoteKrw(krw: number) {
  const value = roundDomesticKrw(krw)
  return `₩${value.toLocaleString('ko-KR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`
}

export function roundUsd(usd: number) {
  const factor = 10 ** EXPORT_USD_FRACTION_DIGITS
  return Math.round(usd * factor) / factor
}

export function krwToUsd(krw: number) {
  return roundUsd((Number(krw) || 0) / QUOTE_KRW_PER_USD)
}

export function formatQuoteUsd(krw: number) {
  return formatUsdAmount(krwToUsd(krw))
}

/** 해외용 요약: 대당·합계 소수점 2자리 */
export function exportSummaryFromKrw(grandTotalKrw: number, qty: number) {
  const { unitUsd, totalUsd } = exportPage1SummaryAmounts(grandTotalKrw, qty)

  return {
    totalUsd,
    unitUsd,
    totalFormatted: formatExportSummaryUsd(totalUsd),
    unitFormatted: formatExportSummaryUsd(unitUsd),
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

/** 국내용 대당·합계 요약 (원 단위 반올림) */
export function domesticPage1SummaryAmounts(grandTotalKrw: number, qty: number) {
  const safeQty = qty || 1
  const totalKrw = roundDomesticKrw(grandTotalKrw)
  const unitKrw = roundDomesticKrw(totalKrw / safeQty)
  return { unitKrw, totalKrw }
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

  if (quoteType === 'domestic') {
    const { unitKrw, totalKrw } = domesticPage1SummaryAmounts(grandTotalKrw, qty)
    return {
      unitFormatted: formatQuoteKrw(unitKrw),
      totalFormatted: formatQuoteKrw(totalKrw),
    }
  }

  const safeQty = qty || 1
  return {
    unitFormatted: formatQuoteKrw(grandTotalKrw / safeQty),
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
