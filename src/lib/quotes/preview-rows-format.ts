import { formatQuoteMoneyRateByDisplay, roundDomesticKrw } from './format'
import { breakdownSmtSectionTitle, getPreviewLabels, type QuoteLabelType } from './preview-i18n'
import { roundPostProcessMinutes, type PostProcessCategory } from './post-process-lines'
import type { QuoteDisplayCurrency, QuoteType } from './types'

export function quotePerUnitTotal(total: number, qty: number) {
  return total / (qty || 1)
}

export function pdfSummarySectionLabel(label: string, labelType: QuoteLabelType) {
  return labelType === 'export' ? label.toUpperCase() : label
}

export type PreviewSection = 'smt' | 'setup' | 'dip' | 'post' | 'material' | 'other'

export type PreviewRow = {
  label: string
  description?: string
  unit?: number | null
  unitLabel?: string
  /** 후공정 등 — 대당 단가 (분당 임률과 구분) */
  unitPrice?: number | null
  count?: number | string | null
  /** SMD·후공정 세부 행 — 생산수량 표시용 */
  productionQty?: number | string | null
  /** 발주 1회 고정 비용 — 생산수량으로 곱하지 않음 */
  orderLevel?: boolean
  /** 대당 단가 표시 안 함 (메탈마스크 등) — 합계에서도 대당 계산 제외 */
  noUnitPrice?: boolean
  amount?: number | null
  indent?: number
  emphasize?: boolean
  amountEmphasize?: boolean
  /** true면 수량·시간 칸 굵게 */
  countEmphasize?: boolean
  sectionTotal?: PreviewSection
  boardTotal?: boolean
  boardSubtotal?: boolean
  boardName?: string
  sectionFooter?: PreviewSection
}

export type PreviewPostProcessLine = {
  name: string
  seconds?: number | string
  minutes?: number | string
}

export type PreviewFormFields = {
  postAssembly: string | number
  postDownload?: string | number
  postTest: string | number
  postPacking: string | number
  materialCost: string | number
  metalMaskCost?: string | number
  productionKind?: '샘플' | '양산'
  /** true = VAT 포함 표시 */
  includeVat?: boolean
  /** false = 자재 섹션 제외 (신규). 미설정/true = 포함 */
  includeMaterialCosts?: boolean
  includeMetalMask?: boolean
  /** 후공정 시간 여유 % */
  timeBufferPercent?: number | string
  /** 조립·다운로드·테스트·포장 표시 순서 */
  postProcessOrder?: PostProcessCategory[]
  /** @deprecated 카테고리별 배열 사용 */
  postProcessLines?: PreviewPostProcessLine[]
  assemblyLines?: PreviewPostProcessLine[]
  downloadLines?: PreviewPostProcessLine[]
  testLines?: PreviewPostProcessLine[]
  packingLines?: PreviewPostProcessLine[]
}

export const SECTION_TOTAL_ROW_BG = '#cbd5e1'
export const BOARD_SUBTOTAL_ROW_BG = '#e2e8f0'

export type PdfSectionColor = {
  bg: string
  line: string
  accent: string
}

export const PDF_SECTION_COLORS: Record<PreviewSection, PdfSectionColor> = {
  smt: { bg: '#dbeafe', line: '#93c5fd', accent: '#2563eb' },
  setup: { bg: '#e0f2fe', line: '#7dd3fc', accent: '#0284c7' },
  dip: { bg: '#ffedd5', line: '#fdba74', accent: '#ea580c' },
  post: { bg: '#dcfce7', line: '#86efac', accent: '#16a34a' },
  material: { bg: '#ede9fe', line: '#c4b5fd', accent: '#7c3aed' },
  other: { bg: '#fef3c7', line: '#fcd34d', accent: '#d97706' },
}

export function formatPreviewRowUnit(
  row: PreviewRow,
  quoteType: QuoteType,
  displayCurrency: QuoteDisplayCurrency = 'krw',
) {
  if (row.unitLabel) return row.unitLabel
  if (row.unit != null) return formatQuoteMoneyRateByDisplay(row.unit, quoteType, displayCurrency)
  return '-'
}

export function formatPreviewRowDescription(row: PreviewRow) {
  return row.description?.trim() || ''
}

export function isPreviewHighlightRow(row: PreviewRow) {
  return Boolean(row.boardTotal)
}

/** PDF 항목별 요약 — 섹션별 제품명·합계 */
export function isPdfBoardDetailSummaryRow(row: PreviewRow) {
  if (row.boardTotal) return true
  return row.sectionTotal === 'post' || row.sectionTotal === 'material' || row.sectionTotal === 'other'
}

export type PdfBreakdownSection = 'smt' | 'setup' | 'dip' | 'post' | 'material' | 'other'

export function filterPdfBreakdownRows(
  rows: PreviewRow[],
  section: PdfBreakdownSection,
  _quoteType: QuoteType,
): PreviewRow[] {
  const result: PreviewRow[] = []
  let active: PdfBreakdownSection | null = null

  for (const row of rows) {
    if (row.sectionTotal) {
      active = row.sectionTotal
      if (active === section) result.push(row)
      continue
    }
    if (active === section) result.push(row)
  }

  return result
}

export function breakdownBoardColLabel(labelType: QuoteLabelType) {
  if (labelType === 'zh') return '板卡'
  return labelType === 'domestic' ? '보드' : 'BOARD'
}

export function isBreakdownBoardGroupStart(rows: PreviewRow[], index: number) {
  const boardName = rows[index].boardName
  if (!boardName) return false
  if (index === 0) return true
  return rows[index - 1].boardName !== boardName
}

export function computeBreakdownBoardRowSpans(rows: PreviewRow[]) {
  const spans = new Array<number | undefined>(rows.length)

  for (let i = 0; i < rows.length; ) {
    const boardName = rows[i].boardName
    if (!boardName) {
      spans[i] = undefined
      i += 1
      continue
    }

    let j = i + 1
    while (j < rows.length && rows[j].boardName === boardName) j += 1

    spans[i] = j - i
    for (let k = i + 1; k < j; k += 1) spans[k] = 0
    i = j
  }

  return spans
}

export function prepareBreakdownSectionTableRows(
  rows: PreviewRow[],
  sectionKey: PreviewSection,
  quoteType: QuoteType,
  qty = 1,
  labelType: QuoteLabelType = quoteType,
): PreviewRow[] {
  const sectionTotalRow = rows.find((row) => row.sectionTotal)
  const detailRows = rows.filter((row) => !row.sectionTotal)
  const totalLabel =
    labelType === 'zh' ? '合计' : labelType === 'domestic' ? '합계' : 'Total'
  const tableRows = [...detailRows]

  if (sectionTotalRow) {
    const safeQty = qty || 1
    const noUnitPriceAmount = detailRows
      .filter((row) => row.noUnitPrice)
      .reduce((sum, row) => sum + (row.amount || 0), 0)
    const footerMetrics =
      noUnitPriceAmount > 0 && sectionTotalRow.amount != null
        ? {
            unitPrice: quotePerUnitTotal(
              Math.max(0, sectionTotalRow.amount - noUnitPriceAmount),
              qty,
            ),
          }
        : sectionKey === 'post'
        ? computePostSectionFooterMetrics(
            detailRows,
            quoteType,
            sectionTotalRow.amount ?? 0,
            qty,
            labelType,
          )
        : {
            unitPrice:
              sectionTotalRow.unitPrice ??
              (sectionTotalRow.amount != null
                ? quotePerUnitTotal(sectionTotalRow.amount, qty)
                : undefined),
          }

    /** 대당(원) 반올림 후 합계 = 대당 × 수량 — 표시 검산 일치 (발주 1회 고정은 합계 유지) */
    const rawUnit = footerMetrics.unitPrice
    const roundedUnit = rawUnit != null ? roundDomesticKrw(rawUnit) : undefined
    const footerAmount = sectionTotalRow.orderLevel
      ? sectionTotalRow.amount
      : roundedUnit != null
        ? roundedUnit * safeQty
        : sectionTotalRow.amount

    tableRows.push({
      ...sectionTotalRow,
      ...footerMetrics,
      unitPrice: roundedUnit,
      amount: footerAmount,
      label: totalLabel,
      indent: 0,
      emphasize: true,
      amountEmphasize: true,
      countEmphasize: sectionKey === 'post',
      boardSubtotal: false,
      sectionTotal: undefined,
      boardName: undefined,
      sectionFooter: sectionKey,
    })
  }

  return tableRows
}

function computePostSectionFooterMetrics(
  detailRows: PreviewRow[],
  quoteType: QuoteType,
  scaledSectionAmount: number,
  qty: number,
  labelType: QuoteLabelType = quoteType,
): Pick<PreviewRow, 'count' | 'unit' | 'unitPrice'> {
  const labels = getPreviewLabels(labelType)
  const safeQty = qty || 1
  let totalMinutes = 0

  for (const row of detailRows) {
    if (row.boardSubtotal) continue
    // 후공정 합계는 시간(분)만 — 납땜 핀/개수와 섞지 않음
    if (typeof row.count === 'number') continue
    const countStr = String(row.count ?? '')
    const minuteMatch = countStr.match(/^([\d.]+)\s*(?:분|分钟|min)/i)
    if (minuteMatch) totalMinutes += Number(minuteMatch[1])
  }

  const roundedMinutes = roundPostProcessMinutes(totalMinutes)
  const perUnitTotal = scaledSectionAmount / safeQty
  return {
    count: roundedMinutes > 0 ? labels.minutesCount(roundedMinutes) : undefined,
    unit: undefined,
    unitPrice: perUnitTotal > 0 ? perUnitTotal : undefined,
  }
}

export type BreakdownSectionPreview = {
  key: PreviewSection
  title: string
  rows: PreviewRow[]
}

export function buildProcessBreakdownSections(
  allRows: PreviewRow[],
  quoteType: QuoteType,
  qty = 1,
): BreakdownSectionPreview[] {
  const labels = getPreviewLabels(quoteType)
  const definitions: { key: PreviewSection; title: string }[] = [
    { key: 'setup', title: 'SET-UP' },
    { key: 'smt', title: breakdownSmtSectionTitle(quoteType) },
    { key: 'dip', title: labels.soldering },
    { key: 'post', title: pdfSummarySectionLabel(labels.postProcess, quoteType) },
    { key: 'material', title: pdfSummarySectionLabel(labels.materials, quoteType) },
  ]

  return definitions.flatMap(({ key, title }) => {
    const sectionRows = filterPdfBreakdownRows(allRows, key, quoteType)
    if (!sectionRows.length) return []
    return [{ key, title, rows: prepareBreakdownSectionTableRows(sectionRows, key, quoteType, qty) }]
  })
}
