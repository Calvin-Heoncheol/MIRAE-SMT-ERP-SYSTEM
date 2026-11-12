import { PDF_SECTION_COLORS, SECTION_TOTAL_ROW_BG, type PreviewSection } from './preview-rows'

function buildPdfSectionColorCss() {
  const sections: PreviewSection[] = ['smt', 'setup', 'dip', 'post', 'material']

  return sections
    .map((section) => {
      const { bg } = PDF_SECTION_COLORS[section]
      return `
    .summary-breakdown-line-${section} td {
      background: ${bg} !important;
    }
    .breakdown-section-total-${section} td {
      background: ${bg} !important;
    }`
    })
    .join('\n')
}

export function buildQuotePdfCss(fontStack: string) {
  return `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: ${fontStack};
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
      overflow: visible;
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
      grid-template-columns: 56px minmax(0, 1fr);
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
      min-width: 0;
      color: #0f172a;
      font-weight: 600;
    }
    .summary-party-value-wrap {
      line-height: 1.45;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .summary-email {
      display: inline-block;
      max-width: 100%;
      color: #1d4ed8;
      text-decoration: none;
      font-weight: 600;
      overflow-wrap: anywhere;
      word-break: break-all;
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
    .summary-vat-breakdown {
      margin-top: 14px;
      padding: 12px 20px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
    }
    .summary-vat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      font-size: 13px;
      color: #475569;
      font-weight: 600;
    }
    .summary-vat-row + .summary-vat-row {
      margin-top: 8px;
    }
    .summary-grand-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-top: 12px;
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
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.04em;
      color: #0f172a;
    }
    .detail-ref {
      margin: 0;
      font-size: 13px;
      color: #64748b;
    }
    .detail-note {
      margin: 6px 0 0;
      font-size: 12px;
      color: #94a3b8;
    }
    .detail-footer-note {
      margin: 16px 0 0;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
    }
    .quote-page-detail .quote-card,
    .quote-page-breakdown .quote-card,
    .quote-page-post-material .quote-card,
    .quote-page-post .quote-card,
    .quote-page-material .quote-card {
      padding-top: 24px;
    }
    .board-details-groups {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .board-details-groups .board-summary-section {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .board-details-groups .board-summary-section-title {
      margin: 0 0 10px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #475569;
    }
    .board-details-groups .board-summary-table {
      margin-bottom: 0;
      table-layout: fixed;
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e2e8f0;
    }
    .board-details-groups .board-summary-table:not(.summary-breakdown-table) thead {
      background: #1e293b;
    }
    .board-details-groups .board-summary-table:not(.summary-breakdown-table) th {
      padding: 10px 8px;
      font-size: 11px;
      font-weight: 600;
      color: #e2e8f0;
      text-align: center;
      border: none;
      white-space: nowrap;
    }
    .board-details-groups .board-summary-table td {
      padding: 11px 10px;
      vertical-align: middle;
      border-top: 1px solid #cbd5e1;
    }
    .summary-breakdown-table {
      border: 2px solid #94a3b8;
    }
    .summary-breakdown-table thead {
      background: #f1f5f9 !important;
    }
    .summary-breakdown-table th {
      border-bottom: 2px solid #64748b;
      background: #f1f5f9 !important;
      color: #334155 !important;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      padding: 10px 14px;
    }
    .summary-breakdown-table td {
      border-left: 1px solid #cbd5e1;
      border-right: 1px solid #cbd5e1;
    }
    ${buildPdfSectionColorCss()}
    .summary-breakdown-table tbody tr.summary-breakdown-line-row td {
      border-top: 4px solid #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .summary-breakdown-table tbody tr.summary-breakdown-line-row:first-child td {
      border-top: none;
    }
    .board-details-groups .board-summary-table td.matrix-board {
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      word-break: keep-all;
    }
    .board-details-groups .board-summary-table td.matrix-total {
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      vertical-align: middle;
    }
    .summary-breakdown-table .summary-breakdown-col-item {
      width: 40%;
    }
    .summary-breakdown-table .summary-breakdown-col-unit {
      width: 30%;
    }
    .summary-breakdown-table .summary-breakdown-col-amount {
      width: 30%;
    }
    .summary-breakdown-table td.summary-breakdown-item {
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
    }
    .summary-breakdown-table td.summary-breakdown-unit,
    .summary-breakdown-table td.summary-breakdown-amount {
      text-align: center;
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
    }
    .summary-breakdown-table tr.summary-breakdown-total-row td {
      background: ${SECTION_TOTAL_ROW_BG} !important;
      font-weight: 800;
      color: #0f172a;
      border-top: 2px solid #94a3b8;
    }
    .board-details-groups .board-summary-table th:last-child,
    .board-details-groups .board-summary-table td.summary-breakdown-unit,
    .board-details-groups .board-summary-table td.summary-breakdown-amount,
    .board-details-groups .board-summary-table td.matrix-total {
      text-align: center;
    }
    .breakdown-sections {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .breakdown-section-title {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #334155;
      text-align: left;
      break-after: avoid;
      page-break-after: avoid;
    }
    .breakdown-section-post .breakdown-section-inner,
    .breakdown-section-material .breakdown-section-inner,
    .breakdown-section-other .breakdown-section-inner {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .breakdown-subsection + .breakdown-subsection {
      margin-top: 14px;
    }
    .breakdown-subsection-title {
      margin: 0 0 6px;
      font-size: 11.5px;
      font-weight: 700;
      color: #475569;
      text-align: left;
      break-after: avoid;
      page-break-after: avoid;
    }
    .breakdown-section-separated {
      margin-top: 24px;
      padding-top: 0;
      border-top: none;
    }
    .breakdown-table-with-board .breakdown-col-board {
      width: 72px;
      max-width: 96px;
      white-space: nowrap;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .breakdown-continuous-table {
      margin-bottom: 0;
      border: 2px solid #94a3b8;
    }
    .breakdown-continuous-table th {
      background: #f1f5f9;
      border: 1px solid #94a3b8;
      border-bottom: 2px solid #64748b;
      font-weight: 700;
      color: #334155;
    }
    .breakdown-continuous-table td {
      border: 1px solid #cbd5e1;
    }
    .breakdown-continuous-table tr.board-subtotal-row td {
      background: #f8fafc;
      border-top: 1px solid #94a3b8;
      font-weight: 600;
    }
    .breakdown-continuous-table tr.board-group-start td {
      border-top: 2px solid #94a3b8;
    }
    .breakdown-table-with-board th:nth-child(1) {
      text-align: center;
    }
    .breakdown-table-with-board th:nth-child(3),
    .breakdown-table-with-board th:nth-child(5) {
      text-align: right;
    }
    .breakdown-table-with-board th:nth-child(4) {
      text-align: center;
    }
    .breakdown-continuous-table tbody tr.section-total-row:not(:first-child) td {
      padding-top: 14px;
    }
    .breakdown-section .breakdown-continuous-table {
      break-inside: auto;
      page-break-inside: auto;
    }
    .board-details-table {
      margin-bottom: 0;
    }
    .board-details-matrix-table {
      table-layout: fixed;
      width: 100%;
    }
    .board-details-matrix-table .matrix-col-board {
      width: 70%;
    }
    .board-details-matrix-table .matrix-col-total {
      width: 30%;
    }
    .board-details-matrix-table th,
    .board-details-matrix-table td {
      padding: 11px 10px;
      vertical-align: middle;
    }
    .board-details-matrix-table th {
      padding: 10px 8px;
      font-size: 11px;
      font-weight: 600;
      color: #e2e8f0;
      text-align: center;
      white-space: nowrap;
    }
    .board-details-matrix-table tr.board-matrix-row {
      border-top: 1px solid #e2e8f0;
    }
    .board-details-shared-table thead {
      background: #475569;
    }
    .board-details-table:not(.summary-breakdown-table) th {
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 600;
      color: #e2e8f0;
      border: none;
    }
    .board-details-table:not(.board-summary-table) th:last-child {
      text-align: right;
    }
    .board-details-groups .board-summary-table th:last-child,
    .board-details-groups .board-summary-table td.matrix-total {
      text-align: center;
    }
    .board-details-table td {
      vertical-align: top;
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
        padding: 24px 24px 22px;
      }
      .summary-party-card {
        padding: 18px 20px;
      }
      .summary-party-row {
        font-size: 12.5px;
      }
      .summary-doc-meta {
        padding: 12px 20px;
      }
      .summary-amount-section {
        padding: 22px 20px 26px;
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
      .breakdown-section-post .breakdown-section-inner,
      .breakdown-section-material .breakdown-section-inner,
      .breakdown-section-other .breakdown-section-inner {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .breakdown-section-title {
        break-after: avoid !important;
        page-break-after: avoid !important;
      }
      .breakdown-section .breakdown-continuous-table {
        break-inside: auto !important;
        page-break-inside: auto !important;
      }
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
      .board-details-board-table thead {
        background: #1e293b !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .board-details-shared-table thead {
        background: #475569 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .board-details-table:not(.summary-breakdown-table) thead {
        background: #1e293b !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .board-details-table:not(.summary-breakdown-table) th {
        color: #e2e8f0 !important;
      }
      .summary-breakdown-table thead {
        background: #f1f5f9 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .summary-breakdown-table th {
        color: #334155 !important;
        background: #f1f5f9 !important;
      }
      .summary-breakdown-table tr.summary-breakdown-line-row td {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .breakdown-section-total-smt td,
      .breakdown-section-total-setup td,
      .breakdown-section-total-dip td,
      .breakdown-section-total-post td,
      .breakdown-section-total-material td,
      .breakdown-section-total-other td {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .board-total-row td,
      .board-shared-post-row td,
      .board-shared-material-row td {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .quote-table tr.board-subtotal-row td {
        background-color: #e2e8f0 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
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
`
}
