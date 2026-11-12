import { COMPANY_QUOTE_EMAIL_DOMESTIC, COMPANY_QUOTE_EMAIL_EXPORT } from '@/lib/app-config'
import { formatQuoteKrw, formatQuoteUsd } from './format'
import {
  resolveLabelQuoteType,
  resolvePdfLanguage,
  type QuoteDocumentLanguage,
  type QuoteLabelType,
} from './preview-i18n'
import type { QuoteDisplayCurrency, QuoteListItem } from './types'
import type { ProcessBillingCodes } from '@/lib/items/process-billing'

export type ExportQuotePdfOptions = {
  /** 국내용도 영문 문구로 PDF 출력 가능 */
  language?: QuoteDocumentLanguage
  /** 공급자 E-mail — 로그인 사용자 이메일 (없으면 회사 기본 메일) */
  contactEmail?: string
  /** 해외 견적 금액 표시 통화 (국내 견적은 항상 원화) */
  displayCurrency?: QuoteDisplayCurrency
  /** 품목 id → 공정별 분리 청구 코드. 연결 품목에 코드가 있으면 견적 금액을 SMD / 후공정 두 줄로 */
  processBillingCodesByItemId?: Map<string, ProcessBillingCodes>
}

export function resolveQuoteProcessBillingCodes(quote: QuoteListItem, options?: ExportQuotePdfOptions) {
  const productId = String(quote.detailInfo?.settings?.productId || '').trim()
  if (!productId) return null
  return options?.processBillingCodesByItemId?.get(productId) ?? null
}

/** 현재 렌더링 중인 견적의 표시 통화 — buildQuotePages 동안만 유효 */
let activePdfCurrency: QuoteDisplayCurrency = 'krw'

export function getActivePdfCurrency() {
  return activePdfCurrency
}

export function setActivePdfCurrency(currency: QuoteDisplayCurrency) {
  activePdfCurrency = currency
}

export function pdfMoney(krw: number) {
  return activePdfCurrency === 'usd' ? formatQuoteUsd(krw) : formatQuoteKrw(krw)
}
export function resolveQuoteContactEmail(
  useDomesticCompany: boolean,
  contactEmail?: string | null,
) {
  const email = String(contactEmail || '').trim()
  if (email) return email
  return useDomesticCompany ? COMPANY_QUOTE_EMAIL_DOMESTIC : COMPANY_QUOTE_EMAIL_EXPORT
}

export function pdfLabelType(quote: QuoteListItem, language?: QuoteDocumentLanguage): QuoteLabelType {
  return resolveLabelQuoteType(quote.quoteType, language)
}

export function pdfLang(quote: QuoteListItem, language?: QuoteDocumentLanguage): QuoteDocumentLanguage {
  return resolvePdfLanguage(quote.quoteType, language)
}

/** PDF 문구 — 한글 / 영문 / 중문 */
export function pdfText(lang: QuoteDocumentLanguage, ko: string, en: string, zh: string) {
  if (lang === 'zh') return zh
  if (lang === 'en') return en
  return ko
}

/** PDF「다른 이름으로 저장」기본 파일명용 — Windows 금지문자 제거 */
function sanitizePdfFilenamePart(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/** 견적서번호_품목 (복수 건이면 _외N건) */
export function buildQuotePdfDocumentTitle(quotes: QuoteListItem[]) {
  if (!quotes.length) return '견적서'
  const quote = quotes[0]
  const number = sanitizePdfFilenamePart(String(quote.quoteNumber || '').trim()) || '견적서'
  const product = sanitizePdfFilenamePart(String(quote.productName || '').trim()) || '품목'
  const base = `${number}_${product}`
  if (quotes.length === 1) return base
  return `${base}_외${quotes.length - 1}건`
}
