import { describe, expect, it } from 'vitest'
import {
  POST_RATE_ADMIN,
  POST_RATE_CORPORATE_PROFIT,
  POST_RATE_DIRECT_LABOR,
  POST_RATE_OVERHEAD,
  getPostRate,
} from './constants'
import { domesticVatBreakdown } from './format'

describe('후공정 분당 임률', () => {
  it('4개 항목 합이 국내·수출 임률과 같다', () => {
    const sum = POST_RATE_DIRECT_LABOR + POST_RATE_OVERHEAD + POST_RATE_CORPORATE_PROFIT + POST_RATE_ADMIN
    expect(getPostRate('domestic')).toBe(sum)
    expect(getPostRate('export')).toBe(sum)
  })
})

describe('domesticVatBreakdown', () => {
  it('공급가액 + 부가세 10% = 합계', () => {
    const { supply, vat, totalIncl } = domesticVatBreakdown(1_000_000)
    expect(supply).toBe(1_000_000)
    expect(vat).toBe(100_000)
    expect(totalIncl).toBe(1_100_000)
  })

  it('합계는 항상 공급가액 + 부가세', () => {
    for (const amount of [0, 1, 999, 12_345, 7_777_777]) {
      const { supply, vat, totalIncl } = domesticVatBreakdown(amount)
      expect(totalIncl).toBe(supply + vat)
    }
  })
})
