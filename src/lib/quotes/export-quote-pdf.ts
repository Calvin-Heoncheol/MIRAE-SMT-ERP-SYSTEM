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
import {
  AOI_UNIT,
  DIP_UNIT,
  POST_RATE_ADMIN,
  POST_RATE_CORPORATE_PROFIT,
  POST_RATE_DIRECT_LABOR,
  POST_RATE_OVERHEAD,
  SMT_SETUP_BASE_TIME_DESCRIPTION,
  SMT_SETUP_FIRST_ARTICLE_DESCRIPTION,
  SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART,
  SMT_SETUP_SETTING_DESCRIPTION,
  getPostRate,
  getSmtSetupBaseMinutes,
  getSmtSetupMinutesPerPart,
  getSmtSetupRate,
  getSmtUnitRates,
} from './constants'
import { formatQuoteProcessTypeCodes } from './production-flags'
import { formatQuoteMoneyTotal, formatQuoteValidityText, domesticPage1SummaryAmounts, domesticVatBreakdown, formatQuoteKrw, formatQuoteKrwRate } from './format'
import {
  breakdownSmtSectionTitle,
  getPreviewLabels,
  resolveLabelQuoteType,
  resolvePdfLanguage,
  type QuoteDocumentLanguage,
  type QuoteLabelType,
} from './preview-i18n'
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

function pdfLabelType(quote: QuoteListItem, language?: QuoteDocumentLanguage): QuoteLabelType {
  return resolveLabelQuoteType(quote.quoteType, language)
}

function pdfLang(quote: QuoteListItem, language?: QuoteDocumentLanguage): QuoteDocumentLanguage {
  return resolvePdfLanguage(quote.quoteType, language)
}

/** PDF 문구 — 한글 / 영문 / 중문 */
function pdfText(lang: QuoteDocumentLanguage, ko: string, en: string, zh: string) {
  if (lang === 'zh') return zh
  if (lang === 'en') return en
  return ko
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

  const lang = resolvePdfLanguage(quote.quoteType, language)
  const itemLabel = pdfText(lang, '항목', 'ITEM', '项目')
  const unitLabel = pdfText(lang, '대당합계', 'UNIT TOTAL', '单价合计')
  const amountLabel = pdfText(lang, '합계', 'TOTAL', '合计')
  const totalLabel = pdfText(lang, '총합계', 'GRAND TOTAL', '总计')
  const grandUnitTotal = lines.reduce((sum, line) => sum + line.unitTotal, 0)
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
    showUnitTotal?: boolean
    boardRowSpan?: number
    boardGroupStart?: boolean
    swapUnitAndCount?: boolean
  } = {},
) {
  const {
    showBoardColumn = false,
    showProductionQty = false,
    showUnitTotal = false,
    boardRowSpan,
    boardGroupStart = false,
    swapUnitAndCount = false,
  } = options
  const isBoardTotal = Boolean(row.boardTotal)
  const isBoardSubtotal = Boolean(row.boardSubtotal)
  const showBoardSubtotalMetrics = Boolean(row.unitLabel) || (isBoardSubtotal && row.amount != null)
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
  const amountStyle = row.amountEmphasize || isBoardTotal || sectionFooter
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
  const unit =
    isBoardSubtotal && !showBoardSubtotalMetrics
      ? ''
      : isBoardSubtotal && !row.unitLabel && row.unit == null
        ? ''
        : showUnitTotal && row.unit == null && !row.unitLabel
          ? ''
          : formatPreviewRowUnit(row, quoteType)
  const unitAlign = row.unitLabel ? 'left' : 'right'
  const count =
    isBoardSubtotal && !showBoardSubtotalMetrics
      ? ''
      : row.count != null
        ? escapeHtml(String(row.count))
        : showBoardSubtotalMetrics
          ? ''
          : '-'
  const firstMetric = swapUnitAndCount ? count : unit
  const secondMetric = swapUnitAndCount ? unit : count
  const firstMetricAlign = swapUnitAndCount ? 'center' : unitAlign
  const secondMetricAlign = swapUnitAndCount ? unitAlign : 'center'
  const productionQty =
    isBoardSubtotal && !showBoardSubtotalMetrics
      ? ''
      : row.productionQty != null
        ? escapeHtml(String(row.productionQty))
        : showProductionQty
          ? '-'
          : ''
  const unitPrice =
    isBoardSubtotal
      ? ''
      : row.unitPrice == null
        ? showUnitTotal
          ? '-'
          : ''
        : formatQuoteMoneyTotal(row.unitPrice, quoteType)
  const amount =
    row.amount == null
      ? isBoardSubtotal && !showBoardSubtotalMetrics
        ? ''
        : '-'
      : isBoardSubtotal && !showBoardSubtotalMetrics
        ? ''
        : formatQuoteMoneyTotal(row.amount, quoteType)
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
  const unitPriceCell = showUnitTotal
    ? `<td style="padding:8px 12px;text-align:right;white-space:nowrap;${cellBg}${cellBorder}font-size:13px;color:#475569;">${unitPrice}</td>`
    : ''
  const productionQtyCell = showProductionQty
    ? `<td style="padding:8px 12px;text-align:center;white-space:nowrap;${cellBg}${cellBorder}font-size:13px;color:#475569;">${productionQty}</td>`
    : ''

  return `<tr class="${rowClass}" style="border-top:${borderTop};">
    ${boardCell}
    <td class="breakdown-col-item" style="padding:8px 12px;${indent}${labelStyle}${cellBg}${cellBorder}">${escapeHtml(row.label)}${descriptionHtml}</td>
    <td style="padding:8px 12px;text-align:${firstMetricAlign};${cellBg}${cellBorder}font-size:13px;color:#475569;">${firstMetric}</td>
    <td style="padding:8px 12px;text-align:${secondMetricAlign};white-space:nowrap;${cellBg}${cellBorder}font-size:13px;color:#475569;">${secondMetric}</td>
    ${unitPriceCell}
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
    labelType?: QuoteLabelType
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
  const secondMetricHeader = isPostSection ? labels.colPostRate : qtyHeader
  const secondMetricHeaderAlign = isPostSection ? 'right' : 'center'
  const tableClass =
    variant === 'board-summary'
      ? 'quote-table line-items-table board-summary-table'
      : 'quote-table line-items-table'
  const boardHeader = showBoardColumn ? `<th class="breakdown-col-board">${breakdownBoardColLabel(labelType)}</th>` : ''
  const unitTotalHeader = `<th style="text-align:right;">${labels.colUnitTotal}</th>`
  const productionQtyHeader = showProductionQty
    ? `<th style="text-align:center;">${labels.colProductionQty}</th>`
    : ''
  const tableHead = `<thead>
      <tr>
        ${boardHeader}
        <th>${labels.colItem}</th>
        <th>${firstMetricHeader}</th>
        <th style="text-align:${secondMetricHeaderAlign};">${secondMetricHeader}</th>
        ${unitTotalHeader}
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
          showUnitTotal: true,
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
            showUnitTotal: true,
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
  labelType: QuoteLabelType = quoteType,
  qty = 1,
) {
  if (!rows.length) return ''

  const tableRows = prepareBreakdownSectionTableRows(rows, sectionKey, quoteType, qty, labelType)

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
) {
  const qty = estimate.qty || 1
  const page1Amounts = domesticPage1SummaryAmounts(estimate.values.grandTotal, qty)
  const page1Domestic = quote.quoteType === 'domestic' ? page1Amounts : null
  const unitPriceText = formatQuoteKrw(page1Amounts.unitKrw)
  const totalText = formatQuoteKrw(page1Amounts.totalKrw)
  const labelType = pdfLabelType(quote, language)
  const lang = pdfLang(quote, language)
  const labels = getPreviewLabels(labelType)
  const qtyText = labels.formatQty(qty)
  const productName = quote.productName?.trim() || '-'
  const includeVat = quote.detailInfo.settings?.includeVat === true
  const sectionTitle = pdfText(lang, '견적 금액', 'Quote Amount', '报价金额')
  const unitPriceLabel = includeVat
    ? pdfText(lang, '단가 (VAT 포함)', 'Unit Price (incl. VAT)', '单价 (含增值税)')
    : pdfText(lang, '단가', 'Unit Price', '单价')
  const qtyColLabel = pdfText(lang, '개수', 'Qty', '数量')
  const totalLabel = includeVat
    ? pdfText(lang, '총 합계 (VAT 포함)', 'Total (incl. VAT)', '合计 (含增值税)')
    : pdfText(lang, '총 합계', 'Total', '合计')
  const productColLabel = pdfText(lang, '제품명', 'Product', '产品名')
  const supplyLabel = pdfText(lang, '공급가액', 'Supply Amount', '供应金额')
  const vatLabel = pdfText(lang, '부가세 (10%)', 'VAT (10%)', '增值税 (10%)')
  const grandLabel = includeVat
    ? pdfText(lang, '최종 합계 금액 (VAT 포함)', 'Grand Total (incl. VAT)', '最终合计 (含增值税)')
    : pdfText(lang, '최종 합계 금액', 'Grand Total', '最终合计')
  const note = includeVat
    ? pdfText(
        lang,
        '※ 기본 단가 안내와 공정별 세부 산정내역은 다음 페이지를 참고해 주세요. 표기 단가·합계는 VAT 포함이며, 부가세는 공급가액의 10%입니다.',
        '※ See the following pages for the base unit price guide and detailed process breakdown. Listed unit prices and totals include VAT (10% of supply amount).',
        '※ 基本单价说明与各工序明细请参见后续页面。所示单价与合计含增值税，增值税为供应金额的10%。',
      )
    : pdfText(
        lang,
        '※ 기본 단가 안내와 공정별 세부 산정내역은 다음 페이지를 참고해 주세요.',
        '※ See the following pages for the base unit price guide and detailed process breakdown.',
        '※ 基本单价说明与各工序明细请参见后续页面。',
      )

  let displayUnitText = unitPriceText
  let displayTotalText = totalText
  let supplyText = totalText
  let vatText = ''
  let grandText = totalText
  let vatBreakdownHtml = ''

  if (includeVat && page1Domestic != null) {
    const unitIncl = domesticVatBreakdown(page1Domestic.unitKrw).totalIncl
    const totalIncl = unitIncl * qty
    const vatAmount = Math.max(0, totalIncl - page1Domestic.totalKrw)
    displayUnitText = formatQuoteKrw(unitIncl)
    displayTotalText = formatQuoteKrw(totalIncl)
    supplyText = formatQuoteKrw(page1Domestic.totalKrw)
    vatText = formatQuoteKrw(vatAmount)
    grandText = displayTotalText
    vatBreakdownHtml = `<div class="summary-vat-breakdown">
      <div class="summary-vat-row">
        <span>${supplyLabel}</span>
        <span>${supplyText}</span>
      </div>
      <div class="summary-vat-row">
        <span>${vatLabel}</span>
        <span>${vatText}</span>
      </div>
    </div>`
  }

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
          <td>${displayUnitText}</td>
          <td>${escapeHtml(qtyText)}</td>
          <td class="summary-row-total">${displayTotalText}</td>
        </tr>
      </tbody>
    </table>
    ${vatBreakdownHtml}
    <div class="summary-grand-total">
      <span class="summary-grand-label">${grandLabel}</span>
      <strong class="summary-grand-value">${grandText}</strong>
    </div>
    <p class="summary-note">${note}</p>
  </div>`
}

type UnitPriceExplainRow = {
  label: string
  amount: string
  unit: string
  hint: string
}

function buildUnitPriceExplainSectionHtml(input: {
  title: string
  intro: string
  rows: UnitPriceExplainRow[]
  total?: { label: string; amount: string }
  labels: { item: string; amount: string; unit: string; desc: string }
}) {
  const { title, intro, rows, total, labels } = input
  return `<div class="unit-price-section">
    <h3 class="unit-price-section-title">${escapeHtml(title)}</h3>
    <p class="unit-price-section-intro">${escapeHtml(intro)}</p>
    <table class="quote-table unit-price-table">
      <thead>
        <tr>
          <th>${labels.item}</th>
          <th>${labels.amount}</th>
          <th>${labels.unit}</th>
          <th>${labels.desc}</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `<tr>
          <td class="unit-price-item">${escapeHtml(row.label)}</td>
          <td class="unit-price-amount">${escapeHtml(row.amount)}</td>
          <td class="unit-price-unit">${escapeHtml(row.unit)}</td>
          <td class="unit-price-desc">${escapeHtml(row.hint)}</td>
        </tr>`,
          )
          .join('')}
        ${
          total
            ? `<tr class="unit-price-total-row">
          <td class="unit-price-item">${escapeHtml(total.label)}</td>
          <td class="unit-price-amount">${escapeHtml(total.amount)}</td>
          <td class="unit-price-unit"></td>
          <td class="unit-price-desc"></td>
        </tr>`
            : ''
        }
      </tbody>
    </table>
  </div>`
}

function buildUnitPriceExplanationHtml(
  quote: QuoteListItem,
  language?: QuoteDocumentLanguage,
) {
  const lang = pdfLang(quote, language)
  const quoteType = quote.quoteType
  const smtRates = getSmtUnitRates(quoteType)
  const setupRate = getSmtSetupRate(quoteType)
  const setupPerPart = getSmtSetupMinutesPerPart(quoteType)
  const setupBaseSingle = getSmtSetupBaseMinutes('single', quoteType)
  const setupBaseDouble = getSmtSetupBaseMinutes('double', quoteType)
  const postRate = getPostRate(quoteType)

  const tableLabels = {
    item: pdfText(lang, '항목', 'Item', '项目'),
    amount: pdfText(lang, '단가', 'Rate', '单价'),
    unit: pdfText(lang, '단위', 'Unit', '单位'),
    desc: pdfText(lang, '설명', 'Description', '说明'),
  }

  const perPc = pdfText(lang, '/개', '/pc', '/个')
  const perMin = pdfText(lang, '/분', '/min', '/分钟')
  const minUnit = pdfText(lang, '분', 'min', '分钟')

  const intro = pdfText(
    lang,
    '아래는 본 견적에 적용되는 기본 단가 기준입니다. 제품별 수량·작업시간에 단가를 곱해 견적 금액이 산정됩니다.',
    'These are the base unit rates applied to this quotation. Quote amounts are calculated by multiplying quantities and work time by the rates below.',
    '以下为本报价适用的基本单价标准。按产品数量、作业时间乘以单价计算报价金额。',
  )

  const smtSection = buildUnitPriceExplainSectionHtml({
    title: pdfText(lang, '1. SMD 실장 단가', '1. SMD Placement Rates', '1. SMD贴装单价'),
    intro: pdfText(
      lang,
      '부품 종류별 실장 단가입니다. CHIP·이형·특수/모듈은 개당, IC는 PIN당, BGA는 BALL당으로 산정합니다.',
      'Placement rates by part type. CHIP / odd / special are per piece, IC per PIN, and BGA per BALL.',
      '按部品类型的贴装单价。CHIP·异形·特殊/模块按个、IC按PIN、BGA按BALL计算。',
    ),
    labels: tableLabels,
    rows: [
      {
        label: 'CHIP',
        amount: formatQuoteKrwRate(smtRates.chip),
        unit: perPc,
        hint: pdfText(lang, '일반 CHIP 부품 실장', 'Standard chip placement', '普通CHIP部品贴装'),
      },
      {
        label: pdfText(lang, '이형', 'Odd-form', '异形'),
        amount: formatQuoteKrwRate(smtRates.odd),
        unit: perPc,
        hint: pdfText(lang, '이형 부품 실장', 'Odd-form / irregular parts', '异形部品贴装'),
      },
      {
        label: pdfText(lang, '특수/모듈', 'Special / Module', '特殊/模块'),
        amount: formatQuoteKrwRate(smtRates.special),
        unit: perPc,
        hint: pdfText(lang, '특수 부품·모듈 실장', 'Special parts and modules', '特殊部品·模块贴装'),
      },
      {
        label: 'IC PIN',
        amount: formatQuoteKrwRate(smtRates.icPin),
        unit: pdfText(lang, '/PIN', '/PIN', '/PIN'),
        hint: pdfText(lang, 'IC 핀 수 기준 실장', 'IC placement by pin count', '按IC引脚数贴装'),
      },
      {
        label: 'BGA BALL',
        amount: formatQuoteKrwRate(smtRates.bgaBall),
        unit: pdfText(lang, '/BALL', '/BALL', '/BALL'),
        hint: pdfText(lang, 'BGA 볼 수 기준 실장', 'BGA placement by ball count', '按BGA球数贴装'),
      },
      {
        label: 'AOI',
        amount: formatQuoteKrw(AOI_UNIT),
        unit: pdfText(lang, '/면', '/side', '/面'),
        hint: pdfText(
          lang,
          '자동 광학 검사 (양면은 2배)',
          'Automated optical inspection (×2 for double-sided)',
          '自动光学检查 (双面为2倍)',
        ),
      },
    ],
  })

  const setupSection = buildUnitPriceExplainSectionHtml({
    title: pdfText(lang, '2. SET-UP 단가', '2. SET-UP Rates', '2. SET-UP单价'),
    intro: pdfText(
      lang,
      '프로그램·세팅 등 생산 준비 비용입니다. 장비 임률(분당) × 소요 시간으로 산정합니다.',
      'Production preparation (program/setting). Calculated as equipment rate per minute × required time.',
      '程序·调试等生产准备费用。按设备费率(每分钟) × 所需时间计算。',
    ),
    labels: tableLabels,
    rows: [
      {
        label: pdfText(lang, '장비 임률', 'Equipment Rate', '设备费率'),
        amount: formatQuoteKrw(setupRate),
        unit: perMin,
        hint: pdfText(
          lang,
          'SET-UP 작업 분당 임률',
          'SET-UP labor/equipment rate per minute',
          'SET-UP作业每分钟费率',
        ),
      },
      {
        label: pdfText(lang, '기본시간 (단면)', 'Base Time (Single)', '基本时间 (单面)'),
        amount: String(setupBaseSingle),
        unit: minUnit,
        hint: pdfText(
          lang,
          SMT_SETUP_BASE_TIME_DESCRIPTION,
          'Loader/Unloader · Screen Print & SPI · Reflow profile',
          'Loader/Unloader · Screen Print & SPI · Reflow Profile 测定',
        ),
      },
      {
        label: pdfText(lang, '기본시간 (양면)', 'Base Time (Double)', '基本时间 (双面)'),
        amount: String(setupBaseDouble),
        unit: minUnit,
        hint: pdfText(
          lang,
          '양면·듀얼 PCB 기본 준비시간',
          'Base preparation time for double-sided / dual PCB',
          '双面·Dual PCB基本准备时间',
        ),
      },
      {
        label: pdfText(lang, '초품검사', 'First Article', '首件检查'),
        amount: String(SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART),
        unit: pdfText(lang, '초/종', 'sec/type', '秒/种'),
        hint: pdfText(
          lang,
          SMT_SETUP_FIRST_ARTICLE_DESCRIPTION,
          'BOM placement check and LCR measurement',
          'BOM贴装确认及LCR测定',
        ),
      },
      {
        label: 'SETTING',
        amount: String(setupPerPart),
        unit: pdfText(lang, '분/종', 'min/type', '分钟/种'),
        hint: pdfText(
          lang,
          SMT_SETUP_SETTING_DESCRIPTION,
          'Feeder setup and coordinate verification',
          '供料器安装及坐标确认',
        ),
      },
    ],
  })

  const solderingSection = buildUnitPriceExplainSectionHtml({
    title: pdfText(lang, '3. 납땜(SOLDERING) 단가', '3. Soldering Rates', '3. 焊接(SOLDERING)单价'),
    intro: pdfText(
      lang,
      '수납땜·웨이브 납땜 단가입니다. 부품 유형·작업 방식에 따라 개당(또는 PIN당)으로 산정합니다.',
      'Manual and wave soldering rates by part/process type.',
      '手工焊·波峰焊单价。按部品类型·作业方式以个(或PIN)计算。',
    ),
    labels: tableLabels,
    rows: [
      {
        label: pdfText(lang, '수납땜 소형', 'Hand Solder (Small)', '手工焊小型'),
        amount: formatQuoteKrw(DIP_UNIT.dipGeneral),
        unit: perPc,
        hint: pdfText(lang, '1~3 PIN 소형 부품', 'Small parts (1–3 PIN)', '1~3 PIN小型部品'),
      },
      {
        label: pdfText(lang, '수납땜 커넥터', 'Hand Solder (Connector)', '手工焊连接器'),
        amount: formatQuoteKrw(DIP_UNIT.dipConnector),
        unit: perPc,
        hint: pdfText(lang, '커넥터 수납땜', 'Connector hand soldering', '连接器手工焊'),
      },
      {
        label: pdfText(lang, '수납땜 와이어', 'Hand Solder (Wire)', '手工焊线材'),
        amount: formatQuoteKrw(DIP_UNIT.dipWire),
        unit: perPc,
        hint: pdfText(lang, '와이어 수납땜', 'Wire hand soldering', '线材手工焊'),
      },
      {
        label: pdfText(lang, '웨이브 소형', 'Wave (Small)', '波峰小型'),
        amount: formatQuoteKrw(DIP_UNIT.waveGeneral),
        unit: perPc,
        hint: pdfText(lang, '웨이브 솔더 소형 부품', 'Wave soldering for small parts', '波峰焊小型部品'),
      },
      {
        label: pdfText(lang, '웨이브 커넥터', 'Wave (Connector)', '波峰连接器'),
        amount: formatQuoteKrw(DIP_UNIT.waveConnector),
        unit: perPc,
        hint: pdfText(lang, '웨이브 솔더 커넥터', 'Wave soldering for connectors', '波峰焊连接器'),
      },
      {
        label: pdfText(lang, '웨이브 와이어', 'Wave (Wire)', '波峰线材'),
        amount: formatQuoteKrw(DIP_UNIT.waveWire),
        unit: perPc,
        hint: pdfText(lang, '웨이브 솔더 와이어', 'Wave soldering for wires', '波峰焊线材'),
      },
    ],
  })

  const postSection = buildUnitPriceExplainSectionHtml({
    title: pdfText(lang, '4. 후공정 분당임률', '4. Post-Process Rate / Minute', '4. 后工序每分钟费率'),
    intro: pdfText(
      lang,
      '조립·다운로드·테스트·포장 등 후공정 작업시간은 아래 분당임률로 산정합니다.',
      'Assembly, download, test, packing and other post-process work time uses the per-minute rate below.',
      '组装·下载·测试·包装等后工序作业时间按以下每分钟费率计算。',
    ),
    labels: tableLabels,
    rows: [
      {
        label: pdfText(lang, '직접노무비', 'Direct Labor', '直接人工费'),
        amount: formatQuoteKrw(POST_RATE_DIRECT_LABOR),
        unit: perMin,
        hint: pdfText(
          lang,
          '후공정 작업 직접 인건비',
          'Direct labor for post-process work',
          '后工序作业直接人工费',
        ),
      },
      {
        label: pdfText(lang, '제조간접비', 'Manufacturing Overhead', '制造间接费'),
        amount: formatQuoteKrw(POST_RATE_OVERHEAD),
        unit: perMin,
        hint: pdfText(
          lang,
          '설비·유틸리티·현장 지원',
          'Equipment, utilities, and shop support',
          '设备·公用工程·现场支援',
        ),
      },
      {
        label: pdfText(lang, '기업이윤', 'Corporate Profit', '企业利润'),
        amount: formatQuoteKrw(POST_RATE_CORPORATE_PROFIT),
        unit: perMin,
        hint: pdfText(
          lang,
          '지속 가능한 운영을 위한 최소 이윤',
          'Minimum sustainable operating margin',
          '可持续经营所需最低利润',
        ),
      },
      {
        label: pdfText(lang, '일반관리비', 'General & Administrative', '一般管理费'),
        amount: formatQuoteKrw(POST_RATE_ADMIN),
        unit: perMin,
        hint: pdfText(
          lang,
          '영업·관리·품질 지원',
          'Sales, admin, and quality support',
          '营业·管理·品质支援',
        ),
      },
    ],
    total: {
      label: pdfText(lang, '합계 (분당임률)', 'Total (Rate / Minute)', '合计 (每分钟费率)'),
      amount: formatQuoteKrw(postRate),
    },
  })

  const footer = pdfText(
    lang,
    '※ 제품별 적용 수량·시간·합계는 다음 페이지의 공정별 세부 산정내역을 참고해 주세요.',
    '※ See the next page for the detailed process breakdown by product quantity and work time.',
    '※ 各产品适用数量·时间·合计请参见下一页各工序明细。',
  )

  return `<div class="unit-price-explain">
    <p class="unit-price-explain-note">${escapeHtml(intro)}</p>
    <div class="unit-price-grid">
      ${smtSection}
      ${setupSection}
      ${solderingSection}
      ${postSection}
    </div>
    <p class="unit-price-footer">${footer}</p>
  </div>`
}

function buildQuoteDetailPage(quote: QuoteListItem, language?: QuoteDocumentLanguage) {
  const { estimate } = buildQuotePreviewData(quote, { labelLanguage: language })
  const lang = pdfLang(quote, language)
  const title = pdfText(lang, '기본 단가 안내', 'Base Unit Price Guide', '基本单价说明')
  const note = pdfText(
    lang,
    'SMD · SET-UP · 납땜 · 후공정 기본 단가 구성입니다.',
    'Base unit rates for SMD, SET-UP, soldering, and post-process.',
    'SMD · SET-UP · 焊接 · 后工序基本单价构成。',
  )

  return `<section class="quote-page quote-page-detail">
    <div class="quote-card">
      ${buildSectionPageHeaderHtml(quote, estimate, title, note)}
      ${buildUnitPriceExplanationHtml(quote, language)}
    </div>
  </section>`
}

function buildQuoteDetailedBreakdownPage(quote: QuoteListItem, language?: QuoteDocumentLanguage) {
  const { estimate, pdfBreakdownRows, labelType } = buildQuotePreviewData(quote, {
    labelLanguage: language,
  })
  const labels = getPreviewLabels(labelType)
  const smtRows = filterPdfBreakdownRows(pdfBreakdownRows, 'smt', quote.quoteType)
  const setupRows = filterPdfBreakdownRows(pdfBreakdownRows, 'setup', quote.quoteType)
  const dipRows = filterPdfBreakdownRows(pdfBreakdownRows, 'dip', quote.quoteType)
  const postRows = filterPdfBreakdownRows(pdfBreakdownRows, 'post', quote.quoteType)
  const materialRows = filterPdfBreakdownRows(pdfBreakdownRows, 'material', quote.quoteType)
  if (
    !smtRows.length &&
    !setupRows.length &&
    !dipRows.length &&
    !postRows.length &&
    !materialRows.length
  ) {
    return ''
  }

  const lang = resolvePdfLanguage(quote.quoteType, language)
  const pageTitle = pdfText(lang, '공정별 세부 산정내역', 'Detailed Breakdown by Process', '各工序明细')
  const pageNote = pdfText(
    lang,
    'SMD(SET-UP·실장·검사)·납땜·후공정·자재 항목별 단가·수량 기준 산정식입니다.',
    'Itemized calculation for SMD (SET-UP, placement, inspection), soldering, post-process, and materials.',
    'SMD(SET-UP·贴装·检查)·焊接·后工序·材料各项单价·数量计算式。',
  )
  const solderingTitle = labels.soldering
  const postTitle = pdfSummarySectionLabel(labels.postProcess, labelType)
  const materialTitle = pdfSummarySectionLabel(labels.materials, labelType)

  return `<section class="quote-page quote-page-breakdown">
    <div class="quote-card">
      ${buildSectionPageHeaderHtml(quote, estimate, pageTitle, pageNote)}
      <div class="breakdown-sections">
        ${buildBreakdownSectionHtml('SET-UP', setupRows, quote.quoteType, 'setup', 'breakdown-section-separated', labelType, estimate.qty || 1)}
        ${buildBreakdownSectionHtml(breakdownSmtSectionTitle(labelType), smtRows, quote.quoteType, 'smt', 'breakdown-section-smt', labelType, estimate.qty || 1)}
        ${buildBreakdownSectionHtml(solderingTitle, dipRows, quote.quoteType, 'dip', 'breakdown-section-separated', labelType, estimate.qty || 1)}
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
  const primaryQuoteType = quotes[0]?.quoteType ?? 'domestic'
  const docLang = resolvePdfLanguage(primaryQuoteType, language)
  const printHint = pdfText(
    docLang,
    '인쇄 설정에서 「머리글 및 바닥글」 체크를 해제한 뒤 「PDF로 저장」을 선택하세요.',
    'In the print dialog: turn off “Headers and footers”, then choose “Save as PDF”.',
    '请在打印设置中取消勾选「页眉和页脚」，然后选择「另存为PDF」。',
  )
  const printButton = pdfText(docLang, 'PDF로 저장', 'Save as PDF', '另存为PDF')
  const fontStack =
    docLang === 'zh'
      ? '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif'
      : '"Malgun Gothic", "Apple SD Gothic Neo", "Microsoft YaHei", sans-serif'

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
    .unit-price-explain {
      margin-top: 8px;
    }
    .unit-price-explain-note {
      margin: 0 0 14px;
      font-size: 12px;
      line-height: 1.5;
      color: #475569;
    }
    .unit-price-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto auto;
      gap: 14px;
      align-items: stretch;
    }
    .unit-price-section {
      margin: 0;
      padding: 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #f8fafc;
      min-width: 0;
    }
    .unit-price-section-title {
      margin: 0 0 4px;
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    .unit-price-section-intro {
      margin: 0 0 8px;
      font-size: 10px;
      line-height: 1.4;
      color: #64748b;
    }
    .unit-price-table {
      width: 100%;
      margin: 0;
      background: #fff;
    }
    .unit-price-table th,
    .unit-price-table td {
      padding: 5px 6px;
      font-size: 10px;
    }
    .unit-price-table th:nth-child(2),
    .unit-price-table th:nth-child(3),
    .unit-price-amount,
    .unit-price-unit {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .unit-price-amount {
      font-weight: 700;
    }
    .unit-price-unit {
      color: #64748b;
      font-weight: 600;
    }
    .unit-price-item {
      font-weight: 700;
      color: #0f172a;
    }
    .unit-price-desc {
      color: #64748b;
      word-break: keep-all;
    }
    .unit-price-total-row td {
      background: #e2e8f0 !important;
      font-weight: 800;
      border-top: 1px solid #94a3b8;
    }
    .unit-price-footer {
      margin: 12px 0 0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
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
