import { describe, expect, it } from 'vitest'
import { calculateEstimate, NEW_QUOTE_UNIT_PRICE_ROUND_UNIT } from './calculate-estimate'
import { domesticPage1SummaryAmounts } from './format'
import { createInitialState } from './quote-modal-state'
import { estimateSavedQuote } from './preview-rows'
import { testQuote, testSmtBoard } from './quote-test-fixtures'

describe('대당단가 10원 단위 반올림', () => {
  it('반올림 단위 10이면 대당단가 끝자리가 0이고 합계 = 대당 × 수량 + 메탈마스크', () => {
    for (const boardQty of [7, 13, 150, 333, 1000]) {
      const result = calculateEstimate({
        boardQty,
        quoteType: 'domestic',
        metalMaskCost: 220000,
        pcbBoards: [testSmtBoard()],
        unitPriceRoundUnit: 10,
      })
      const exact = calculateEstimate({
        boardQty,
        quoteType: 'domestic',
        metalMaskCost: 220000,
        pcbBoards: [testSmtBoard()],
      })
      expect(result.values.unitPrice % 10).toBe(0)
      expect(Math.abs(result.values.unitPrice - exact.values.unitPrice)).toBeLessThanOrEqual(5)
      expect(result.values.grandTotal).toBe(result.values.unitPrice * boardQty + result.values.metalMask)
    }
  })

  it('VAT 포함 대당단가도 소수점 없이 정수', () => {
    const result = calculateEstimate({
      boardQty: 333,
      quoteType: 'domestic',
      pcbBoards: [testSmtBoard()],
      unitPriceRoundUnit: 10,
    })
    const amounts = domesticPage1SummaryAmounts(result.values.grandTotal, 333, result.values.metalMask, true)
    expect(amounts.unitKrw).toBe((result.values.unitPrice * 11) / 10)
    expect(Number.isInteger(amounts.unitKrw)).toBe(true)
  })

  it('반올림 단위가 저장되지 않은 기존 견적은 1원 단위 그대로', () => {
    const legacy = estimateSavedQuote(testQuote({ boardQty: 333 }))
    const rounded = estimateSavedQuote(
      testQuote({ boardQty: 333 }, { settings: { unitPriceRoundUnit: 10 } }),
    )
    expect(rounded.values.unitPrice % 10).toBe(0)
    const exact = calculateEstimate({
      boardQty: 333,
      quoteType: 'domestic',
      pcbBoards: [testSmtBoard()],
    })
    expect(exact.values.unitPrice % 10).not.toBe(0)
    expect(legacy.values.grandTotal).toBe(legacy.values.unitPrice * 333 + legacy.values.metalMask)
    expect(rounded.values.unitPrice).not.toBe(legacy.values.unitPrice)
  })

  it('신규·복사는 10원 단위, 수정은 저장 당시 단위', () => {
    const saved = testQuote()
    expect(createInitialState('create').form.unitPriceRoundUnit).toBe(NEW_QUOTE_UNIT_PRICE_ROUND_UNIT)
    expect(createInitialState('create', null, saved).form.unitPriceRoundUnit).toBe(10)
    expect(createInitialState('edit', saved).form.unitPriceRoundUnit).toBe(1)
    const savedRounded = testQuote({}, { settings: { unitPriceRoundUnit: 10 } })
    expect(createInitialState('edit', savedRounded).form.unitPriceRoundUnit).toBe(10)
  })
})

