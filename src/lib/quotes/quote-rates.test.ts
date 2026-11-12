import { afterEach, describe, expect, it } from 'vitest'
import { paymentTermSnapshotFromDbRow } from '@/lib/partners/payment-term-snapshot'
import { buildQuoteDetailInfo } from './build-quote-payload'
import { calculateEstimate } from './calculate-estimate'
import {
  DEFAULT_QUOTE_RATES,
  getPostRate,
  normalizeQuoteRates,
  setActiveQuoteRates,
  withQuoteRates,
  type QuoteRates,
} from './constants'
import { estimateSavedQuote } from './preview-rows'
import { diffQuoteRates, formValuesToQuoteRates, quoteRatesToFormValues } from './rate-fields'
import type { EstimateInput, QuoteListItem, SmtPcbBoard } from './types'

const board: SmtPcbBoard = {
  pcbName: 'PCB 1',
  chip: 300,
  icPin: 40,
  bga: 0,
  smtOdd: 10,
  smtSpecial: 0,
  smtSide: 'single',
  aoiEnabled: true,
  pcbWashEnabled: false,
  smtTopCount: 30,
  smtBotCount: 0,
}

const raisedRates: QuoteRates = normalizeQuoteRates({
  ...DEFAULT_QUOTE_RATES,
  domestic: {
    ...DEFAULT_QUOTE_RATES.domestic,
    postRate: 600,
    smt: { ...DEFAULT_QUOTE_RATES.domestic.smt, chip: 9 },
  },
})

const input: EstimateInput = {
  boardQty: 500,
  quoteType: 'domestic',
  includeMetalMask: true,
  pcbBoards: [board],
}

function savedQuote(rates?: QuoteRates): QuoteListItem {
  const estimate = calculateEstimate({ ...input, rates: rates ?? DEFAULT_QUOTE_RATES })
  const detailInfo = buildQuoteDetailInfo(
    {
      customer: 'A',
      productName: 'P',
      boardQty: '500',
      pcbBoardCount: '1',
      materialCost: '0',
      specialDiscount: '0',
      includeSmd: true,
      includeDip: true,
      includeMetalMask: true,
      assemblyLines: [{ name: '조립', seconds: '92' }],
      postProcessBufferPercent: '30',
      rates,
    },
    [board],
    [],
    estimate,
    'domestic',
  )
  if (!rates) delete detailInfo.settings?.rates
  return {
    quoteId: 'q1',
    quoteNumber: 'Q-1',
    quoteDate: '2026-10-01',
    quoteType: 'domestic',
    quoteStatus: 'draft',
    customer: 'A',
    productName: 'P',
    boardQty: 500,
    totalAmount: estimate.values.grandTotal,
    detailInfo,
    paymentTerms: paymentTermSnapshotFromDbRow(null),
    createdByName: '',
    updatedByName: '',
    createdAt: '2026-10-01T00:00:00Z',
  }
}

afterEach(() => setActiveQuoteRates(null))

describe('견적 단가표', () => {
  it('EstimateInput.rates 로 계산 단가가 바뀌고, 계산 후 적용 단가는 원래대로', () => {
    const base = calculateEstimate({ ...input, rates: DEFAULT_QUOTE_RATES })
    const raised = calculateEstimate({ ...input, rates: raisedRates })
    expect(raised.values.grandTotal).toBeGreaterThan(base.values.grandTotal)
    expect(getPostRate('domestic')).toBe(DEFAULT_QUOTE_RATES.domestic.postRate)
  })

  it('withQuoteRates 는 예외가 나도 이전 단가표로 복원', () => {
    expect(() =>
      withQuoteRates(raisedRates, () => {
        expect(getPostRate('domestic')).toBe(600)
        throw new Error('x')
      }),
    ).toThrow('x')
    expect(getPostRate('domestic')).toBe(DEFAULT_QUOTE_RATES.domestic.postRate)
  })

  it('저장 시 단가표 스냅샷을 함께 저장하고 후공정 금액도 그 단가로 산정', () => {
    const quote = savedQuote(raisedRates)
    expect(quote.detailInfo.settings?.rates?.domestic.postRate).toBe(600)
    expect(quote.detailInfo.amounts?.assembly).toBe(
      (quote.detailInfo.inputs?.postProcess?.postAssembly ?? 0) * 600 * 500,
    )
  })

  it('저장 견적은 현재 단가가 바뀌어도 저장 당시 단가로 재계산', () => {
    const quote = savedQuote(raisedRates)
    const before = estimateSavedQuote(quote).values.grandTotal
    setActiveQuoteRates(DEFAULT_QUOTE_RATES)
    expect(estimateSavedQuote(quote).values.grandTotal).toBe(before)
    const asDefault = estimateSavedQuote({
      ...quote,
      detailInfo: { ...quote.detailInfo, settings: { ...quote.detailInfo.settings, rates: DEFAULT_QUOTE_RATES } },
    })
    expect(before).toBeGreaterThan(asDefault.values.grandTotal)
  })

  it('단가표가 없는 기존 견적은 DEFAULT_QUOTE_RATES 로 고정', () => {
    const legacy = savedQuote()
    expect(legacy.detailInfo.settings?.rates).toBeUndefined()
    const before = estimateSavedQuote(legacy).values.grandTotal
    setActiveQuoteRates(raisedRates)
    expect(estimateSavedQuote(legacy).values.grandTotal).toBe(before)
  })

  it('관리 화면 폼 값 ↔ 단가표 변환 (% 항목 포함)', () => {
    const values = quoteRatesToFormValues(DEFAULT_QUOTE_RATES)
    expect(values['materialManagementRate']).toBe('10')
    expect(values['postBuffer.under1000']).toBe('30')
    const parsed = formValuesToQuoteRates({ ...values, 'domestic.postRate': '480' })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.rates.materialManagementRate).toBe(0.1)
    expect(diffQuoteRates(DEFAULT_QUOTE_RATES, parsed.rates)).toEqual([
      { key: 'domestic.postRate', label: '분당임률 (국내)', from: '460', to: '480' },
    ])
    expect(formValuesToQuoteRates({ ...values, aoi: '', 'export.aoi': '-1' }).ok).toBe(false)
  })
})
