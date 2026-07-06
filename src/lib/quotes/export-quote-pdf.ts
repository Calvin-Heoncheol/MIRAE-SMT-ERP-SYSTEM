import { APP_SHORT_NAME } from '@/lib/app-config'
import { formatQuoteMoneyTotal, formatQuoteValidityText } from './format'
import {
  buildQuotePreviewData,
  formatPreviewRowUnit,
  isPreviewHighlightRow,
  SECTION_TOTAL_ROW_BG,
  BOARD_SUBTOTAL_ROW_BG,
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
  const boardSubtotalBg = `background:${BOARD_SUBTOTAL_ROW_BG};`
  const indent = row.indent === 1 ? 'padding-left:24px;' : row.indent === 2 ? 'padding-left:40px;' : ''
  const labelStyle = row.emphasize
    ? 'font-weight:700;color:#0f172a;'
    : row.indent
      ? 'font-size:13px;color:#475569;'
      : 'color:#1e293b;'
  const amountStyle = row.amountEmphasize ? 'font-weight:700;color:#0f172a;' : 'font-size:13px;color:#475569;'
  const highlight = isPreviewHighlightRow(row)
  const cellBg = highlight ? sectionBg : row.boardSubtotal ? boardSubtotalBg : ''
  const rowClass = highlight ? 'section-total-row' : row.boardSubtotal ? 'board-subtotal-row' : ''
  const subLabel = row.subLabel
    ? `<br><span style="font-size:11px;color:#64748b;">${escapeHtml(row.subLabel)}</span>`
    : ''
  const unit = formatPreviewRowUnit(row, quoteType)
  const count = row.count != null ? escapeHtml(String(row.count)) : '-'
  const amount = row.amount != null ? formatQuoteMoneyTotal(row.amount, quoteType) : '-'

  return `<tr class="${rowClass}" style="border-top:${highlight ? '2px solid #64748b' : '1px solid #e2e8f0'};">
    <td style="padding:8px 12px;${indent}${labelStyle}${cellBg}${highlight ? 'border-left:4px solid #475569;' : ''}">${escapeHtml(row.label)}${subLabel}</td>
    <td style="padding:8px 12px;text-align:right;${cellBg}font-size:13px;color:#475569;">${unit}</td>
    <td style="padding:8px 12px;text-align:center;${cellBg}font-size:13px;color:#475569;">${count}</td>
    <td style="padding:8px 12px;text-align:right;${amountStyle}${cellBg}">${amount}</td>
  </tr>`
}

function splitPreviewRowsIntoGroups(rows: PreviewRow[]) {
  const groups: PreviewRow[][] = []
  let current: PreviewRow[] = []

  for (const row of rows) {
    if ((row.boardTotal || row.sectionTotal) && current.length > 0) {
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
  const tableHead = `<thead>
      <tr>
        <th>항목</th>
        <th>단가</th>
        <th>개수</th>
        <th>대당 합계</th>
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

function buildQuoteMetaHtml(
  quote: QuoteListItem,
  estimate: ReturnType<typeof buildQuotePreviewData>['estimate'],
  previewTitle: string,
  qtyLabel: string,
) {
  const issueDate = quote.quoteDate || estimate.date
  const validityText = formatQuoteValidityText(issueDate)
  const qtyText = `${estimate.qty.toLocaleString('ko-KR')}${qtyLabel}`

  return `<div class="quote-intro">
  <div class="quote-header">
    <h1>${previewTitle}</h1>
    <span class="quote-ref">${escapeHtml(estimate.estNo)}</span>
  </div>
  <div class="meta-grid">
    <p class="meta-item"><b>발행일자:</b> ${escapeHtml(issueDate)}</p>
    <p class="meta-item meta-align-right"><b>고객사:</b> ${escapeHtml(quote.customer || '-')}</p>
    <p class="meta-item"><b>유효기간:</b> ${escapeHtml(validityText)}</p>
    <p class="meta-item meta-align-right"><b>공급자:</b> ${APP_SHORT_NAME}</p>
    <p class="meta-item"><b>제품명:</b> ${escapeHtml(quote.productName || '-')}</p>
    <p class="meta-item meta-align-right"><b>담당자:</b> 영업관리팀</p>
    <p class="meta-item"><b>생산 수량:</b> ${escapeHtml(qtyText)}</p>
  </div>
  </div>`
}

function buildQuotePage(quote: QuoteListItem) {
  const { estimate, rows } = buildQuotePreviewData(quote)
  const isDomestic = quote.quoteType === 'domestic'
  const previewTitle = isDomestic ? '견 적 서' : 'QUOTATION'
  const qtyLabel = isDomestic ? 'EA' : ' EA'
  const qty = estimate.qty || 1
  const perUnitGrand = Math.floor(estimate.values.grandTotal / qty)

  return `<section class="quote-page">
    <div class="quote-card">
      ${buildQuoteMetaHtml(quote, estimate, previewTitle, qtyLabel)}
      ${buildDetailLineItemsTableHtml(rows, quote.quoteType)}
      <div class="summary quote-summary-block">
        <div class="summary-row">
          <span>대당 단가 (VAT 별도)</span>
          <strong>${formatQuoteMoneyTotal(perUnitGrand, quote.quoteType)}</strong>
        </div>
        <div class="summary-row total">
          <span>최종 합계 금액 (VAT 별도)</span>
          <strong>${formatQuoteMoneyTotal(estimate.values.grandTotal, quote.quoteType)}</strong>
        </div>
      </div>
    </div>
  </section>`
}

function buildQuotesPdfHtml(quotes: QuoteListItem[]) {
  const pages = quotes.map(buildQuotePage).join('')

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
    .quote-table tr.board-subtotal-row td {
      background-color: ${BOARD_SUBTOTAL_ROW_BG};
      font-weight: 600;
      color: #1e293b;
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
    @media print {
      body { background: #fff; padding: 0; }
      .no-print { display: none; }
      .quote-card {
        border: none;
        border-radius: 0;
        padding: 0;
        max-width: none;
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
      .quote-table tr.board-subtotal-row td {
        background-color: ${BOARD_SUBTOTAL_ROW_BG} !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
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
