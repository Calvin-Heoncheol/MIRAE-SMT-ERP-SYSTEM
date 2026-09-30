import { describe, expect, it } from 'vitest'
import { normalizePartnerCurrency, normalizePartnerDocumentLanguage } from './utils'

describe('거래처 문서 설정 정규화', () => {
  it('통화는 USD 외에는 모두 KRW', () => {
    expect(normalizePartnerCurrency('usd')).toBe('USD')
    expect(normalizePartnerCurrency(' USD ')).toBe('USD')
    expect(normalizePartnerCurrency('EUR')).toBe('KRW')
    expect(normalizePartnerCurrency(null)).toBe('KRW')
  })

  it('언어는 en 외에는 모두 ko', () => {
    expect(normalizePartnerDocumentLanguage('EN')).toBe('en')
    expect(normalizePartnerDocumentLanguage('zh')).toBe('ko')
    expect(normalizePartnerDocumentLanguage(undefined)).toBe('ko')
  })
})
