import { APP_SHORT_NAME } from '@/lib/app-config'
import { formatQuoteMoneyTotal, formatQuoteMoneyUnit } from './format'
import { buildQuotePreviewData, formatPreviewRowUnit } from './preview-rows'
import type { QuoteListItem } from './types'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildQuotePdfPage(quote: QuoteListItem) {
  const { estimate, rows } = buildQuotePreviewData(quote)
  const isDomestic = quote.quoteType === 'domestic'
  const previewTitle = isDomestic ? '견 적 서' : 'QUOTATION'
  const typeBadge = isDomestic ? '국내용 견적서' : '해외용 견적서'
  const unitColLabel = isDomestic ? '개수당 단가' : '개수당 단가 (USD)'
  const totalColLabel = isDomestic ? '대당 합계' : '대당 합계 (USD)'
  const qtyLabel = isDomestic ? 'EA' : ' EA'
  const unitPrice = Math.floor(estimate.values.grandTotal / (estimate.qty || 1))

  const tableRows = rows
    .map((row) => {
      const indentStyle =
        row.indent === 1 ? 'padding-left:24px;font-size:12px;' : row.indent === 2 ? 'padding-left:40px;font-size:12px;' : ''
      const rowStyle = row.sectionTotal ? 'background:#f1f5f9;' : ''
      const labelStyle = row.emphasize ? 'font-weight:700;color:#0f172a;' : 'color:#475569;'
      const amountStyle = row.amountEmphasize
        ? 'font-weight:700;color:#0f172a;'
        : 'font-size:12px;color:#475569;'

      return `<tr style="border-top:1px solid #e2e8f0;${rowStyle}">
        <td style="padding:8px 12px;${indentStyle}${labelStyle}">${escapeHtml(row.label)}${row.subLabel ? `<br><span style="color:#64748b;">${escapeHtml(row.subLabel)}</span>` : ''}</td>
        <td style="padding:8px 12px;text-align:right;font-size:12px;color:#475569;">${escapeHtml(formatPreviewRowUnit(row, quote.quoteType))}</td>
        <td style="padding:8px 12px;text-align:center;font-size:12px;color:#475569;">${row.count != null ? escapeHtml(String(row.count)) : '-'}</td>
        <td style="padding:8px 12px;text-align:right;${amountStyle}">${row.amount != null ? formatQuoteMoneyTotal(row.amount, quote.quoteType) : '-'}</td>
      </tr>`
    })
    .join('')

  return `<section class="quote-page">
    <div class="quote-card">
      <div class="quote-header">
        <h1>${previewTitle}</h1>
        <span class="badge">${typeBadge}</span>
      </div>
      <div class="meta-grid">
        <div>
          <p><b>관리번호:</b> ${escapeHtml(estimate.estNo)}</p>
          <p><b>발행일자:</b> ${escapeHtml(estimate.date)}</p>
          <p><b>고객사:</b> ${escapeHtml(quote.customer || '-')}</p>
          <p><b>제품명:</b> ${escapeHtml(quote.productName || '-')}</p>
          <p><b>생산 수량:</b> ${estimate.qty.toLocaleString('ko-KR')}${qtyLabel}</p>
        </div>
        <div class="meta-right">
          <p><b>공급자:</b> ${APP_SHORT_NAME}</p>
          <p><b>담당자:</b> 영업관리팀</p>
        </div>
      </div>
      <table class="quote-table">
        <thead>
          <tr>
            <th>공정 세부 항목</th>
            <th>${unitColLabel}</th>
            <th>개수</th>
            <th>${totalColLabel}</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div class="summary">
        <div class="summary-row">
          <span>대당 단가 (VAT 별도)</span>
          <strong>${formatQuoteMoneyUnit(unitPrice, quote.quoteType)}</strong>
        </div>
        ${
          estimate.values.specialDiscount > 0
            ? `<div class="summary-row discount">
                <span>특별 할인 (VAT 별도)</span>
                <strong>-${formatQuoteMoneyTotal(estimate.values.specialDiscount, quote.quoteType)}</strong>
              </div>`
            : ''
        }
        <div class="summary-row total">
          <span>최종 합계 금액 (VAT 별도)</span>
          <strong>${formatQuoteMoneyTotal(estimate.values.grandTotal, quote.quoteType)}</strong>
        </div>
      </div>
    </div>
  </section>`
}

function buildQuotesPdfHtml(quotes: QuoteListItem[]) {
  const pages = quotes.map(buildQuotePdfPage).join('')

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
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      background: #f1f5f9;
      font-size: 12px;
      font-weight: 700;
      color: #475569;
      white-space: nowrap;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
      font-size: 14px;
      line-height: 1.7;
    }
    .meta-right { text-align: right; }
    .quote-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e2e8f0;
      font-size: 14px;
    }
    .quote-table thead {
      background: #f8fafc;
    }
    .quote-table th {
      padding: 8px 12px;
      text-align: left;
      font-size: 13px;
      color: #475569;
    }
    .quote-table th:nth-child(2),
    .quote-table th:nth-child(4) { text-align: right; }
    .quote-table th:nth-child(3) { text-align: center; }
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
    .summary-row.discount { color: #dc2626; }
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
