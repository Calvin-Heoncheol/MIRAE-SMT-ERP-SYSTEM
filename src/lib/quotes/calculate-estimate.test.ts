import { describe, expect, it } from 'vitest'
import { calculateEstimate, computeSmtSetupBillingBreakdown } from './calculate-estimate'
import { getSmtSetupRate } from './constants'
import type { SmtPcbBoard } from './types'

function board(overrides: Partial<SmtPcbBoard> = {}): SmtPcbBoard {
  return {
    pcbName: 'PCB 1',
    chip: 300,
    icPin: 0,
    bga: 101,
    smtOdd: 10,
    smtSpecial: 0,
    smtSide: 'double',
    aoiEnabled: true,
    pcbWashEnabled: false,
    smtTopCount: 37,
    smtBotCount: 21,
    ...overrides,
  }
}

describe('calculateEstimate 원 단위 일치', () => {
  it('SET-UP 금액은 항목별 대당(원 반올림) 합 × 수량', () => {
    for (const qty of [7, 13, 150, 333, 1000]) {
      const result = calculateEstimate({
        boardQty: qty,
        quoteType: 'domestic',
        includeMetalMask: false,
        pcbBoards: [board()],
      })
      const detail = result.common.pcbBoardDetails[0]
      const breakdown = computeSmtSetupBillingBreakdown(detail.setupPartCount, detail.smtSide, 'domestic')
      const rate = getSmtSetupRate('domestic')
      const rowSum =
        Math.round((breakdown.baseMinutes * rate) / qty) +
        Math.round((breakdown.firstArticleMinutes * rate) / qty) +
        Math.round((breakdown.settingMinutes * rate) / qty)
      expect(result.common.smtSetup).toBe(rowSum * qty)
      expect(result.values.grandTotal).toBe(result.values.unitPrice * qty)
    }
  })

  it('SMD 항목 금액은 항목별 원 반올림 (BGA 2.5원)', () => {
    const result = calculateEstimate({
      boardQty: 10,
      quoteType: 'domestic',
      includeMetalMask: false,
      pcbBoards: [
        board({ chip: 200, smtOdd: 0, bga: 101 }),
        board({ pcbName: 'PCB 2', chip: 200, smtOdd: 0, bga: 101 }),
      ],
    })
    // CHIP 200×6=1200 + BGA 101×2.5=252.5→253 (보드별)
    expect(result.common.pcbBoardDetails.map((d) => d.laborUnit)).toEqual([1453, 1453])
    expect(result.common.smtLaborPerUnit).toBe(2906)
  })

  it('메탈마스크는 대당단가에서 제외되고 합계에 별도 포함', () => {
    const result = calculateEstimate({
      boardQty: 100,
      quoteType: 'domestic',
      metalMaskCost: 110000,
      pcbBoards: [board()],
    })
    expect(result.values.metalMask).toBe(110000)
    expect(result.values.grandTotal).toBe(result.values.unitPrice * 100 + 110000)
  })
})
