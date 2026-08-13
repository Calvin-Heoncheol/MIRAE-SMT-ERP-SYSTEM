export type ReportPdfStat = {
  label: string
  value: string
  sub?: string
}

export type ReportPdfColumn = {
  header: string
  align?: 'left' | 'right'
}

export type ReportPdfTable = {
  title: string
  columns: ReportPdfColumn[]
  /** 셀 값은 미리 포맷된 문자열 */
  rows: string[][]
}

type ExportReportPdfOptions = {
  /** 문서 제목 (예: 생산실적 리포트) */
  title: string
  /** 기간 라벨 (예: 2026년 7월) */
  rangeLabel: string
  stats: ReportPdfStat[]
  tables: ReportPdfTable[]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildStatsHtml(stats: ReportPdfStat[]): string {
  const cards = stats
    .map(
      (stat) => `
      <div class="stat-card">
        <p class="stat-label">${escapeHtml(stat.label)}</p>
        <p class="stat-value">${escapeHtml(stat.value)}</p>
        ${stat.sub ? `<p class="stat-sub">${escapeHtml(stat.sub)}</p>` : ''}
      </div>`,
    )
    .join('')
  return `<div class="stats-grid">${cards}</div>`
}

function buildTableHtml(table: ReportPdfTable): string {
  const headerCells = table.columns
    .map(
      (column) =>
        `<th class="${column.align === 'right' ? 'align-right' : 'align-left'}">${escapeHtml(column.header)}</th>`,
    )
    .join('')

  const bodyRows = table.rows.length
    ? table.rows
        .map((row) => {
          const cells = row
            .map(
              (cell, index) =>
                `<td class="${table.columns[index]?.align === 'right' ? 'align-right' : 'align-left'}">${escapeHtml(cell)}</td>`,
            )
            .join('')
          return `<tr>${cells}</tr>`
        })
        .join('')
    : `<tr><td class="empty-row" colspan="${table.columns.length}">데이터가 없습니다.</td></tr>`

  return `
    <section class="report-section">
      <h2>${escapeHtml(table.title)}</h2>
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </section>`
}

function buildReportPdfHtml({ title, rangeLabel, stats, tables }: ExportReportPdfOptions): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #0f172a;
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      font-size: 12px;
    }
    .no-print {
      padding: 12px 16px;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .no-print button {
      padding: 6px 14px;
      border: none;
      border-radius: 6px;
      background: #e11d48;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .report-page { padding: 16px; }
    .report-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 2px solid #1e293b;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .report-header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .report-header .range { font-size: 13px; font-weight: 600; color: #475569; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .stat-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .stat-label { margin: 0; font-size: 10px; font-weight: 600; color: #64748b; }
    .stat-value { margin: 3px 0 0; font-size: 15px; font-weight: 700; }
    .stat-sub { margin: 2px 0 0; font-size: 9px; color: #94a3b8; }
    .report-section { margin-bottom: 16px; break-inside: avoid; page-break-inside: avoid; }
    .report-section h2 {
      margin: 0 0 6px;
      font-size: 13px;
      font-weight: 700;
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
      font-size: 11px;
    }
    th {
      background: #1e293b !important;
      color: #e2e8f0;
      font-weight: 600;
      white-space: nowrap;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    tbody tr:nth-child(even) td {
      background: #f8fafc !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .align-left { text-align: left; }
    .align-right { text-align: right; font-variant-numeric: tabular-nums; }
    .empty-row { text-align: center; color: #94a3b8; padding: 14px 8px; }
    .report-footer {
      margin-top: 12px;
      font-size: 9px;
      color: #94a3b8;
      text-align: right;
    }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print">
    인쇄 대화상자에서 「PDF로 저장」을 선택하세요.
    <button type="button" onclick="window.print()">PDF로 저장</button>
  </div>
  <div class="report-page">
    <header class="report-header">
      <h1>${escapeHtml(title)}</h1>
      <span class="range">${escapeHtml(rangeLabel)}</span>
    </header>
    ${buildStatsHtml(stats)}
    ${tables.map(buildTableHtml).join('')}
    <p class="report-footer">출력일: ${new Date().toLocaleString('ko-KR')}</p>
  </div>
</body>
</html>`
}

/** 리포트를 인쇄 대화상자(PDF 저장)로 내보낸다. 브라우저 전용 */
export function exportReportPdf(options: ExportReportPdfOptions): boolean {
  if (typeof document === 'undefined') return false

  const html = buildReportPdfHtml(options)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', `${options.title} PDF`)
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
