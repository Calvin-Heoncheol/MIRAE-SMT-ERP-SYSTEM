import type { MonthlyClosingRow } from '@/lib/reports/monthly-closing'
import { summarizeMonthlyClosingRows } from '@/lib/reports/monthly-closing'

export type ExportMonthlyClosingPdfInput = {
  rows: MonthlyClosingRow[]
  customer?: string
  startDate?: string
  endDate?: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function sanitizePdfFilenamePart(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function formatCount(value: number) {
  return value.toLocaleString('ko-KR')
}

function formatPeriodLabel(startDate?: string, endDate?: string) {
  const start = String(startDate || '').trim()
  const end = String(endDate || '').trim()
  if (start && end) {
    if (start === end) return start
    return `${start} ~ ${end}`
  }
  if (start) return `${start} ~`
  if (end) return `~ ${end}`
  return '전체'
}

function buildMonthlyClosingHeading(customer?: string) {
  const name = String(customer || '').trim()
  return name ? `${name} 월 마감` : '월 마감'
}

function buildMonthlyClosingPdfTitle(input: ExportMonthlyClosingPdfInput) {
  const heading = sanitizePdfFilenamePart(buildMonthlyClosingHeading(input.customer))
  const period = sanitizePdfFilenamePart(formatPeriodLabel(input.startDate, input.endDate))
  if (heading && period) return `${heading}_${period}`
  return heading || period || '월마감'
}

function buildMonthlyClosingPdfHtml(input: ExportMonthlyClosingPdfInput) {
  const heading = buildMonthlyClosingHeading(input.customer)
  const periodLabel = formatPeriodLabel(input.startDate, input.endDate)
  const totals = summarizeMonthlyClosingRows(input.rows)

  const bodyRows = input.rows
    .map((row) => {
      return `<tr>
        <td class="col-date">${escapeHtml(row.recordDate || '—')}</td>
        <td class="col-name">${escapeHtml(row.productName || '—')}</td>
        <td class="col-qty">${formatCount(row.quantity)}</td>
        <td class="col-price">${formatCount(row.unitPrice)}</td>
        <td class="col-amount">${formatCount(row.amount)}</td>
      </tr>`
    })
    .join('')

  const totalRow = `<tr class="total-row">
    <td colspan="2">합계</td>
    <td class="col-qty">${formatCount(totals.quantity)}</td>
    <td class="col-price"></td>
    <td class="col-amount">${formatCount(totals.amount)}</td>
  </tr>`

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title></title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
      font-size: 11px;
      line-height: 1.45;
    }
    .no-print {
      margin-bottom: 12px;
      padding: 10px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f8fafc;
      font-size: 12px;
    }
    .no-print button {
      margin-top: 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    h1 {
      margin: 0 0 4px;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .meta {
      margin: 0 0 16px;
      color: #475569;
      font-size: 11px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    thead {
      display: table-header-group;
    }
    thead th {
      border-top: 2px solid #0f172a;
      border-bottom: 1px solid #0f172a;
      padding: 8px 6px;
      font-size: 11px;
      font-weight: 700;
      text-align: left;
      background: #f8fafc;
    }
    tbody td {
      border-bottom: 1px solid #e2e8f0;
      padding: 7px 6px;
      vertical-align: top;
      word-break: break-word;
    }
    tr.total-row td {
      border-top: 2px solid #0f172a;
      border-bottom: none;
      padding: 8px 6px;
      font-weight: 700;
      background: #f8fafc;
    }
    tr.total-row {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .col-date { width: 14%; }
    .col-name { width: 36%; }
    .col-qty, .col-price, .col-amount { width: 16%; text-align: right; }
    thead .col-qty, thead .col-price, thead .col-amount { text-align: right; }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    PDF로 저장하려면 아래 버튼을 누르거나 Ctrl+P를 사용하세요.
    <button type="button" onclick="window.print()">인쇄 / PDF 저장</button>
  </div>
  <h1>${escapeHtml(heading)}</h1>
  <p class="meta">기간 ${escapeHtml(periodLabel)}</p>
  <table>
    <thead>
      <tr>
        <th class="col-date">일자</th>
        <th class="col-name">품목명</th>
        <th class="col-qty">수량</th>
        <th class="col-price">단가</th>
        <th class="col-amount">합계</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
      ${totalRow}
    </tbody>
  </table>
</body>
</html>`
}

export function exportMonthlyClosingPdf(input: ExportMonthlyClosingPdfInput) {
  if (!input.rows.length || typeof document === 'undefined') return false

  const pdfTitle = buildMonthlyClosingPdfTitle(input)
  const html = buildMonthlyClosingPdfHtml(input)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', pdfTitle)
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

  try {
    doc.title = ''
  } catch {
    /* ignore */
  }

  const previousTitle = document.title
  document.title = pdfTitle

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    document.title = previousTitle
    window.removeEventListener('afterprint', cleanup)
    try {
      printWindow.removeEventListener('afterprint', cleanup)
    } catch {
      /* ignore */
    }
    iframe.remove()
  }

  window.addEventListener('afterprint', cleanup)
  try {
    printWindow.addEventListener('afterprint', cleanup)
  } catch {
    /* ignore */
  }
  window.setTimeout(cleanup, 120_000)

  printWindow.focus()
  printWindow.print()

  return true
}
