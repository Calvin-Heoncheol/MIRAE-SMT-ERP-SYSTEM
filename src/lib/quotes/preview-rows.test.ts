import { describe, expect, it } from 'vitest'
import { buildQuotePreviewData, filterPdfBreakdownRows, type PdfBreakdownSection } from './preview-rows'
import { testQuote } from './quote-test-fixtures'

const SECTIONS: PdfBreakdownSection[] = ['setup', 'smt', 'dip', 'post', 'material']

function sectionTotals(quote = testQuote()) {
  const { estimate, pdfBreakdownRows } = buildQuotePreviewData(quote)
  const totals = Object.fromEntries(
    SECTIONS.map((section) => {
      const row = pdfBreakdownRows.find((r) => r.sectionTotal === section)
      return [section, row?.amount ?? 0]
    }),
  ) as Record<PdfBreakdownSection, number>
  return { estimate, pdfBreakdownRows, totals }
}

describe('PDF 세부 산정내역 행', () => {
  it('섹션 합계의 합은 메탈마스크를 뺀 최종 합계와 같다', () => {
    for (const boardQty of [7, 150, 333, 1000]) {
      const { estimate, totals } = sectionTotals(testQuote({ boardQty }))
      const sum = SECTIONS.reduce((acc, section) => acc + totals[section], 0)
      expect(sum).toBe(estimate.values.grandTotal - estimate.values.metalMask)
    }
  })

  it('SET-UP·SMD·납땜·후공정·자재 섹션이 모두 나온다', () => {
    const { totals } = sectionTotals()
    for (const section of SECTIONS) expect(totals[section]).toBeGreaterThan(0)
  })

  it('세부 행 합계는 섹션 합계와 같다 (대당 행은 대당 × 수량)', () => {
    const { pdfBreakdownRows, totals, estimate } = sectionTotals()
    const material = filterPdfBreakdownRows(pdfBreakdownRows, 'material', 'domestic')
    const detailSum = material
      .filter((row) => !row.sectionTotal)
      .reduce((acc, row) => acc + (row.amount ?? 0), 0)
    expect(detailSum).toBe(totals.material)
    expect(totals.material).toBe(
      1200 * estimate.qty + estimate.common.materialManagement,
    )
  })

  it('자재비 미포함이면 자재 섹션이 없다', () => {
    const { totals } = sectionTotals(testQuote({}, { settings: { includeMaterialCosts: false } }))
    expect(totals.material).toBe(0)
  })
})
