import { describe, expect, it } from 'vitest'
import {
  POST_RATE_ADMIN,
  POST_RATE_CORPORATE_PROFIT,
  POST_RATE_DIRECT_LABOR,
  POST_RATE_EXPORT_SURCHARGE,
  POST_RATE_OVERHEAD,
  getDipUnitRates,
  getPostRate,
  getSmtUnitRates,
} from './constants'
import { domesticVatBreakdown } from './format'

describe('후공정 분당 임률', () => {
  it('4개 항목 합이 국내 임률, + 해외 대응비가 해외 임률과 같다', () => {
    const sum = POST_RATE_DIRECT_LABOR + POST_RATE_OVERHEAD + POST_RATE_CORPORATE_PROFIT + POST_RATE_ADMIN
    expect(getPostRate('domestic')).toBe(sum)
    expect(getPostRate('export')).toBe(sum + POST_RATE_EXPORT_SURCHARGE)
    expect(getPostRate('export')).toBe(800)
  })
})

describe('해외 실장 단가', () => {
  it('지정 단가', () => {
    expect(getSmtUnitRates('export')).toEqual({ chip: 10, odd: 35, special: 175, icPin: 3.5, bgaBall: 4 })
  })
})

describe('수납땜 단가', () => {
  it('해외 소형 350 · 중형 400 · 대형 500, 국내는 기존 유지', () => {
    expect(getDipUnitRates('export')).toEqual({ dipGeneral: 350, dipConnector: 400, dipWire: 500, dipXLarge: 600 })
    expect(getDipUnitRates('domestic')).toEqual({ dipGeneral: 250, dipConnector: 300, dipWire: 400, dipXLarge: 600 })
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
