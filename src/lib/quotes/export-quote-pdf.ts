import { APP_SHORT_NAME, COMPANY_ADDRESS, COMPANY_NAME_EN, COMPANY_QUOTE_EMAIL } from '@/lib/app-config'
import { exportSummaryFromKrw, formatQuoteMoneyTotal, formatQuoteValidityText } from './format'
import { getPreviewLabels } from './preview-i18n'
import {
  buildQuotePreviewData,
  formatPreviewRowDescription,
  formatPreviewRowUnit,
  isPreviewHighlightRow,
  SECTION_TOTAL_ROW_BG,
  type PreviewRow,
} from './preview-rows'
import type { QuoteListItem, QuoteType } from './types'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildPreviewRowHtml(row: PreviewRow, quoteType: QuoteType) {
  const sectionBg = `background:${SECTION_TOTAL_ROW_BG};`
  const indent = row.indent === 1 ? 'padding-left:24px;' : row.indent === 2 ? 'padding-left:40px;' : ''
  const labelStyle = row.emphasize
    ? 'font-weight:700;color:#0f172a;'
    : row.indent
      ? 'font-size:13px;color:#475569;'
      : 'color:#1e293b;'
  const amountStyle = row.amountEmphasize ? 'font-weight:700;color:#0f172a;' : 'font-size:13px;color:#475569;'
  const highlight = isPreviewHighlightRow(row)
  const cellBg = highlight ? sectionBg : ''
  const rowClass = highlight ? 'section-total-row' : ''
  const description = formatPreviewRowDescription(row)
  const descriptionHtml = description
    ? `<br><span style="font-size:11px;color:#64748b;">${escapeHtml(description)}</span>`
    : ''
  const unit = formatPreviewRowUnit(row, quoteType)
  const count = row.count != null ? escapeHtml(String(row.count)) : '-'
  const amount = row.amount != null ? formatQuoteMoneyTotal(row.amount, quoteType) : '-'

  return `<tr class="${rowClass}" style="border-top:${highlight ? '2px solid #64748b' : '1px solid #e2e8f0'};">
    <td style="padding:8px 12px;${indent}${labelStyle}${cellBg}${highlight ? 'border-left:4px solid #475569;' : ''}">${escapeHtml(row.label)}${descriptionHtml}</td>
    <td style="padding:8px 12px;text-align:right;${cellBg}font-size:13px;color:#475569;">${unit}</td>
    <td style="padding:8px 12px;text-align:center;white-space:nowrap;${cellBg}font-size:13px;color:#475569;">${count}</td>
    <td style="padding:8px 12px;text-align:right;${amountStyle}${cellBg}">${amount}</td>
  </tr>`
}

function splitPreviewRowsIntoGroups(rows: PreviewRow[]) {
  const groups: PreviewRow[][] = []
  let current: PreviewRow[] = []

  for (const row of rows) {
    if (row.boardTotal && current.length > 0) {
      groups.push(current)
      current = [row]
    } else {
      current.push(row)
    }
  }

  if (current.length > 0) groups.push(current)
  return groups
}

function buildDetailLineItemsTableHtml(rows: PreviewRow[], quoteType: QuoteType) {
  const groups = splitPreviewRowsIntoGroups(rows)
  const labels = getPreviewLabels(quoteType)
  const tableHead = `<thead>
      <tr>
        <th>${labels.colItem}</th>
        <th>${labels.colUnit}</th>
        <th>${labels.colQty}</th>
        <th>${labels.colPerUnitTotal}</th>
      </tr>
    </thead>`

  return groups
    .map(
      (group) => `<div class="quote-row-group">
    <table class="quote-table line-items-table">
      ${tableHead}
      <tbody>${group.map((row) => buildPreviewRowHtml(row, quoteType)).join('')}</tbody>
    </table>
  </div>`,
    )
    .join('')
}

function buildQuoteSummaryMetaHtml(
  quote: QuoteListItem,
  estimate: ReturnType<typeof buildQuotePreviewData>['estimate'],
  previewTitle: string,
) {
  const isDomestic = quote.quoteType === 'domestic'
  const labels = getPreviewLabels(quote.quoteType)
  const issueDate = quote.quoteDate || estimate.date
  const validityText = formatQuoteValidityText(issueDate)
  const qtyText = labels.formatQty(estimate.qty)
  const customer = quote.customer?.trim() || '-'
  const productName = quote.productName?.trim() || '-'
  const recipientLabel = isDomestic ? '수신' : 'Bill To'
  const supplierLabel = isDomestic ? '공급' : 'From'
  const customerLabel = isDomestic ? '고객사' : 'Customer'
  const productLabel = isDomestic ? '제품명' : 'Product'
  const issueLabel = isDomestic ? '발행일자' : 'Issue Date'
  const validityLabel = isDomestic ? '유효기간' : 'Valid Until'
  const qtyLabelText = isDomestic ? '생산 수량' : 'Quantity'
  const contactLabel = isDomestic ? '담당' : 'Contact'
  const addressLabel = isDomestic ? '주소' : 'Address'
  const emailLabel = 'E-mail'

  const companyName = isDomestic ? APP_SHORT_NAME : COMPANY_NAME_EN

  return `<div class="summary-hero">
    <div class="summary-brand">
      <p class="summary-brand-name">${escapeHtml(companyName)}</p>
      <p class="summary-brand-tagline">${isDomestic ? 'SMT 전자조립 · EMS' : 'SMT Assembly · EMS'}</p>
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
          <dt>${qtyLabelText}</dt>
          <dd>${escapeHtml(qtyText)}</dd>
        </div>
      </dl>
    </div>
    <div class="summary-party-card summary-party-card-supplier">
      <p class="summary-party-label">${supplierLabel}</p>
      <dl class="summary-party-list">
        <div class="summary-party-row">
          <dt>${isDomestic ? '업체명' : 'Company'}</dt>
          <dd>${escapeHtml(companyName)}</dd>
        </div>
        <div class="summary-party-row summary-party-row-wide">
          <dt>${addressLabel}</dt>
          <dd>${escapeHtml(COMPANY_ADDRESS)}</dd>
        </div>
        <div class="summary-party-row">
          <dt>${emailLabel}</dt>
          <dd><a class="summary-email" href="mailto:${escapeHtml(COMPANY_QUOTE_EMAIL)}">${escapeHtml(COMPANY_QUOTE_EMAIL)}</a></dd>
        </div>
        <div class="summary-party-row">
          <dt>${contactLabel}</dt>
          <dd>${isDomestic ? '영업관리팀' : 'Sales Team'}</dd>
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
) {
  const qty = estimate.qty || 1
  const summary =
    quote.quoteType === 'export'
      ? exportSummaryFromKrw(estimate.values.grandTotal, qty)
      : null
  const perUnitGrand = summary ? summary.unitUsd : Math.floor(estimate.values.grandTotal / qty)
  const unitPriceText = summary
    ? summary.unitFormatted
    : formatQuoteMoneyTotal(perUnitGrand, quote.quoteType)
  const totalText = summary
    ? summary.totalFormatted
    : formatQuoteMoneyTotal(estimate.values.grandTotal, quote.quoteType)
  const labels = getPreviewLabels(quote.quoteType)
  const qtyText = labels.formatQty(qty)
  const productName = quote.productName?.trim() || '-'
  const isDomestic = quote.quoteType === 'domestic'
  const sectionTitle = isDomestic ? '견적 금액' : 'Quote Amount'
  const unitPriceLabel = isDomestic ? '단가 (VAT 별도)' : 'Unit Price (excl. VAT)'
  const qtyColLabel = isDomestic ? '개수' : 'Qty'
  const totalLabel = isDomestic ? '총 합계 (VAT 별도)' : 'Total (excl. VAT)'
  const productColLabel = isDomestic ? '제품명' : 'Product'
  const grandLabel = isDomestic ? '최종 합계 금액 (VAT 별도)' : 'Grand Total (excl. VAT)'
  const note = isDomestic ? '※ 세부내역은 다음 페이지를 참고해 주세요.' : '※ See the following page(s) for details.'

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
        <tr class="summary-main-row">
          <td>${escapeHtml(productName)}</td>
          <td>${unitPriceText}</td>
          <td>${escapeHtml(qtyText)}</td>
          <td class="summary-row-total">${totalText}</td>
        </tr>
      </tbody>
    </table>
    <div class="summary-grand-total">
      <span class="summary-grand-label">${grandLabel}</span>
      <strong class="summary-grand-value">${totalText}</strong>
    </div>
    <p class="summary-note">${note}</p>
  </div>`
}

function buildQuoteDetailHeaderHtml(
  quote: QuoteListItem,
  estimate: ReturnType<typeof buildQuotePreviewData>['estimate'],
) {
  const isDomestic = quote.quoteType === 'domestic'
  const title = isDomestic ? '견적 세부내역' : 'Quotation Details'

  return `<div class="detail-header">
    <h2>${title}</h2>
    <p class="detail-ref">${escapeHtml(estimate.estNo)} · ${escapeHtml(quote.productName?.trim() || '-')}</p>
  </div>`
}

function buildQuoteSummaryPage(quote: QuoteListItem) {
  const { estimate } = buildQuotePreviewData(quote)
  const labels = getPreviewLabels(quote.quoteType)

  return `<section class="quote-page quote-page-summary">
    <div class="quote-card quote-card-summary">
      ${buildQuoteSummaryMetaHtml(quote, estimate, labels.title)}
      ${buildQuoteSummaryTableHtml(quote, estimate)}
    </div>
  </section>`
}

function buildQuoteDetailPage(quote: QuoteListItem) {
  const { estimate, rows } = buildQuotePreviewData(quote)

  return `<section class="quote-page quote-page-detail">
    <div class="quote-card">
      ${buildQuoteDetailHeaderHtml(quote, estimate)}
      ${buildDetailLineItemsTableHtml(rows, quote.quoteType)}
    </div>
  </section>`
}

function buildQuotePages(quote: QuoteListItem) {
  return buildQuoteSummaryPage(quote) + buildQuoteDetailPage(quote)
}

function buildQuotesPdfHtml(quotes: QuoteListItem[]) {
  const pages = quotes.map(buildQuotePages).join('')

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>견적서 PDF</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      color: #0f172a;
      background: #f8fafc;
    }
    .no-print {
      margin-bottom: 16px;
      padding: 12px 16px;
      border: 1px solid #fdba74;
      border-radius: 10px;
      background: #fff7ed;
      font-size: 14px;
    }
    .no-print button {
      margin-left: 8px;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid #fdba74;
      background: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    .quote-page {
      page-break-after: always;
      margin-bottom: 24px;
    }
    .quote-page:last-child {
      page-break-after: auto;
      margin-bottom: 0;
    }
    .quote-card {
      max-width: 920px;
      margin: 0 auto;
      padding: 28px;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      background: #fff;
    }
    .quote-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    .quote-header h1 {
      margin: 0;
      font-size: 28px;
      letter-spacing: 0.2em;
    }
    .quote-ref {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      letter-spacing: 0.02em;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 28px;
      row-gap: 10px;
      margin-bottom: 16px;
      font-size: 14px;
      line-height: 1.7;
    }
    .meta-grid p {
      margin: 0;
    }
    .meta-align-right {
      text-align: right;
    }
    .quote-page-summary .quote-card {
      min-height: 0;
      padding: 0;
      border: none;
      border-radius: 0;
      overflow: hidden;
    }
    .quote-card-summary {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
    }
    .summary-hero {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 24px;
      padding: 32px 36px 28px;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: #fff;
    }
    .summary-brand-name {
      margin: 0 0 4px;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .summary-brand-tagline {
      margin: 0;
      font-size: 12px;
      color: #94a3b8;
      letter-spacing: 0.04em;
    }
    .summary-title-block {
      text-align: right;
    }
    .summary-doc-title {
      margin: 0 0 6px;
      font-size: 32px;
      font-weight: 300;
      letter-spacing: 0.35em;
      color: #fff;
    }
    .summary-doc-no {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #93c5fd;
      letter-spacing: 0.06em;
    }
    .summary-parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .summary-party-card {
      padding: 24px 36px;
      background: #fff;
      border-right: 1px solid #e2e8f0;
    }
    .summary-party-card-supplier {
      border-right: none;
      background: #f8fafc;
    }
    .summary-party-label {
      margin: 0 0 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2em;
      color: #64748b;
    }
    .summary-party-list {
      margin: 0;
    }
    .summary-party-row {
      display: grid;
      grid-template-columns: 72px 1fr;
      gap: 8px;
      margin-bottom: 10px;
      font-size: 14px;
      line-height: 1.5;
    }
    .summary-party-row:last-child {
      margin-bottom: 0;
    }
    .summary-party-row dt {
      margin: 0;
      color: #64748b;
      font-weight: 500;
    }
    .summary-party-row dd {
      margin: 0;
      color: #0f172a;
      font-weight: 600;
    }
    .summary-party-row-wide dd {
      line-height: 1.45;
    }
    .summary-email {
      color: #1d4ed8;
      text-decoration: none;
      font-weight: 600;
    }
    .summary-doc-meta {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 36px;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
      color: #475569;
    }
    .summary-doc-meta b {
      color: #334155;
      font-weight: 700;
    }
    .summary-amount-section {
      padding: 28px 36px 32px;
      background: #fff;
    }
    .summary-section-title {
      margin: 0 0 16px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #475569;
    }
    .summary-table {
      margin: 0;
      border: 1px solid #cbd5e1;
    }
    .summary-table thead {
      background: #1e293b;
    }
    .summary-table th {
      padding: 11px 16px;
      font-size: 12px;
      font-weight: 600;
      color: #e2e8f0;
      letter-spacing: 0.02em;
      border: none;
    }
    .summary-table th:nth-child(2),
    .summary-table th:nth-child(4) {
      text-align: right;
    }
    .summary-table th:nth-child(3) {
      text-align: center;
    }
    .summary-table td {
      padding: 18px 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 15px;
      color: #0f172a;
    }
    .summary-table td:nth-child(2),
    .summary-table td:nth-child(4) {
      text-align: right;
      font-weight: 600;
    }
    .summary-table td:nth-child(3) {
      text-align: center;
      font-weight: 600;
    }
    .summary-table td:first-child {
      font-weight: 700;
    }
    .summary-row-total {
      color: #1d4ed8 !important;
      font-weight: 800 !important;
    }
    .summary-grand-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-top: 20px;
      padding: 18px 24px;
      border: 2px solid #1d4ed8;
      border-radius: 6px;
      background: linear-gradient(to right, #eff6ff, #fff);
    }
    .summary-grand-label {
      font-size: 15px;
      font-weight: 700;
      color: #1e3a8a;
    }
    .summary-grand-value {
      font-size: 24px;
      font-weight: 800;
      color: #1d4ed8;
      letter-spacing: -0.02em;
    }
    .summary-note {
      margin: 16px 0 0;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
    }
    .detail-header {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .detail-header h2 {
      margin: 0 0 4px;
      font-size: 20px;
      letter-spacing: 0.05em;
      color: #0f172a;
    }
    .detail-ref {
      margin: 0;
      font-size: 13px;
      color: #64748b;
    }
    .quote-page-detail .quote-card {
      padding-top: 24px;
    }
    .quote-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e2e8f0;
      font-size: 14px;
    }
    .quote-table thead { background: #f8fafc; }
    .quote-table th {
      padding: 8px 12px;
      text-align: left;
      font-size: 13px;
      color: #475569;
    }
    .line-items-table th:nth-child(2),
    .line-items-table th:nth-child(4) { text-align: right; }
    .line-items-table th:nth-child(3) { text-align: center; }
    .line-items-table td:nth-child(3) {
      white-space: nowrap;
      text-align: center;
    }
    .line-items-table {
      margin-bottom: 8px;
    }
    .line-items-table:last-child {
      margin-bottom: 0;
    }
    .quote-row-group {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .quote-intro,
    .quote-summary-block {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .quote-table tr.section-total-row td {
      background-color: ${SECTION_TOTAL_ROW_BG};
      font-weight: 700;
      color: #0f172a;
      border-top: 2px solid #64748b;
    }
    .quote-table tr.section-total-row td:first-child {
      border-left: 4px solid #475569;
    }
    .summary {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 14px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    .summary-row.total {
      margin-top: 4px;
      font-size: 16px;
      color: #1d4ed8;
    }
    @page {
      size: A4;
      margin: 12mm 12mm 22mm 12mm;
      @bottom-center {
        content: counter(page) " / " counter(pages);
        font-size: 10px;
        color: #64748b;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      }
    }
    @media print {
      body { background: #fff; padding: 0; }
      .no-print { display: none; }
      .quote-card {
        border: none;
        border-radius: 0;
        padding: 0;
        max-width: none;
        box-shadow: none;
      }
      .quote-card-summary {
        border: none;
      }
      .summary-hero {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .summary-table thead {
        background: #1e293b !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .summary-table th {
        color: #e2e8f0 !important;
      }
      .summary-grand-total {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .quote-page { margin-bottom: 0; }
      .line-items-table .quote-row-group,
      .quote-row-group {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .quote-intro,
      .quote-summary-block {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .quote-table tr.section-total-row td {
        background-color: ${SECTION_TOTAL_ROW_BG} !important;
        border-top: 2px solid #64748b !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .quote-table tr.section-total-row td:first-child {
        border-left: 4px solid #475569 !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    인쇄 대화상자에서 「PDF로 저장」을 선택하세요.
    <button type="button" onclick="window.print()">PDF로 저장</button>
  </div>
  ${pages}
</body>
</html>`
}

export function exportQuotesToPdf(quotes: QuoteListItem[]) {
  if (!quotes.length || typeof document === 'undefined') return false

  const html = buildQuotesPdfHtml(quotes)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', '견적서 PDF')
  iframe.style.position = 'fixed'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'

  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  const printWindow = iframe.contentWindow
  if (!doc || !printWindow) {
    iframe.remove()
    window.alert('인쇄 창을 열지 못했습니다. 다시 시도해 주세요.')
    return false
  }

  doc.open()
  doc.write(html)
  doc.close()

  printWindow.focus()
  printWindow.print()

  window.setTimeout(() => {
    iframe.remove()
  }, 1500)

  return true
}
