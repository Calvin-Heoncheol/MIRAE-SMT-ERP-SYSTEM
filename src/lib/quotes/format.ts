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

export function formatQuoteMoneyTotal(krw: number, _quoteType?: QuoteType) {
  return formatQuoteKrw(krw)
}

export function formatQuoteMoneyUnit(krw: number, _quoteType?: QuoteType) {
  return formatQuoteKrw(krw)
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

export function formatQuoteSetupMinutes(minutes: number) {
  const rounded = Math.round(minutes * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}분` : `${rounded.toFixed(1)}분`
}
