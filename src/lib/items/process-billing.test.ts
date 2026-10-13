import { describe, expect, it } from 'vitest'
import {
  processBillingPartName,
  resolveProcessBillingCodes,
  splitAmountByProcess,
} from './process-billing'

describe('splitAmountByProcess', () => {
  it('후공정 단가만큼 떼고 나머지는 SMD 로 — 합계는 원래 금액과 같다', () => {
    const split = splitAmountByProcess({ qty: 1000, unitPrice: 5200, postUnitPrice: 1200 })
    expect(split.smd).toEqual({ unitPrice: 4000, amount: 4_000_000 })
    expect(split.post).toEqual({ unitPrice: 1200, amount: 1_200_000 })
  })

  it('반올림된 공급가액이 주어지면 차액은 SMD 줄이 흡수한다', () => {
    const split = splitAmountByProcess({ qty: 3, unitPrice: 100, amount: 301, postUnitPrice: 40 })
    expect(split.post.amount).toBe(120)
    expect(split.smd.amount).toBe(181)
    expect(split.smd.amount + split.post.amount).toBe(301)
  })

  it('후공정 단가가 대당 단가보다 크면 대당 단가로 제한한다', () => {
    const split = splitAmountByProcess({ qty: 10, unitPrice: 500, postUnitPrice: 900 })
    expect(split.post).toEqual({ unitPrice: 500, amount: 5000 })
    expect(split.smd).toEqual({ unitPrice: 0, amount: 0 })
  })
})

describe('resolveProcessBillingCodes', () => {
  it('두 코드가 모두 있어야 분리 청구 대상', () => {
    expect(resolveProcessBillingCodes({ smdBillingCode: ' MINI-S ', postBillingCode: 'MINI-P' })).toEqual({
      smdCode: 'MINI-S',
      postCode: 'MINI-P',
    })
    expect(resolveProcessBillingCodes({ smdBillingCode: 'MINI-S', postBillingCode: '' })).toBeNull()
  })
})

describe('processBillingPartName', () => {
  it('공정 접미사를 붙인다', () => {
    expect(processBillingPartName('MINI', 'smd')).toBe('MINI (SMD)')
    expect(processBillingPartName('MINI', 'post')).toBe('MINI (후공정)')
    expect(processBillingPartName('MINI', 'post', 'en')).toBe('MINI (Post-Process)')
  })
})
