import { describe, expect, it } from 'vitest'
import { buildQuotesPdfHtml } from './export-quote-pdf'
import {
  domesticPage1SummaryAmounts,
  exportPage1SummaryAmounts,
  formatExportSummaryUsd,
  formatQuoteKrw,
} from './format'
import { buildQuotePreviewData } from './preview-rows'
import { testQuote } from './quote-test-fixtures'

function summaryOf(html: string) {
  const start = html.indexOf('<div class="summary-amount-section">')
  const end = html.indexOf('<section class="quote-page quote-page-breakdown">')
  return html.slice(start, end)
}

describe('견적서 PDF 금액', () => {
  it('국내 VAT 별도: 1페이지 단가·합계는 공급가액', () => {
    const quote = testQuote()
    const { estimate } = buildQuotePreviewData(quote)
    const amounts = domesticPage1SummaryAmounts(
      estimate.values.grandTotal,
      estimate.qty,
      estimate.values.metalMask,
    )
    const summary = summaryOf(buildQuotesPdfHtml([quote]))

    expect(summary).toContain(formatQuoteKrw(amounts.unitKrw))
    expect(summary).toContain(formatQuoteKrw(amounts.productTotalKrw))
    expect(summary).toContain(formatQuoteKrw(amounts.oneTimeKrw))
    expect(summary).toContain(formatQuoteKrw(estimate.values.grandTotal))
    expect(summary).not.toContain('VAT 포함')
  })

  it('국내 VAT 포함: 단가·메탈마스크·최종 합계 모두 VAT 포함 금액', () => {
    const quote = testQuote({}, { settings: { includeVat: true } })
    const { estimate } = buildQuotePreviewData(quote)
    const amounts = domesticPage1SummaryAmounts(
      estimate.values.grandTotal,
      estimate.qty,
      estimate.values.metalMask,
      true,
    )
    const summary = summaryOf(buildQuotesPdfHtml([quote]))

    expect(amounts.totalKrw).toBe(amounts.unitKrw * estimate.qty + amounts.oneTimeKrw)
    expect(summary).toContain('단가 (VAT 포함)')
    expect(summary).toContain('최종 합계 금액 (VAT 포함)')
    expect(summary).toContain(formatQuoteKrw(amounts.unitKrw))
    expect(summary).toContain(formatQuoteKrw(amounts.oneTimeKrw))
    expect(summary).toContain(formatQuoteKrw(amounts.totalKrw))
    expect(summary).not.toContain(formatQuoteKrw(estimate.values.grandTotal))
  })

  it('해외 견적 USD 표시: 1페이지는 USD 금액', () => {
    const quote = testQuote({ quoteType: 'export' })
    const { estimate } = buildQuotePreviewData(quote)
    const usd = exportPage1SummaryAmounts(
      estimate.values.grandTotal,
      estimate.qty,
      estimate.values.metalMask,
    )
    const summary = summaryOf(buildQuotesPdfHtml([quote], { displayCurrency: 'usd' }))

    expect(summary).toContain(formatExportSummaryUsd(usd.unitUsd))
    expect(summary).toContain(formatExportSummaryUsd(usd.totalUsd))
  })

  it('세부 산정내역 페이지에 섹션 합계 금액이 나온다', () => {
    const quote = testQuote()
    const { pdfBreakdownRows } = buildQuotePreviewData(quote)
    const html = buildQuotesPdfHtml([quote])
    const breakdown = html.slice(html.indexOf('<section class="quote-page quote-page-breakdown">'))

    for (const row of pdfBreakdownRows.filter((r) => r.sectionTotal)) {
      expect(breakdown).toContain(formatQuoteKrw(row.amount ?? 0))
    }
  })

  it('여러 견적을 함께 출력해도 각 견적 금액은 단독 출력과 같다', () => {
    const base = testQuote()
    const html1 = buildQuotesPdfHtml([base])
    const html2 = buildQuotesPdfHtml([testQuote({ quoteId: 'q-2', quoteNumber: 'Q-TEST-002' }), base])
    expect(html2).toContain(summaryOf(html1).slice(0, 2000))
  })
})
