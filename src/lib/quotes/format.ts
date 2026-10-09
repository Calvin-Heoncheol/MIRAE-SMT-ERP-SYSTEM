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

/** 합계 중 대당단가에 넣지 않는 일회성 금액(메탈마스크) — 0 ~ 합계 범위 */
function clampOneTimeKrw(grandTotalKrw: number, oneTimeKrw: number) {
  const total = Math.max(0, Number(grandTotalKrw) || 0)
  return Math.min(total, Math.max(0, Math.round(Number(oneTimeKrw) || 0)))
}

/** 해외용 1페이지: 단가(2dp) × 수량 (+ 일회성) = 합계(2dp) 검산 일치 */
export function exportPage1SummaryAmounts(grandTotalKrw: number, qty: number, oneTimeKrw = 0) {
  const oneTime = clampOneTimeKrw(grandTotalKrw, oneTimeKrw)
  const totalUsdPrecise = krwToUsd(grandTotalKrw)
  const safeQty = qty || 1
  const unitUsd = roundExportSummaryUsd(krwToUsd((Number(grandTotalKrw) || 0) - oneTime) / safeQty)
  const productTotalUsd = roundExportSummaryUsd(unitUsd * safeQty)
  const oneTimeUsd = roundExportSummaryUsd(krwToUsd(oneTime))
  const totalUsd = roundExportSummaryUsd(productTotalUsd + oneTimeUsd)
  return { unitUsd, productTotalUsd, oneTimeUsd, totalUsd, totalUsdPrecise }
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

/** 공정 단가(CHIP·BGA 등) — 소수 있으면 유지 (예: ₩2.5). 합계용 formatQuoteKrw 와 구분 */
export function formatQuoteKrwRate(krw: number) {
  const value = Number(krw) || 0
  const isWhole = Math.abs(value - Math.round(value)) < 1e-9
  return `₩${value.toLocaleString('ko-KR', {
    minimumFractionDigits: isWhole ? 0 : 1,
    maximumFractionDigits: 2,
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
export function exportSummaryFromKrw(grandTotalKrw: number, qty: number, oneTimeKrw = 0) {
  const { unitUsd, productTotalUsd, oneTimeUsd, totalUsd } = exportPage1SummaryAmounts(
    grandTotalKrw,
    qty,
    oneTimeKrw,
  )

  return {
    totalUsd,
    unitUsd,
    totalFormatted: formatExportSummaryUsd(totalUsd),
    unitFormatted: formatExportSummaryUsd(unitUsd),
    productTotalFormatted: formatExportSummaryUsd(productTotalUsd),
    oneTimeFormatted: oneTimeUsd > 0 ? formatExportSummaryUsd(oneTimeUsd) : null,
  }
}

export function resolveQuoteDisplayCurrency(
  quoteType: QuoteType,
  displayCurrency: QuoteDisplayCurrency = 'krw',
): QuoteDisplayCurrency {
  return quoteType === 'domestic' ? 'krw' : displayCurrency
}

export function formatQuoteMoneyByDisplay(
  krw: number,
  quoteType: QuoteType,
  displayCurrency: QuoteDisplayCurrency = 'krw',
) {
  return resolveQuoteDisplayCurrency(quoteType, displayCurrency) === 'usd'
    ? formatQuoteUsd(krw)
    : formatQuoteKrw(krw)
}

/** 공정 단가 표시 — 국내 소수 단가(BGA 2.5 등) 유지 */
export function formatQuoteMoneyRateByDisplay(
  krw: number,
  quoteType: QuoteType,
  displayCurrency: QuoteDisplayCurrency = 'krw',
) {
  return resolveQuoteDisplayCurrency(quoteType, displayCurrency) === 'usd'
    ? formatQuoteUsd(krw)
    : formatQuoteKrwRate(krw)
}

/** 견적서·목록 금액 — 국내/해외 모두 원화 표기 (해외 USD 전환은 화면 토글 전용) */
export function formatQuoteMoneyTotal(krw: number, _quoteType?: QuoteType) {
  return formatQuoteKrw(krw)
}

export function formatQuoteMoneyUnit(krw: number, _quoteType?: QuoteType) {
  return formatQuoteKrw(krw)
}

/**
 * 국내용 대당·합계 요약 — 대당(원) 반올림 후 합계 = 대당 × 수량 + 일회성(메탈마스크).
 * 메탈마스크는 대당단가에 포함하지 않는다.
 */
export function domesticPage1SummaryAmounts(grandTotalKrw: number, qty: number, oneTimeKrw = 0) {
  const safeQty = qty || 1
  const oneTime = clampOneTimeKrw(grandTotalKrw, oneTimeKrw)
  const unitKrw = roundDomesticKrw(((Number(grandTotalKrw) || 0) - oneTime) / safeQty)
  const productTotalKrw = unitKrw * safeQty
  const totalKrw = productTotalKrw + oneTime
  return { unitKrw, productTotalKrw, oneTimeKrw: oneTime, totalKrw }
}

/** 국내 부가세율 10% */
export const DOMESTIC_VAT_RATE = 0.1

/** 공급가액 기준 부가세·VAT 포함 합계 */
export function domesticVatBreakdown(supplyKrw: number) {
  const supply = roundDomesticKrw(supplyKrw)
  const vat = roundDomesticKrw(supply * DOMESTIC_VAT_RATE)
  return { supply, vat, totalIncl: supply + vat }
}

export type QuotePreviewSummary = {
  unitFormatted: string
  totalFormatted: string
  /** 대당단가 × 수량 */
  productTotalFormatted: string
  /** 메탈마스크(일회성) — 없으면 null */
  oneTimeFormatted: string | null
  vatFormatted?: string
  totalInclFormatted?: string
}

export function formatQuotePreviewSummary(
  grandTotalKrw: number,
  qty: number,
  quoteType: QuoteType,
  displayCurrency: QuoteDisplayCurrency = 'krw',
  oneTimeKrw = 0,
): QuotePreviewSummary {
  if (quoteType === 'export' && resolveQuoteDisplayCurrency(quoteType, displayCurrency) === 'usd') {
    return exportSummaryFromKrw(grandTotalKrw, qty, oneTimeKrw)
  }

  const { unitKrw, productTotalKrw, oneTimeKrw: oneTime, totalKrw } = domesticPage1SummaryAmounts(
    grandTotalKrw,
    qty,
    oneTimeKrw,
  )
  const base = {
    unitFormatted: formatQuoteKrw(unitKrw),
    totalFormatted: formatQuoteKrw(totalKrw),
    productTotalFormatted: formatQuoteKrw(productTotalKrw),
    oneTimeFormatted: oneTime > 0 ? formatQuoteKrw(oneTime) : null,
  }

  if (quoteType === 'domestic') {
    const { vat, totalIncl } = domesticVatBreakdown(totalKrw)
    return {
      ...base,
      vatFormatted: formatQuoteKrw(vat),
      totalInclFormatted: formatQuoteKrw(totalIncl),
    }
  }

  return base
}

/** 저장된 견적의 메탈마스크(일회성) 금액 */
export function quoteMetalMaskAmount(detailInfo?: {
  amounts?: { subMaterialCost?: number }
  settings?: { metalMaskCost?: number; includeMetalMask?: boolean }
} | null) {
  if (detailInfo?.settings?.includeMetalMask === false) return 0
  const value = detailInfo?.amounts?.subMaterialCost ?? detailInfo?.settings?.metalMaskCost ?? 0
  return Math.max(0, Math.round(Number(value) || 0))
}

/** 저장된 견적의 대당단가(원) — 메탈마스크 제외 */
export function quoteUnitPriceKrw(quote: {
  totalAmount: number
  boardQty: number
  detailInfo?: Parameters<typeof quoteMetalMaskAmount>[0]
}) {
  const qty = Math.max(1, Math.floor(Number(quote.boardQty) || 0) || 1)
  return domesticPage1SummaryAmounts(
    Number(quote.totalAmount) || 0,
    qty,
    quoteMetalMaskAmount(quote.detailInfo),
  ).unitKrw
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
