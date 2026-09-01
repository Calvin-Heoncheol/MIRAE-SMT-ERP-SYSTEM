import {
  APP_SHORT_NAME,
  COMPANY_ADDRESS_DOMESTIC,
  COMPANY_ADDRESS_DOMESTIC_EN,
  COMPANY_ADDRESS_EXPORT,
  COMPANY_NAME_DOMESTIC_EN,
  COMPANY_NAME_EN,
  COMPANY_QUOTE_CONTACT_EXPORT,
  COMPANY_QUOTE_EMAIL_DOMESTIC,
  COMPANY_QUOTE_EMAIL_EXPORT,
} from '@/lib/app-config'
import { exportPage1SummaryAmounts, formatExportSummaryUsd, formatQuoteMoneyTotal, formatQuoteValidityText, domesticPage1SummaryAmounts, formatQuoteKrw } from './format'
import { breakdownSmtSectionTitle, getPreviewLabels, resolveLabelQuoteType, type QuoteDocumentLanguage } from './preview-i18n'
import {
  breakdownBoardColLabel,
  buildPdfSummaryBreakdownLines,
  buildQuotePreviewData,
  computeBreakdownBoardRowSpans,
  filterPdfBreakdownRows,
  formatPreviewRowDescription,
  formatPreviewRowUnit,
  isBreakdownBoardGroupStart,
  isPreviewHighlightRow,
  PDF_SECTION_COLORS,
  pdfSummarySectionLabel,
  prepareBreakdownSectionTableRows,
  SECTION_TOTAL_ROW_BG,
  type PdfSummaryBreakdownLine,
  type PreviewRow,
  type PreviewSection,
} from './preview-rows'
import type { QuoteListItem, QuoteType } from './types'

export type ExportQuotePdfOptions = {
  /** 국내용도 영문 문구로 PDF 출력 가능 */
  language?: QuoteDocumentLanguage
  /** 공급자 E-mail — 로그인 사용자 이메일 (없으면 회사 기본 메일) */
  contactEmail?: string
}

function resolveQuoteContactEmail(
  useDomesticCompany: boolean,
  contactEmail?: string | null,
) {
  const email = String(contactEmail || '').trim()
  if (email) return email
  return useDomesticCompany ? COMPANY_QUOTE_EMAIL_DOMESTIC : COMPANY_QUOTE_EMAIL_EXPORT
}

function pdfLabelType(quote: QuoteListItem, language?: QuoteDocumentLanguage): QuoteType {
  return resolveLabelQuoteType(quote.quoteType, language)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** PDF「다른 이름으로 저장」기본 파일명용 — Windows 금지문자 제거 */
function sanitizePdfFilenamePart(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/** 견적서번호_품목 (복수 건이면 _외N건) */
function buildQuotePdfDocumentTitle(quotes: QuoteListItem[]) {
  if (!quotes.length) return '견적서'
  const quote = quotes[0]
  const number = sanitizePdfFilenamePart(String(quote.quoteNumber || '').trim()) || '견적서'
  const product = sanitizePdfFilenamePart(String(quote.productName || '').trim()) || '품목'
  const base = `${number}_${product}`
  if (quotes.length === 1) return base
  return `${base}_외${quotes.length - 1}건`
}

function buildSectionPageHeaderHtml(
  quote: QuoteListItem,
  estimate: ReturnType<typeof buildQuotePreviewData>['estimate'],
  title: string,
  note: string,
) {
  return `<div class="detail-header">
    <h2>${title}</h2>
    <p class="detail-ref">${escapeHtml(estimate.estNo)} · ${escapeHtml(quote.productName?.trim() || '-')}</p>
    ${note ? `<p class="detail-note">${note}</p>` : ''}
  </div>`
}

function formatBoardDetailCellAmount(value: number, quoteType: QuoteType) {
  if (!value) return '-'
  return formatQuoteMoneyTotal(value, quoteType)
}

function buildSummaryBreakdownLineRowHtml(line: PdfSummaryBreakdownLine, quoteType: QuoteType) {
  const bg = PDF_SECTION_COLORS[line.section].bg
  const cellStyle = `background:${bg};`
  return `<tr class="summary-breakdown-line-row summary-breakdown-line-${line.section}">
    <td class="summary-breakdown-item" style="${cellStyle}">${escapeHtml(line.label)}</td>
    <td class="summary-breakdown-unit" style="${cellStyle}">${formatBoardDetailCellAmount(line.unitTotal, quoteType)}</td>
    <td class="summary-breakdown-amount" style="${cellStyle}">${formatBoardDetailCellAmount(line.total, quoteType)}</td>
  </tr>`
}

function buildSummaryBreakdownTableHtml(quote: QuoteListItem, language?: QuoteDocumentLanguage) {
  const { estimate, form, labelType } = buildQuotePreviewData(quote, { labelLanguage: language })
  const lines = buildPdfSummaryBreakdownLines(estimate, form, quote.quoteType, labelType)
  if (!lines.length) return ''

  const isKorean = labelType === 'domestic'
  const itemLabel = isKorean ? '항목' : 'ITEM'
  const unitLabel = isKorean ? '대당합계' : 'UNIT TOTAL'
  const amountLabel = isKorean ? '합계' : 'TOTAL'
  const totalLabel = isKorean ? '총합계' : 'GRAND TOTAL'
  const grandUnitTotal = lines.reduce(
    (sum, line) => (line.fixedCost ? sum : sum + line.unitTotal),
    0,
  )
  const grandTotal = lines.reduce((sum, line) => sum + line.total, 0)

  return `<table class="quote-table board-details-table board-summary-table summary-breakdown-table">
    <colgroup>
      <col class="summary-breakdown-col-item" />
      <col class="summary-breakdown-col-unit" />
      <col class="summary-breakdown-col-amount" />
    </colgroup>
    <thead>
      <tr>
        <th>${itemLabel}</th>
        <th>${unitLabel}</th>
        <th>${amountLabel}</th>
      </tr>
    </thead>
    <tbody>
      ${lines.map((line) => buildSummaryBreakdownLineRowHtml(line, quote.quoteType)).join('')}
      <tr class="summary-breakdown-total-row">
        <td class="summary-breakdown-item">${totalLabel}</td>
        <td class="summary-breakdown-unit">${formatBoardDetailCellAmount(grandUnitTotal, quote.quoteType)}</td>
        <td class="summary-breakdown-amount">${formatBoardDetailCellAmount(grandTotal, quote.quoteType)}</td>
      </tr>
    </tbody>
  </table>`
}

function buildBoardDetailsTableHtml(quote: QuoteListItem, language?: QuoteDocumentLanguage) {
  const table = buildSummaryBreakdownTableHtml(quote, language)
  if (!table) return ''

  return `<div class="breakdown-sections board-details-groups">${table}</div>`
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

function buildPreviewRowHtml(
  row: PreviewRow,
  quoteType: QuoteType,
  options: {
    showBoardColumn?: boolean
    showProductionQty?: boolean
    boardRowSpan?: number
    boardGroupStart?: boolean
    swapUnitAndCount?: boolean
  } = {},
) {
  const {
    showBoardColumn = false,
    showProductionQty = false,
    boardRowSpan,
    boardGroupStart = false,
    swapUnitAndCount = false,
  } = options
  const isBoardTotal = Boolean(row.boardTotal)
  const isBoardSubtotal = Boolean(row.boardSubtotal)
  const isSectionTotal = Boolean(row.sectionTotal)
  const sectionFooter = row.sectionFooter
  const sectionColors = sectionFooter ? PDF_SECTION_COLORS[sectionFooter] : null
  const sectionBg = isBoardTotal || isSectionTotal ? SECTION_TOTAL_ROW_BG : isBoardSubtotal ? '#e2e8f0' : ''
  const footerBg = sectionColors?.bg ?? sectionBg
  const indent =
    row.indent === 1 ? 'padding-left:24px;' : row.indent != null && row.indent >= 2 ? 'padding-left:40px;' : ''
  const labelStyle =
    isBoardTotal || row.emphasize || sectionFooter
      ? 'font-weight:700;color:#0f172a;'
      : row.indent
        ? 'font-size:13px;color:#475569;'
        : 'color:#1e293b;'
  const amountStyle = row.amountEmphasize || isBoardTotal || isBoardSubtotal || sectionFooter
    ? 'font-weight:700;color:#0f172a;'
    : 'font-size:13px;color:#475569;'
  const highlight = isPreviewHighlightRow(row)
  const cellBg = footerBg ? `background:${footerBg};` : ''
  const rowClass = [
    highlight ? 'section-total-row' : '',
    isBoardSubtotal ? 'board-subtotal-row' : '',
    sectionFooter ? `breakdown-section-total breakdown-section-total-${sectionFooter}` : '',
    boardGroupStart ? 'board-group-start' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const description = formatPreviewRowDescription(row)
  const descriptionHtml = description
    ? `<br><span style="font-size:11px;color:#64748b;">${escapeHtml(description)}</span>`
    : ''
  const unit = isBoardSubtotal ? '' : formatPreviewRowUnit(row, quoteType)
  const unitAlign = row.unitLabel ? 'left' : 'right'
  const count = isBoardSubtotal ? '' : row.count != null ? escapeHtml(String(row.count)) : '-'
  const firstMetric = swapUnitAndCount ? count : unit
  const secondMetric = swapUnitAndCount ? unit : count
  const firstMetricAlign = swapUnitAndCount ? 'center' : unitAlign
  const secondMetricAlign = swapUnitAndCount ? unitAlign : 'center'
  const productionQty = isBoardSubtotal
    ? ''
    : row.productionQty != null
      ? escapeHtml(String(row.productionQty))
      : showProductionQty
        ? '-'
        : ''
  const amount = isBoardSubtotal ? '' : row.amount != null ? formatQuoteMoneyTotal(row.amount, quoteType) : '-'
  const borderTop = boardGroupStart
    ? '2px solid #94a3b8'
    : highlight
      ? '2px solid #64748b'
      : '1px solid #cbd5e1'
  const cellBorder = 'border:1px solid #cbd5e1;'
  let boardCell = ''
  if (showBoardColumn && boardRowSpan !== 0) {
    const rowspanAttr = boardRowSpan && boardRowSpan > 1 ? ` rowspan="${boardRowSpan}"` : ''
    const boardBorderRight = 'border-right:2px solid #94a3b8;'
    const boardCellBg = row.boardName || isBoardSubtotal ? 'background:#e2e8f0;' : cellBg
    boardCell = `<td class="breakdown-col-board"${rowspanAttr} style="padding:8px 12px;white-space:nowrap;vertical-align:middle;${boardCellBg}${cellBorder}${boardBorderRight}font-size:13px;font-weight:600;color:#1e293b;">${row.boardName ? escapeHtml(row.boardName) : ''}</td>`
  }
  const productionQtyCell = showProductionQty
    ? `<td style="padding:8px 12px;text-align:center;white-space:nowrap;${cellBg}${cellBorder}font-size:13px;color:#475569;">${productionQty}</td>`
    : ''

  return `<tr class="${rowClass}" style="border-top:${borderTop};">
    ${boardCell}
    <td class="breakdown-col-item" style="padding:8px 12px;${indent}${labelStyle}${cellBg}${cellBorder}">${escapeHtml(row.label)}${descriptionHtml}</td>
    <td style="padding:8px 12px;text-align:${firstMetricAlign};${cellBg}${cellBorder}font-size:13px;color:#475569;">${firstMetric}</td>
    <td style="padding:8px 12px;text-align:${secondMetricAlign};white-space:nowrap;${cellBg}${cellBorder}font-size:13px;color:#475569;">${secondMetric}</td>
    ${productionQtyCell}
    <td style="padding:8px 12px;text-align:right;${amountStyle}${cellBg}${cellBorder}">${amount}</td>
  </tr>`
}

function buildQuoteBreakdownTableHtml(
  rows: PreviewRow[],
  quoteType: QuoteType,
  options: {
    variant?: 'default' | 'board-summary'
    continuous?: boolean
    showBoardColumn?: boolean
    labelType?: QuoteType
    sectionKey?: PreviewSection
  } = {},
) {
  const {
    variant = 'default',
    continuous = false,
    showBoardColumn = false,
    labelType = quoteType,
    sectionKey,
  } = options
  const labels = getPreviewLabels(labelType)
  const isSetupSection = sectionKey === 'setup'
  const isPostSection = sectionKey === 'post'
  const showProductionQty = false
  const unitHeader = labels.colUnit
  const qtyHeader = isSetupSection
    ? labels.colSetupMinutes
    : sectionKey === 'smt'
      ? labels.colSmdWorkQty
      : isPostSection
        ? labels.colPostWorkQty
        : labels.colQty
  const firstMetricHeader = isPostSection ? qtyHeader : unitHeader
  const secondMetricHeader = isPostSection ? unitHeader : qtyHeader
  const secondMetricHeaderAlign = isPostSection ? 'right' : 'center'
  const tableClass =
    variant === 'board-summary'
      ? 'quote-table line-items-table board-summary-table'
      : 'quote-table line-items-table'
  const boardHeader = showBoardColumn ? `<th class="breakdown-col-board">${breakdownBoardColLabel(labelType)}</th>` : ''
  const productionQtyHeader = showProductionQty
    ? `<th style="text-align:center;">${labels.colProductionQty}</th>`
    : ''
  const tableHead = `<thead>
      <tr>
        ${boardHeader}
        <th>${labels.colItem}</th>
        <th>${firstMetricHeader}</th>
        <th style="text-align:${secondMetricHeaderAlign};">${secondMetricHeader}</th>
        ${productionQtyHeader}
        <th>${labels.colPerUnitTotal}</th>
      </tr>
    </thead>`

  if (continuous) {
    const boardSpans = showBoardColumn ? computeBreakdownBoardRowSpans(rows) : []
    const bodyHtml = rows
      .map((row, index) =>
        buildPreviewRowHtml(row, quoteType, {
          showBoardColumn,
          showProductionQty,
          boardRowSpan: showBoardColumn ? boardSpans[index] : undefined,
          boardGroupStart: showBoardColumn && isBreakdownBoardGroupStart(rows, index),
          swapUnitAndCount: isPostSection,
        }),
      )
      .join('')

    return `<table class="${tableClass} breakdown-continuous-table${showBoardColumn ? ' breakdown-table-with-board' : ''}">
      ${tableHead}
      <tbody>${bodyHtml}</tbody>
    </table>`
  }

  const groups = splitPreviewRowsIntoGroups(rows)

  return groups
    .map((group) => {
      const boardSpans = showBoardColumn ? computeBreakdownBoardRowSpans(group) : []
      const bodyHtml = group
        .map((row, index) =>
          buildPreviewRowHtml(row, quoteType, {
            showBoardColumn,
            showProductionQty,
            boardRowSpan: showBoardColumn ? boardSpans[index] : undefined,
            boardGroupStart: showBoardColumn && isBreakdownBoardGroupStart(group, index),
            swapUnitAndCount: isPostSection,
          }),
        )
        .join('')

      return `<div class="quote-row-group">
    <table class="${tableClass}${showBoardColumn ? ' breakdown-table-with-board' : ''}">
      ${tableHead}
      <tbody>${bodyHtml}</tbody>
    </table>
  </div>`
    })
    .join('')
}

function buildBreakdownSectionHtml(
  title: string,
  rows: PreviewRow[],
  quoteType: QuoteType,
  sectionKey: PreviewSection,
  modifier = '',
  labelType: QuoteType = quoteType,
  qty = 1,
) {
  if (!rows.length) return ''

  const tableRows = prepareBreakdownSectionTableRows(rows, sectionKey, labelType, qty)

  const showBoardColumn = tableRows.some((row) => row.boardName)
  const sectionClass = `breakdown-section-${sectionKey}`

  return `<div class="breakdown-section ${sectionClass} ${modifier}">
    <div class="breakdown-section-inner">
      <h3 class="breakdown-section-title">${escapeHtml(title)}</h3>
      ${buildQuoteBreakdownTableHtml(tableRows, quoteType, {
        continuous: true,
        showBoardColumn,
        labelType,
        sectionKey,
      })}
    </div>
  </div>`
}

function buildQuoteSummaryMetaHtml(
  quote: QuoteListItem,
  estimate: ReturnType<typeof buildQuotePreviewData>['estimate'],
  previewTitle: string,
  language?: QuoteDocumentLanguage,
  contactEmail?: string,
) {
  const labelType = pdfLabelType(quote, language)
  const isKorean = labelType === 'domestic'
  const labels = getPreviewLabels(labelType)
  const issueDate = quote.quoteDate || estimate.date
  const validityText = formatQuoteValidityText(issueDate)
  const qtyText = labels.formatQty(estimate.qty)
  const customer = quote.customer?.trim() || '-'
  const productName = quote.productName?.trim() || '-'
  const recipientLabel = isKorean ? '수신' : 'Bill To'
  const supplierLabel = isKorean ? '공급' : 'From'
  const customerLabel = isKorean ? '고객사' : 'Customer'
  const productLabel = isKorean ? '제품명' : 'Product'
  const issueLabel = isKorean ? '발행일자' : 'Issue Date'
  const validityLabel = isKorean ? '유효기간' : 'Valid Until'
  const qtyLabelText = isKorean ? '생산 수량' : 'Quantity'
  const kindLabelText = labels.productionKind
  const contactLabel = isKorean ? '담당' : 'Contact'
  const addressLabel = isKorean ? '주소' : 'Address'
  const emailLabel = 'E-mail'
  const productionKind = quote.detailInfo.settings?.productionKind === '샘플' ? '샘플' : '양산'
  const productionKindText =
    productionKind === '샘플' ? labels.productionKindSample : labels.productionKindMass

  // 국내용: 국문=미래SMT / 영문=MIRAE SMT · 해외용: MIRAE SMT AMERICA
  const isDomesticQuote = quote.quoteType === 'domestic'
  const companyName = isDomesticQuote
    ? isKorean
      ? APP_SHORT_NAME
      : COMPANY_NAME_DOMESTIC_EN
    : COMPANY_NAME_EN
  const email = resolveQuoteContactEmail(isDomesticQuote, contactEmail)
  const companyAddress = isDomesticQuote
    ? isKorean
      ? COMPANY_ADDRESS_DOMESTIC
      : COMPANY_ADDRESS_DOMESTIC_EN
    : COMPANY_ADDRESS_EXPORT
  const brandTagline = isKorean ? 'SMT 전자조립 · EMS' : 'SMT Assembly · EMS'
  const companyNameLabel = isKorean ? '업체명' : 'Company'
  const contactName = isDomesticQuote
    ? isKorean
      ? '영업관리팀'
      : 'Sales Team'
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
) {
  const qty = estimate.qty || 1
  const page1Export =
    quote.quoteType === 'export' ? exportPage1SummaryAmounts(estimate.values.grandTotal, qty) : null
  const page1Domestic =
    quote.quoteType === 'domestic'
      ? domesticPage1SummaryAmounts(estimate.values.grandTotal, qty)
      : null
  const unitPriceText = page1Export
    ? formatExportSummaryUsd(page1Export.unitUsd)
    : page1Domestic
      ? formatQuoteKrw(page1Domestic.unitKrw)
      : formatQuoteMoneyTotal(estimate.values.grandTotal / qty, quote.quoteType)
  const totalText = page1Export
    ? formatExportSummaryUsd(page1Export.totalUsd)
    : page1Domestic
      ? formatQuoteKrw(page1Domestic.totalKrw)
      : formatQuoteMoneyTotal(estimate.values.grandTotal, quote.quoteType)
  const labelType = pdfLabelType(quote, language)
  const labels = getPreviewLabels(labelType)
  const qtyText = labels.formatQty(qty)
  const productName = quote.productName?.trim() || '-'
  const isKorean = labelType === 'domestic'
  const sectionTitle = isKorean ? '견적 금액' : 'Quote Amount'
  const unitPriceLabel = isKorean ? '단가 (VAT 별도)' : 'Unit Price (excl. VAT)'
  const qtyColLabel = isKorean ? '개수' : 'Qty'
  const totalLabel = isKorean ? '총 합계 (VAT 별도)' : 'Total (excl. VAT)'
  const productColLabel = isKorean ? '제품명' : 'Product'
  const grandLabel = isKorean ? '최종 합계 금액 (VAT 별도)' : 'Grand Total (excl. VAT)'
  const note = isKorean
    ? '※ 항목별 요약·세부 산정내역은 다음 페이지를 참고해 주세요.'
    : '※ See the summary breakdown and detailed breakdown on the following pages.'

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
  language?: QuoteDocumentLanguage,
) {
  const isKorean = pdfLabelType(quote, language) === 'domestic'
  const title = isKorean ? '항목별 요약' : 'Summary Breakdown'
  const note = isKorean
    ? 'SMD(SET-UP·실장)·후공정·자재 대당합계와 생산수량 기준 합계입니다.'
    : 'Unit totals and quantity totals for SMD (SET-UP, placement), post-process, and materials.'

  return `${buildSectionPageHeaderHtml(quote, estimate, title, note)}`
}

function buildQuoteDetailedBreakdownPage(quote: QuoteListItem, language?: QuoteDocumentLanguage) {
  const { estimate, pdfBreakdownRows, labelType } = buildQuotePreviewData(quote, {
    labelLanguage: language,
  })
  const labels = getPreviewLabels(labelType)
  const smtRows = filterPdfBreakdownRows(pdfBreakdownRows, 'smt', quote.quoteType)
  const setupRows = filterPdfBreakdownRows(pdfBreakdownRows, 'setup', quote.quoteType)
  const postRows = filterPdfBreakdownRows(pdfBreakdownRows, 'post', quote.quoteType)
  const materialRows = filterPdfBreakdownRows(pdfBreakdownRows, 'material', quote.quoteType)
  if (
    !smtRows.length &&
    !setupRows.length &&
    !postRows.length &&
    !materialRows.length
  ) {
    return ''
  }

  const isKorean = labelType === 'domestic'
  const pageTitle = isKorean ? '공정별 세부 산정내역' : 'Detailed Breakdown by Process'
  const pageNote = isKorean
    ? 'SMD(SET-UP·실장·검사)·후공정(납땜 포함)·자재 항목별 단가·수량 기준 산정식입니다.'
    : 'Itemized calculation for SMD (SET-UP, placement, inspection), post-process (incl. soldering), and materials.'
  const postTitle = pdfSummarySectionLabel(labels.postProcess, labelType)
  const materialTitle = pdfSummarySectionLabel(labels.materials, labelType)

  return `<section class="quote-page quote-page-breakdown">
    <div class="quote-card">
      ${buildSectionPageHeaderHtml(quote, estimate, pageTitle, pageNote)}
      <div class="breakdown-sections">
        ${buildBreakdownSectionHtml('SET-UP', setupRows, quote.quoteType, 'setup', 'breakdown-section-separated', labelType, estimate.qty || 1)}
        ${buildBreakdownSectionHtml(breakdownSmtSectionTitle(labelType), smtRows, quote.quoteType, 'smt', 'breakdown-section-smt', labelType, estimate.qty || 1)}
        ${buildBreakdownSectionHtml(postTitle, postRows, quote.quoteType, 'post', 'breakdown-section-separated', labelType, estimate.qty || 1)}
        ${buildBreakdownSectionHtml(materialTitle, materialRows, quote.quoteType, 'material', 'breakdown-section-separated', labelType, estimate.qty || 1)}
      </div>
    </div>
  </section>`
}

function buildQuoteSummaryPage(
  quote: QuoteListItem,
  language?: QuoteDocumentLanguage,
  contactEmail?: string,
) {
  const { estimate, labelType } = buildQuotePreviewData(quote, { labelLanguage: language })
  const labels = getPreviewLabels(labelType)

  return `<section class="quote-page quote-page-summary">
    <div class="quote-card quote-card-summary">
      ${buildQuoteSummaryMetaHtml(quote, estimate, labels.title, language, contactEmail)}
      ${buildQuoteSummaryTableHtml(quote, estimate, language)}
    </div>
  </section>`
}

function buildQuoteDetailPage(quote: QuoteListItem, language?: QuoteDocumentLanguage) {
  const { estimate } = buildQuotePreviewData(quote, { labelLanguage: language })
  const isKorean = pdfLabelType(quote, language) === 'domestic'
  const footerNote = isKorean
    ? '※ 공정별 세부 산정내역은 다음 페이지를 참고해 주세요.'
    : '※ See the following page for the detailed breakdown by process.'

  return `<section class="quote-page quote-page-detail">
    <div class="quote-card">
      ${buildQuoteDetailHeaderHtml(quote, estimate, language)}
      ${buildBoardDetailsTableHtml(quote, language)}
      <p class="detail-footer-note">${footerNote}</p>
    </div>
  </section>`
}

function buildQuotePages(
  quote: QuoteListItem,
  language?: QuoteDocumentLanguage,
  contactEmail?: string,
) {
  return (
    buildQuoteSummaryPage(quote, language, contactEmail) +
    buildQuoteDetailPage(quote, language) +
    buildQuoteDetailedBreakdownPage(quote, language)
  )
}

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

function buildQuotesPdfHtml(quotes: QuoteListItem[], options?: ExportQuotePdfOptions) {
  const language = options?.language
  const contactEmail = options?.contactEmail
  const pages = quotes.map((quote) => buildQuotePages(quote, language, contactEmail)).join('')
  const isEnglish = language === 'en' || quotes.every((q) => q.quoteType === 'export')
  const docLang = isEnglish ? 'en' : 'ko'
  const printHint = isEnglish
    ? 'In the print dialog: turn off “Headers and footers”, then choose “Save as PDF”.'
    : '인쇄 설정에서 「머리글 및 바닥글」 체크를 해제한 뒤 「PDF로 저장」을 선택하세요.'
  const printButton = isEnglish ? 'Save as PDF' : 'PDF로 저장'

  return `<!DOCTYPE html>
<html lang="${docLang}">
<head>
  <meta charset="utf-8" />
  <!-- 브라우저 인쇄 머리글에 파일명이 찍히지 않도록 비움 (저장 파일명은 부모 document.title 사용) -->
  <title></title>
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
  </style>
</head>
<body>
  <div class="no-print">
    ${printHint}
    <button type="button" onclick="window.print()">${printButton}</button>
  </div>
  ${pages}
</body>
</html>`
}

export function exportQuotesToPdf(quotes: QuoteListItem[], options?: ExportQuotePdfOptions) {
  if (!quotes.length || typeof document === 'undefined') return false

  const pdfTitle = buildQuotePdfDocumentTitle(quotes)
  const html = buildQuotesPdfHtml(quotes, options)
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
  // 인쇄 머리글에 견적번호·품명이 나오지 않도록 iframe 문서 제목은 비움
  try {
    doc.title = ''
  } catch {
    /* ignore */
  }

  // Chrome 등: iframe print 시 부모 document.title 이 「다른 이름으로 저장」기본명으로 쓰임
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
  // 대화상자가 열린 동안 제목 유지 (저장 후 afterprint 또는 타임아웃)
  window.setTimeout(cleanup, 120_000)

  printWindow.focus()
  printWindow.print()

  return true
}
