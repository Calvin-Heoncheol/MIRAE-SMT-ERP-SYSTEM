import { getPostRate } from './constants'
import {
  breakdownSmdGroupTitle,
  breakdownSmtPlacementSubtitle,
  breakdownSmtSectionTitle,
  getPreviewLabels,
  resolvePdfLanguage,
  type QuoteDocumentLanguage,
  type QuoteLabelType,
} from './preview-i18n'
import {
  breakdownBoardColLabel,
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
  type PreviewRow,
  type PreviewSection,
} from './preview-rows'
import type { QuoteListItem, QuoteType } from './types'
import { escapeHtml } from '@/lib/print/escape-html'
import { getActivePdfCurrency, pdfMoney, pdfText } from './export-quote-pdf-shared'

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
    hideUnit?: boolean
  } = {},
) {
  const {
    showBoardColumn = false,
    showProductionQty = false,
    showUnitTotal = false,
    boardRowSpan,
    boardGroupStart = false,
    hideUnit = false,
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
          : formatPreviewRowUnit(row, quoteType, getActivePdfCurrency())
  const unitAlign = row.unitLabel ? 'left' : 'right'
  const count =
    isBoardSubtotal && !showBoardSubtotalMetrics
      ? ''
      : row.count != null
        ? escapeHtml(String(row.count))
        : showBoardSubtotalMetrics
          ? ''
          : '-'
  const metricStyle = 'font-size:13px;color:#475569;'
  const countStyle = row.countEmphasize ? 'font-size:13px;font-weight:700;color:#0f172a;' : metricStyle
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
        : pdfMoney(row.unitPrice)
  const amount =
    row.amount == null
      ? isBoardSubtotal && !showBoardSubtotalMetrics
        ? ''
        : '-'
      : isBoardSubtotal && !showBoardSubtotalMetrics
        ? ''
        : pdfMoney(row.amount)
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
  const unitCell = hideUnit
    ? ''
    : `<td style="padding:8px 12px;text-align:${unitAlign};${cellBg}${cellBorder}${metricStyle}">${unit}</td>`
  const unitPriceCell = showUnitTotal
    ? `<td style="padding:8px 12px;text-align:right;white-space:nowrap;${cellBg}${cellBorder}font-size:13px;color:#475569;">${unitPrice}</td>`
    : ''
  const productionQtyCell = showProductionQty
    ? `<td style="padding:8px 12px;text-align:center;white-space:nowrap;${cellBg}${cellBorder}font-size:13px;color:#475569;">${productionQty}</td>`
    : ''

  return `<tr class="${rowClass}" style="border-top:${borderTop};">
    ${boardCell}
    <td class="breakdown-col-item" style="padding:8px 12px;${indent}${labelStyle}${cellBg}${cellBorder}">${escapeHtml(row.label)}${descriptionHtml}</td>
    ${unitCell}
    <td style="padding:8px 12px;text-align:center;white-space:nowrap;${cellBg}${cellBorder}${countStyle}">${count}</td>
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
  const isSmdSection = sectionKey === 'smt'
  const isPostSection = sectionKey === 'post'
  const hideUnit = isPostSection || sectionKey === 'dip'
  const showProductionQty = false
  const unitHeader = isSetupSection
    ? labels.colSetupBasis
    : isSmdSection
      ? labels.colSmdBaseRate
      : labels.colUnit
  const qtyHeader = isSetupSection
    ? labels.colSetupMinutes
    : isSmdSection
      ? labels.colSmdWorkQty
      : isPostSection
        ? labels.colPostWorkQty
        : labels.colQty
  const unitHeaderCell = hideUnit ? '' : `<th>${unitHeader}</th>`
  const tableClass =
    variant === 'board-summary'
      ? 'quote-table line-items-table board-summary-table'
      : 'quote-table line-items-table'
  const boardHeader = showBoardColumn ? `<th class="breakdown-col-board">${breakdownBoardColLabel(labelType)}</th>` : ''
  const unitTotalHeader = `<th style="text-align:right;">${
    isSmdSection || isPostSection || isSetupSection ? labels.colSmdUnitPrice : labels.colUnitTotal
  }</th>`
  const productionQtyHeader = showProductionQty
    ? `<th style="text-align:center;">${labels.colProductionQty}</th>`
    : ''
  const tableHead = `<thead>
      <tr>
        ${boardHeader}
        <th>${labels.colItem}</th>
        ${unitHeaderCell}
        <th style="text-align:center;">${qtyHeader}</th>
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
          hideUnit,
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
            hideUnit,
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
  const titleNoteHtml =
    sectionKey === 'post'
      ? ` <span style="font-weight:600;color:#64748b;">(${escapeHtml(
          getPreviewLabels(labelType).postRateNote(pdfMoney(getPostRate(quoteType))),
        )})</span>`
      : ''

  return `<div class="breakdown-section ${sectionClass} ${modifier}">
    <div class="breakdown-section-inner">
      <h3 class="breakdown-section-title">${escapeHtml(title)}${titleNoteHtml}</h3>
      ${buildQuoteBreakdownTableHtml(tableRows, quoteType, {
        continuous: true,
        showBoardColumn,
        labelType,
        sectionKey,
      })}
    </div>
  </div>`
}

function buildBreakdownSubsectionHtml(
  subtitle: string,
  rows: PreviewRow[],
  quoteType: QuoteType,
  sectionKey: PreviewSection,
  labelType: QuoteLabelType,
  qty: number,
) {
  if (!rows.length) return ''
  const tableRows = prepareBreakdownSectionTableRows(rows, sectionKey, quoteType, qty, labelType)
  return `<div class="breakdown-subsection breakdown-section-${sectionKey}">
      <h4 class="breakdown-subsection-title">${escapeHtml(subtitle)}</h4>
      ${buildQuoteBreakdownTableHtml(tableRows, quoteType, {
        continuous: true,
        showBoardColumn: tableRows.some((row) => row.boardName),
        labelType,
        sectionKey,
      })}
    </div>`
}

/** SMD 묶음 — SET-UP(발주 1회) + 실장·검사 */
function buildSmdBreakdownSectionHtml(
  setupRows: PreviewRow[],
  smtRows: PreviewRow[],
  quoteType: QuoteType,
  labelType: QuoteLabelType,
  qty: number,
) {
  if (!setupRows.length) {
    return buildBreakdownSectionHtml(
      breakdownSmtSectionTitle(labelType),
      smtRows,
      quoteType,
      'smt',
      'breakdown-section-smt',
      labelType,
      qty,
    )
  }

  return `<div class="breakdown-section breakdown-section-smt">
    <div class="breakdown-section-inner">
      <h3 class="breakdown-section-title">${escapeHtml(breakdownSmdGroupTitle(labelType))}</h3>
      ${buildBreakdownSubsectionHtml('SET-UP', setupRows, quoteType, 'setup', labelType, qty)}
      ${buildBreakdownSubsectionHtml(breakdownSmtPlacementSubtitle(labelType), smtRows, quoteType, 'smt', labelType, qty)}
    </div>
  </div>`
}

export function buildQuoteDetailedBreakdownPage(quote: QuoteListItem, language?: QuoteDocumentLanguage) {
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
        ${buildSmdBreakdownSectionHtml(setupRows, smtRows, quote.quoteType, labelType, estimate.qty || 1)}
        ${buildBreakdownSectionHtml(solderingTitle, dipRows, quote.quoteType, 'dip', 'breakdown-section-separated', labelType, estimate.qty || 1)}
        ${buildBreakdownSectionHtml(postTitle, postRows, quote.quoteType, 'post', 'breakdown-section-separated', labelType, estimate.qty || 1)}
        ${buildBreakdownSectionHtml(materialTitle, materialRows, quote.quoteType, 'material', 'breakdown-section-separated', labelType, estimate.qty || 1)}
      </div>
    </div>
  </section>`
}
