import {
  APP_SHORT_NAME,
  COMPANY_ADDRESS_DOMESTIC,
  COMPANY_ADDRESS_DOMESTIC_EN,
  COMPANY_ADDRESS_EXPORT,
  COMPANY_NAME_DOMESTIC_EN,
  COMPANY_NAME_EN,
  COMPANY_QUOTE_CONTACT_EXPORT,
} from '@/lib/app-config'
import { QUOTE_KRW_PER_USD } from './constants'
import { formatQuoteProcessTypeCodes } from './production-flags'
import {
  domesticPage1SummaryAmounts,
  exportPage1SummaryAmounts,
  formatExportSummaryUsd,
  formatQuoteKrw,
  formatQuoteValidityText,
  krwToUsd,
  withDomesticVat,
} from './format'
import { getPreviewLabels, type QuoteDocumentLanguage } from './preview-i18n'
import { buildQuotePreviewData } from './preview-rows'
import type { QuoteListItem } from './types'
import { escapeHtml } from '@/lib/print/escape-html'
import {
  processBillingPartName,
  splitAmountByProcess,
  type ProcessBillingCodes,
} from '@/lib/items/process-billing'
import { buildItemPriceBreakdownFromQuote } from './quote-to-item'
import {
  getActivePdfCurrency,
  pdfLabelType,
  pdfLang,
  pdfText,
  resolveQuoteContactEmail,
} from './export-quote-pdf-shared'

function buildQuoteSummaryMetaHtml(
  quote: QuoteListItem,
  estimate: ReturnType<typeof buildQuotePreviewData>['estimate'],
  previewTitle: string,
  language?: QuoteDocumentLanguage,
  contactEmail?: string,
) {
  const labelType = pdfLabelType(quote, language)
  const lang = pdfLang(quote, language)
  const labels = getPreviewLabels(labelType)
  const issueDate = quote.quoteDate || estimate.date
  const validityText = formatQuoteValidityText(issueDate)
  const qtyText = labels.formatQty(estimate.qty)
  const customer = quote.customer?.trim() || '-'
  const productName = quote.productName?.trim() || '-'
  const recipientLabel = pdfText(lang, '수신', 'Bill To', '收件方')
  const supplierLabel = pdfText(lang, '공급', 'From', '供应方')
  const customerLabel = pdfText(lang, '고객사', 'Customer', '客户')
  const productLabel = pdfText(lang, '제품명', 'Product', '产品名')
  const issueLabel = pdfText(lang, '발행일자', 'Issue Date', '发行日期')
  const validityLabel = pdfText(lang, '유효기간', 'Valid Until', '有效期')
  const qtyLabelText = pdfText(lang, '생산 수량', 'Quantity', '生产数量')
  const processLabelText = pdfText(lang, '공정', 'Type', '工序')
  const kindLabelText = pdfText(lang, '구분', 'Category', '类别')
  const contactLabel = pdfText(lang, '담당', 'Contact', '负责人')
  const addressLabel = pdfText(lang, '주소', 'Address', '地址')
  const emailLabel = 'E-mail'
  const productionKind = quote.detailInfo.settings?.productionKind === '샘플' ? '샘플' : '양산'
  const productionKindText =
    productionKind === '샘플' ? labels.productionKindSample : labels.productionKindMass
  const processTypeText = formatQuoteProcessTypeCodes(quote)

  // 국내용: 국문=미래SMT / 영·중문=MIRAE SMT · 해외용: MIRAE SMT AMERICA
  const isDomesticQuote = quote.quoteType === 'domestic'
  const useKoreanCompany = lang === 'ko'
  const companyName = isDomesticQuote
    ? useKoreanCompany
      ? APP_SHORT_NAME
      : COMPANY_NAME_DOMESTIC_EN
    : COMPANY_NAME_EN
  const email = resolveQuoteContactEmail(isDomesticQuote, contactEmail)
  const companyAddress = isDomesticQuote
    ? useKoreanCompany
      ? COMPANY_ADDRESS_DOMESTIC
      : COMPANY_ADDRESS_DOMESTIC_EN
    : COMPANY_ADDRESS_EXPORT
  const brandTagline = pdfText(lang, 'SMT 전자조립 · EMS', 'SMT Assembly · EMS', 'SMT电子组装 · EMS')
  const companyNameLabel = pdfText(lang, '업체명', 'Company', '公司名')
  const contactName = isDomesticQuote
    ? pdfText(lang, '영업관리팀', 'Sales Team', '营业管理团队')
    : COMPANY_QUOTE_CONTACT_EXPORT

  return `<div class="summary-hero">
    <div class="summary-brand">
      <p class="summary-brand-name">${escapeHtml(companyName)}</p>
      <p class="summary-brand-tagline">${brandTagline}</p>
    </div>
    <div class="summary-title-block">
      <h1 class="summary-doc-title">${previewTitle}</h1>
      <p class="summary-doc-no">${escapeHtml(estimate.estNo)}</p>
    </div>
  </div>
  <div class="summary-parties">
    <div class="summary-party-card">
      <p class="summary-party-label">${recipientLabel}</p>
      <dl class="summary-party-list">
        <div class="summary-party-row">
          <dt>${customerLabel}</dt>
          <dd>${escapeHtml(customer)}</dd>
        </div>
        <div class="summary-party-row">
          <dt>${productLabel}</dt>
          <dd>${escapeHtml(productName)}</dd>
        </div>
        <div class="summary-party-row">
          <dt>${processLabelText}</dt>
          <dd>${escapeHtml(processTypeText)}</dd>
        </div>
        <div class="summary-party-row">
          <dt>${kindLabelText}</dt>
          <dd>${escapeHtml(productionKindText)}</dd>
        </div>
        <div class="summary-party-row">
          <dt>${qtyLabelText}</dt>
          <dd>${escapeHtml(qtyText)}</dd>
        </div>
      </dl>
    </div>
    <div class="summary-party-card summary-party-card-supplier">
      <p class="summary-party-label">${supplierLabel}</p>
      <dl class="summary-party-list">
        <div class="summary-party-row">
          <dt>${companyNameLabel}</dt>
          <dd>${escapeHtml(companyName)}</dd>
        </div>
        <div class="summary-party-row summary-party-row-wrap">
          <dt>${addressLabel}</dt>
          <dd class="summary-party-value-wrap">${escapeHtml(companyAddress)}</dd>
        </div>
        <div class="summary-party-row summary-party-row-wrap">
          <dt>${emailLabel}</dt>
          <dd class="summary-party-value-wrap"><a class="summary-email" href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></dd>
        </div>
        <div class="summary-party-row">
          <dt>${contactLabel}</dt>
          <dd>${escapeHtml(contactName)}</dd>
        </div>
      </dl>
    </div>
  </div>
  <div class="summary-doc-meta">
    <span><b>${issueLabel}</b> ${escapeHtml(issueDate)}</span>
    <span><b>${validityLabel}</b> ${escapeHtml(validityText)}</span>
  </div>`
}

function buildQuoteSummaryTableHtml(
  quote: QuoteListItem,
  estimate: ReturnType<typeof buildQuotePreviewData>['estimate'],
  language?: QuoteDocumentLanguage,
  processBillingCodes?: ProcessBillingCodes | null,
) {
  const qty = estimate.qty || 1
  const includeVat = quote.quoteType === 'domestic' && quote.detailInfo.settings?.includeVat === true
  const page1Amounts = domesticPage1SummaryAmounts(
    estimate.values.grandTotal,
    qty,
    estimate.values.metalMask,
    includeVat,
  )
  const usdAmounts =
    getActivePdfCurrency() === 'usd'
      ? exportPage1SummaryAmounts(estimate.values.grandTotal, qty, estimate.values.metalMask)
      : null
  const unitPriceText = usdAmounts
    ? formatExportSummaryUsd(usdAmounts.unitUsd)
    : formatQuoteKrw(page1Amounts.unitKrw)
  const totalText = usdAmounts
    ? formatExportSummaryUsd(usdAmounts.totalUsd)
    : formatQuoteKrw(page1Amounts.totalKrw)
  const productTotalText = usdAmounts
    ? formatExportSummaryUsd(usdAmounts.productTotalUsd)
    : formatQuoteKrw(page1Amounts.productTotalKrw)
  const oneTimeText = usdAmounts
    ? formatExportSummaryUsd(usdAmounts.oneTimeUsd)
    : formatQuoteKrw(page1Amounts.oneTimeKrw)
  const labelType = pdfLabelType(quote, language)
  const lang = pdfLang(quote, language)
  const labels = getPreviewLabels(labelType)
  const qtyText = labels.formatQty(qty)
  const productName = quote.productName?.trim() || '-'
  const sectionTitle = pdfText(lang, '견적 금액', 'Quote Amount', '报价金额')
  const unitPriceLabel = includeVat
    ? pdfText(lang, '단가 (VAT 포함)', 'Unit Price (incl. VAT)', '单价 (含增值税)')
    : pdfText(lang, '단가', 'Unit Price', '单价')
  const qtyColLabel = pdfText(lang, '개수', 'Qty', '数量')
  const totalLabel = pdfText(lang, '총 합계', 'Total', '合计')
  const productColLabel = pdfText(lang, '제품명', 'Product', '产品名')
  const grandLabel = includeVat
    ? pdfText(lang, '최종 합계 금액 (VAT 포함)', 'Grand Total (incl. VAT)', '最终合计 (含增值税)')
    : pdfText(lang, '최종 합계 금액', 'Grand Total', '最终合计')
  const rateNote = usdAmounts
    ? ' ' +
      pdfText(
        lang,
        `금액은 USD 1 = ₩${QUOTE_KRW_PER_USD.toLocaleString('ko-KR')} 기준입니다.`,
        `Amounts are based on USD 1 = KRW ${QUOTE_KRW_PER_USD.toLocaleString('en-US')}.`,
        `金额按 USD 1 = KRW ${QUOTE_KRW_PER_USD.toLocaleString('en-US')} 计算。`,
      )
    : ''
  const baseNote = includeVat
    ? pdfText(
        lang,
        '※ 공정별 세부 산정내역은 다음 페이지를 참고해 주세요. 표의 단가·합계는 VAT 포함 금액이며, 세부 산정내역은 공급가액(VAT 별도) 기준입니다.',
        '※ See the following page for the detailed process breakdown. Unit prices and totals in this table include VAT; the detailed breakdown is excl. VAT.',
        '※ 各工序明细请参见后续页面。本表单价·合计为含增值税金额，明细按供应金额(不含税)计算。',
      )
    : pdfText(
        lang,
        '※ 공정별 세부 산정내역은 다음 페이지를 참고해 주세요.',
        '※ See the following page for the detailed process breakdown.',
        '※ 各工序明细请参见后续页面。',
      )
  const note = baseNote + rateNote

  const displayUnitText = unitPriceText
  const displayTotalText = productTotalText
  const mainRowsHtml = processBillingCodes
    ? (() => {
        const postSupplyKrw = buildItemPriceBreakdownFromQuote(quote).dipUnitPrice
        let rows: Record<'smd' | 'post', { unit: string; amount: string }>
        if (usdAmounts) {
          const roundUsd = (usd: number) => Math.round(usd * 100) / 100
          const postUnit = Math.min(usdAmounts.unitUsd, roundUsd(krwToUsd(postSupplyKrw)))
          const postAmount = Math.min(usdAmounts.productTotalUsd, roundUsd(postUnit * qty))
          rows = {
            smd: {
              unit: formatExportSummaryUsd(usdAmounts.unitUsd - postUnit),
              amount: formatExportSummaryUsd(usdAmounts.productTotalUsd - postAmount),
            },
            post: {
              unit: formatExportSummaryUsd(postUnit),
              amount: formatExportSummaryUsd(postAmount),
            },
          }
        } else {
          const split = splitAmountByProcess({
            qty,
            unitPrice: page1Amounts.unitKrw,
            amount: page1Amounts.productTotalKrw,
            postUnitPrice: includeVat ? withDomesticVat(postSupplyKrw) : postSupplyKrw,
          })
          rows = {
            smd: { unit: formatQuoteKrw(split.smd.unitPrice), amount: formatQuoteKrw(split.smd.amount) },
            post: { unit: formatQuoteKrw(split.post.unitPrice), amount: formatQuoteKrw(split.post.amount) },
          }
        }
        const partLanguage = lang === 'ko' ? 'ko' : 'en'
        return (['smd', 'post'] as const)
          .map((part) => {
            const code = part === 'smd' ? processBillingCodes.smdCode : processBillingCodes.postCode
            const name = processBillingPartName(productName, part, partLanguage)
            return `<tr class="summary-main-row">
          <td>${escapeHtml(`${name} [${code}]`)}</td>
          <td>${rows[part].unit}</td>
          <td>${escapeHtml(qtyText)}</td>
          <td class="summary-row-total">${rows[part].amount}</td>
        </tr>`
          })
          .join('')
      })()
    : `<tr class="summary-main-row">
          <td>${escapeHtml(productName)}</td>
          <td>${displayUnitText}</td>
          <td>${escapeHtml(qtyText)}</td>
          <td class="summary-row-total">${displayTotalText}</td>
        </tr>`
  const metalMaskRowHtml =
    page1Amounts.oneTimeKrw > 0
      ? `<tr>
          <td>${escapeHtml(pdfText(lang, '메탈마스크 (일회성)', 'SMT Stencil (one-time)', '钢网 (一次性)'))}</td>
          <td>-</td>
          <td>${escapeHtml(pdfText(lang, '1식', '1 lot', '1套'))}</td>
          <td class="summary-row-total">${oneTimeText}</td>
        </tr>`
      : ''
  const grandText = totalText

  return `<div class="summary-amount-section">
    <h2 class="summary-section-title">${sectionTitle}</h2>
    <table class="quote-table summary-table">
      <thead>
        <tr>
          <th>${productColLabel}</th>
          <th>${unitPriceLabel}</th>
          <th>${qtyColLabel}</th>
          <th>${totalLabel}</th>
        </tr>
      </thead>
      <tbody>
        ${mainRowsHtml}
        ${metalMaskRowHtml}
      </tbody>
    </table>
    <div class="summary-grand-total">
      <span class="summary-grand-label">${grandLabel}</span>
      <strong class="summary-grand-value">${grandText}</strong>
    </div>
    <p class="summary-note">${note}</p>
  </div>`
}

export function buildQuoteSummaryPage(
  quote: QuoteListItem,
  language?: QuoteDocumentLanguage,
  contactEmail?: string,
  processBillingCodes?: ProcessBillingCodes | null,
) {
  const { estimate, labelType } = buildQuotePreviewData(quote, { labelLanguage: language })
  const labels = getPreviewLabels(labelType)

  return `<section class="quote-page quote-page-summary">
    <div class="quote-card quote-card-summary">
      ${buildQuoteSummaryMetaHtml(quote, estimate, labels.title, language, contactEmail)}
      ${buildQuoteSummaryTableHtml(quote, estimate, language, processBillingCodes)}
    </div>
  </section>`
}
