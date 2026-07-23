import {
  DIP_UNIT,
  SMT_PLACEMENT_MIN_SCORE,
  getPostRate,
  getSmtPlacementMinFee,
  getSmtUnitRates,
} from './constants'
import {
  calculateEstimate,
  computeSmtPlacementScore,
  computeSmtSetupBillingBreakdown,
} from './calculate-estimate'
import { formatQuoteMoneyByDisplay, formatQuoteSetupMinutes } from './format'
import { getPreviewLabels } from './preview-i18n'
import type {
  DipBoardDetail,
  EstimateResult,
  PostProcessLine,
  QuoteDisplayCurrency,
  QuoteListItem,
  QuoteType,
  SmtBoardDetail,
} from './types'
import { toEstimateInputFromDetail } from './utils'

export type PreviewSection = 'smt' | 'setup' | 'dip' | 'post' | 'material'

export type PreviewRow = {
  label: string
  description?: string
  unit?: number | null
  unitLabel?: string
  count?: number | string | null
  amount?: number | null
  indent?: number
  emphasize?: boolean
  amountEmphasize?: boolean
  sectionTotal?: PreviewSection
  boardTotal?: boolean
  boardSubtotal?: boolean
  boardName?: string
  sectionFooter?: PreviewSection
}

export type PreviewPostProcessLine = {
  name: string
  minutes?: number | string
}

export type PreviewFormFields = {
  postAssembly: string | number
  postTest: string | number
  postPacking: string | number
  materialCost: string | number
  assemblyLines?: PreviewPostProcessLine[]
  testLines?: PreviewPostProcessLine[]
  packingLines?: PreviewPostProcessLine[]
}

export const SECTION_TOTAL_ROW_CLASS = 'bg-slate-300 border-t-2 border-slate-500'
export const SECTION_TOTAL_ROW_ACCENT_CLASS = 'border-l-4 border-slate-600'
export const SECTION_TOTAL_ROW_BG = '#cbd5e1'
export const BOARD_SUBTOTAL_ROW_CLASS = 'bg-slate-200'
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
}

export function formatPreviewRowUnit(
  row: PreviewRow,
  quoteType: QuoteType,
  displayCurrency: QuoteDisplayCurrency = 'usd',
) {
  if (row.unitLabel) return row.unitLabel
  if (row.unit != null) return formatQuoteMoneyByDisplay(row.unit, quoteType, displayCurrency)
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
  return row.sectionTotal === 'post' || row.sectionTotal === 'material'
}

export function filterPdfBoardDetailRows(rows: PreviewRow[]) {
  return rows.filter(isPdfBoardDetailSummaryRow)
}

export type PdfBreakdownSection = 'smt' | 'setup' | 'dip' | 'post' | 'material'

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

export function breakdownBoardColLabel(quoteType: QuoteType) {
  return quoteType === 'domestic' ? '보드' : 'BOARD'
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
): PreviewRow[] {
  const sectionTotalRow = rows.find((row) => row.sectionTotal)
  const detailRows = rows.filter((row) => !row.sectionTotal)
  const totalLabel = quoteType === 'domestic' ? '합계' : 'Total'
  const tableRows = [...detailRows]

  if (sectionTotalRow) {
    tableRows.push({
      ...sectionTotalRow,
      label: totalLabel,
      indent: 0,
      emphasize: true,
      amountEmphasize: true,
      boardSubtotal: false,
      sectionTotal: undefined,
      boardName: undefined,
      sectionFooter: sectionKey,
    })
  }

  return tableRows
}

export type BreakdownSectionPreview = {
  key: PreviewSection
  title: string
  rows: PreviewRow[]
}

export function buildProcessBreakdownSections(
  allRows: PreviewRow[],
  quoteType: QuoteType,
): BreakdownSectionPreview[] {
  const labels = getPreviewLabels(quoteType)
  const definitions: { key: PreviewSection; title: string }[] = [
    { key: 'smt', title: 'SMT' },
    { key: 'setup', title: 'SET-UP' },
    { key: 'post', title: pdfSummarySectionLabel(labels.postProcess, quoteType) },
    { key: 'material', title: pdfSummarySectionLabel(labels.materials, quoteType) },
  ]

  return definitions.flatMap(({ key, title }) => {
    const sectionRows = filterPdfBreakdownRows(allRows, key, quoteType)
    if (!sectionRows.length) return []
    return [{ key, title, rows: prepareBreakdownSectionTableRows(sectionRows, key, quoteType) }]
  })
}

/** PDF 항목별 요약 — 후공정 합계 행만 */
export function filterPdfBoardDetailsPostSummaryRows(
  rows: PreviewRow[],
  quoteType: QuoteType,
): PreviewRow[] {
  const labels = getPreviewLabels(quoteType)
  const postRows = filterPdfBreakdownRows(rows, 'post', quoteType)
  const sectionTotal = postRows.find((row) => row.sectionTotal === 'post')
  if (sectionTotal) return [sectionTotal]

  const boardTotal = postRows.find((row) => row.boardSubtotal && row.label === labels.postProcess)
  return boardTotal ? [boardTotal] : []
}

/** PDF 항목별 요약 — 자재 합계 행만 */
export function filterPdfBoardDetailsMaterialSummaryRows(
  rows: PreviewRow[],
  quoteType: QuoteType,
): PreviewRow[] {
  return filterPdfBreakdownRows(rows, 'material', quoteType).filter((row) => row.sectionTotal === 'material')
}

function quotePerUnitTotal(total: number, qty: number) {
  return total / (qty || 1)
}

function smtSetupPerUnit(setupAmount: number, qty: number) {
  return setupAmount / (qty || 1)
}

function smtBoardLaborPerUnit(board: SmtBoardDetail) {
  return board.laborUnit
}

function setupComponentPerUnit(minutes: number, rate: number, qty: number) {
  return smtSetupPerUnit(minutes * rate, qty)
}

function smtBoardInspectionPerUnit(board: SmtBoardDetail) {
  return board.inspectionUnit
}

/** SMT 대당 합계 = 실장비(대당) + 검사(대당). SET-UP은 별도 섹션 */
function previewSmtSectionPerUnit(result: EstimateResult) {
  const qty = result.qty || 1
  const laborTotal = result.common.smtLaborPerUnit * qty
  const inspectionTotal = result.common.smtInspectionPerUnit * qty
  return quotePerUnitTotal(laborTotal + inspectionTotal, qty)
}

export function previewFormFromQuote(quote: QuoteListItem): PreviewFormFields {
  const input = toEstimateInputFromDetail(quote)
  const post = quote.detailInfo.inputs?.postProcess || {}
  return {
    postAssembly: input.postAssembly ?? 0,
    postTest: input.postTest ?? 0,
    postPacking: input.postPacking ?? 0,
    materialCost: input.materialCost ?? 0,
    assemblyLines: post.assemblyLines,
    testLines: post.testLines,
    packingLines: post.packingLines,
  }
}

export function estimateSavedQuote(quote: QuoteListItem): EstimateResult {
  return calculateEstimate(toEstimateInputFromDetail(quote), {})
}

function smtDetailRowsForBoard(
  board: SmtBoardDetail,
  result: EstimateResult,
  quoteType: QuoteType,
): PreviewRow[] {
  const labels = getPreviewLabels(quoteType)
  const rates = getSmtUnitRates(quoteType)
  const rows: PreviewRow[] = []
  const useMinPlacementFee = board.laborMinApplied && board.laborMinAdjustment > 0
  const placementScore = computeSmtPlacementScore(board)

  if (useMinPlacementFee) {
    rows.push({
      label: labels.minPlacement,
      description: labels.minPlacementDesc(placementScore, SMT_PLACEMENT_MIN_SCORE),
      unit: getSmtPlacementMinFee(quoteType),
      count: labels.onePcb,
      amount: board.laborMinAdjustment,
      indent: 2,
    })
  } else {
    if (board.chip > 0) {
      rows.push({
        label: 'CHIP',
        unit: rates.chip,
        count: labels.partsCount(board.chip),
        amount: board.chip * rates.chip,
        indent: 2,
      })
    }
    if (board.smtOdd > 0) {
      rows.push({
        label: labels.oddParts,
        unit: rates.odd,
        count: labels.partsCount(board.smtOdd),
        amount: board.smtOdd * rates.odd,
        indent: 2,
      })
    }
    if (board.smtSpecial > 0) {
      rows.push({
        label: labels.specialParts,
        unit: rates.special,
        count: labels.partsCount(board.smtSpecial),
        amount: board.smtSpecial * rates.special,
        indent: 2,
      })
    }
    if (board.icPin > 0) {
      rows.push({
        label: 'IC PIN',
        unit: rates.icPin,
        count: `${board.icPin} PIN`,
        amount: board.icPin * rates.icPin,
        indent: 2,
      })
    }
    if (board.bga > 0) {
      rows.push({
        label: 'BGA BALL',
        unit: rates.bgaBall,
        count: `${board.bga} BALL`,
        amount: board.bga * rates.bgaBall,
        indent: 2,
      })
    }
  }

  return rows
}

function inspectionDetailRowsForBoard(board: SmtBoardDetail, quoteType: QuoteType): PreviewRow[] {
  if (board.inspectionUnit <= 0) return []

  const labels = getPreviewLabels(quoteType)
  const sideLabel = board.smtSide === 'double' ? labels.sideDouble : labels.sideSingle
  const rows: PreviewRow[] = []

  if (board.aoiInspectionUnit > 0) {
    rows.push({
      label: labels.aoi,
      description: sideLabel,
      unit: board.aoiInspectionUnit,
      count: labels.onePcb,
      amount: board.aoiInspectionUnit,
      indent: 2,
    })
  }

  if (quoteType === 'domestic' && board.pcbWashUnit > 0) {
    rows.push({
      label: labels.pcbWash,
      unit: board.pcbWashUnit,
      count: labels.onePcb,
      amount: board.pcbWashUnit,
      indent: 2,
    })
  }

  return rows
}

function smtSetupDetailRowsForBoard(
  board: SmtBoardDetail,
  result: EstimateResult,
  quoteType: QuoteType,
): PreviewRow[] {
  if (board.setupAmount <= 0) return []

  const labels = getPreviewLabels(quoteType)
  const qty = result.qty || 1
  const smtSide = board.smtSide === 'double' ? 'double' : 'single'
  const breakdown = computeSmtSetupBillingBreakdown(board.setupPartCount, smtSide, quoteType)

  function setupDetailRow(
    label: string,
    description: string,
    minutes: number,
    count: string,
  ): PreviewRow {
    return {
      label,
      description,
      count,
      amount: setupComponentPerUnit(minutes, board.setupRate, qty),
      indent: 2,
    }
  }

  return [
    setupDetailRow(
      labels.setupBaseTime,
      labels.setupBaseDesc,
      breakdown.baseMinutes,
      formatQuoteSetupMinutes(breakdown.baseMinutes, quoteType),
    ),
    setupDetailRow(
      labels.firstArticle,
      labels.setupFirstArticleDesc,
      breakdown.firstArticleMinutes,
      formatQuoteSetupMinutes(breakdown.firstArticleMinutes, quoteType),
    ),
    setupDetailRow(
      'SETTING',
      labels.setupSettingDesc,
      breakdown.settingMinutes,
      formatQuoteSetupMinutes(breakdown.settingMinutes, quoteType),
    ),
  ]
}

function dipDetailRowsForBoard(board: DipBoardDetail, quoteType: QuoteType): PreviewRow[] {
  const labels = getPreviewLabels(quoteType)
  const rows: PreviewRow[] = []
  if (board.dipGeneral > 0) {
    rows.push({
      label: labels.dipGeneral,
      unit: DIP_UNIT.dipGeneral,
      count: board.dipGeneral,
      amount: board.dipGeneral * DIP_UNIT.dipGeneral,
      indent: 2,
    })
  }
  if (board.dipConnector > 0) {
    rows.push({
      label: labels.dipConnector,
      unit: DIP_UNIT.dipConnector,
      count: board.dipConnector,
      amount: board.dipConnector * DIP_UNIT.dipConnector,
      indent: 2,
    })
  }
  if (board.dipWire > 0) {
    rows.push({
      label: labels.dipWire,
      unit: DIP_UNIT.dipWire,
      count: board.dipWire,
      amount: board.dipWire * DIP_UNIT.dipWire,
      indent: 2,
    })
  }
  if (board.waveGeneral > 0) {
    rows.push({
      label: labels.waveGeneral,
      unit: DIP_UNIT.waveGeneral,
      count: board.waveGeneral,
      amount: board.waveGeneral * DIP_UNIT.waveGeneral,
      indent: 2,
    })
  }
  if (board.waveConnector > 0) {
    rows.push({
      label: labels.waveConnector,
      unit: DIP_UNIT.waveConnector,
      count: board.waveConnector,
      amount: board.waveConnector * DIP_UNIT.waveConnector,
      indent: 2,
    })
  }
  if (board.waveWire > 0) {
    rows.push({
      label: labels.waveWire,
      unit: DIP_UNIT.waveWire,
      count: board.waveWire,
      amount: board.waveWire * DIP_UNIT.waveWire,
      indent: 2,
    })
  }
  return rows
}

function postProcessDetailDescription(
  lines: PreviewPostProcessLine[] | PostProcessLine[] | undefined,
  fallback: string,
) {
  const names = (lines ?? [])
    .map((line) => (line.name || '').trim())
    .filter(Boolean)
  return names.length > 0 ? names.join(' · ') : fallback
}

function postDetailRows(form: PreviewFormFields, indent: number, quoteType: QuoteType): PreviewRow[] {
  const labels = getPreviewLabels(quoteType)
  const postRate = getPostRate(quoteType)
  const rows: PreviewRow[] = []
  if (Number(form.postAssembly) > 0) {
    rows.push({
      label: labels.assembly,
      description: postProcessDetailDescription(form.assemblyLines, labels.assemblyDesc),
      unit: postRate,
      count: labels.minutesCount(form.postAssembly),
      amount: Number(form.postAssembly) * postRate,
      indent,
    })
  }
  if (Number(form.postTest) > 0) {
    rows.push({
      label: labels.test,
      description: postProcessDetailDescription(form.testLines, labels.testDesc),
      unit: postRate,
      count: labels.minutesCount(form.postTest),
      amount: Number(form.postTest) * postRate,
      indent,
    })
  }
  if (Number(form.postPacking) > 0) {
    rows.push({
      label: labels.packing,
      description: postProcessDetailDescription(form.packingLines, labels.packingDesc),
      unit: postRate,
      count: labels.minutesCount(form.postPacking),
      amount: Number(form.postPacking) * postRate,
      indent,
    })
  }
  return rows
}

function hasPostInputs(form: PreviewFormFields) {
  return Number(form.postAssembly) > 0 || Number(form.postTest) > 0 || Number(form.postPacking) > 0
}

function previewMaterialRows(result: EstimateResult, form: PreviewFormFields, quoteType: QuoteType): PreviewRow[] {
  const labels = getPreviewLabels(quoteType)
  const materialPerUnit = Number(form.materialCost) || 0
  const materialMgmtPerUnit = quotePerUnitTotal(result.common.materialManagement, result.qty)
  const hasRaw = materialPerUnit > 0
  const hasMgmt = result.common.materialManagement > 0
  if (!hasRaw && !hasMgmt) return []

  const rows: PreviewRow[] = [
    {
      label: labels.materials,
      amount: materialPerUnit + materialMgmtPerUnit,
      emphasize: true,
      amountEmphasize: true,
      sectionTotal: 'material',
    },
  ]

  if (hasRaw) {
    rows.push({
      label: labels.rawMaterial,
      unit: materialPerUnit,
      count: labels.oneUnit,
      amount: materialPerUnit,
      indent: 1,
    })
  }
  if (hasMgmt) {
    rows.push({
      label: labels.managementFee,
      unit: materialMgmtPerUnit,
      count: labels.oneUnit,
      amount: materialMgmtPerUnit,
      indent: 1,
    })
  }

  return rows
}

function buildBoardCentricPreviewRows(
  result: EstimateResult,
  form: PreviewFormFields,
  quoteType: QuoteType,
): PreviewRow[] {
  const labels = getPreviewLabels(quoteType)
  const qty = result.qty || 1
  const pcbCount = result.common.pcbBoardDetails.length
  const singlePcb = pcbCount <= 1
  const postPerUnit = quotePerUnitTotal(result.values.postProcess, qty)
  const rows: PreviewRow[] = []

  for (let index = 0; index < pcbCount; index += 1) {
    const smtBoard = result.common.pcbBoardDetails[index]
    const dipBoard = result.common.dipBoardDetails[index]
    const smtLabor = smtBoardLaborPerUnit(smtBoard)
    const setupPerUnit = smtSetupPerUnit(smtBoard.setupAmount, qty)
    const inspectionPerUnit = smtBoardInspectionPerUnit(smtBoard)
    const dip = dipBoard?.boardUnit ?? 0
    const boardPost = singlePcb ? postPerUnit : 0
    const smtDetails = smtDetailRowsForBoard(smtBoard, result, quoteType)
    const setupDetails = smtSetupDetailRowsForBoard(smtBoard, result, quoteType)
    const inspectionDetails = inspectionDetailRowsForBoard(smtBoard, quoteType)
    const dipDetails = dipBoard ? dipDetailRowsForBoard(dipBoard, quoteType) : []

    rows.push({
      label: `■ ${smtBoard.pcbName}`,
      amount: smtLabor + setupPerUnit + inspectionPerUnit + (singlePcb ? dip + boardPost : 0),
      boardTotal: true,
      emphasize: true,
      amountEmphasize: true,
    })

    if (smtLabor > 0 || smtDetails.length > 0) {
      rows.push({
        label: 'SMD',
        amount: smtLabor,
        indent: 1,
        boardSubtotal: true,
        emphasize: true,
        amountEmphasize: true,
      })
      rows.push(...smtDetails)
    }

    if (setupPerUnit > 0 || setupDetails.length > 0) {
      rows.push({
        label: 'SET-UP',
        amount: setupPerUnit,
        indent: 1,
        boardSubtotal: true,
        emphasize: true,
        amountEmphasize: true,
      })
      rows.push(...setupDetails)
    }

    if (inspectionPerUnit > 0 || inspectionDetails.length > 0) {
      rows.push({
        label: labels.inspection,
        amount: inspectionPerUnit,
        indent: 1,
        boardSubtotal: true,
        emphasize: true,
        amountEmphasize: true,
      })
      rows.push(...inspectionDetails)
    }

    const hasDip = singlePcb && (dip > 0 || dipDetails.length > 0)
    const hasBoardPost = singlePcb && (postPerUnit > 0 || hasPostInputs(form))
    if (hasDip || hasBoardPost) {
      rows.push({
        label: labels.postProcess,
        amount: dip + boardPost,
        indent: 1,
        boardSubtotal: true,
        emphasize: true,
        amountEmphasize: true,
      })
      if (hasDip) {
        rows.push({
          label: labels.soldering,
          amount: dip,
          indent: 2,
          boardSubtotal: true,
          emphasize: true,
          amountEmphasize: true,
        })
        rows.push(...dipDetails.map((row) => ({ ...row, indent: 3 })))
      }
      if (hasBoardPost) {
        rows.push(...postDetailRows(form, 2, quoteType))
      }
    }
  }

  if (!singlePcb) {
    const sharedDipTotal = result.common.dipBoardDetails.reduce((sum, board) => sum + (board?.boardUnit ?? 0), 0)
    const hasSharedPost = postPerUnit > 0 || hasPostInputs(form)
    if (sharedDipTotal > 0 || hasSharedPost) {
      rows.push({
        label: labels.postProcess,
        amount: sharedDipTotal + postPerUnit,
        emphasize: true,
        amountEmphasize: true,
        sectionTotal: 'post',
      })
      for (let index = 0; index < pcbCount; index += 1) {
        const smtBoard = result.common.pcbBoardDetails[index]
        const dipBoard = result.common.dipBoardDetails[index]
        if (!dipBoard) continue
        const dip = dipBoard.boardUnit ?? 0
        const dipDetails = dipDetailRowsForBoard(dipBoard, quoteType)
        if (dip <= 0 && !dipDetails.length) continue
        rows.push({
          label: labels.soldering,
          description: smtBoard.pcbName,
          amount: dip,
          indent: 1,
          boardSubtotal: true,
          emphasize: true,
          amountEmphasize: true,
        })
        rows.push(...dipDetails)
      }
      if (hasSharedPost) {
        rows.push(...postDetailRows(form, 1, quoteType))
      }
    }
  }

  rows.push(...previewMaterialRows(result, form, quoteType))
  return rows
}

function withBoardName(rows: PreviewRow[], pcbName: string): PreviewRow[] {
  return rows.map((row) => ({ ...row, boardName: pcbName }))
}

/** PDF 세부 산정내역 — SMT / SET-UP / 후공정(납땜 포함) / 자재 */
export function buildProcessCentricPdfBreakdownRows(
  result: EstimateResult,
  form: PreviewFormFields,
  quoteType: QuoteType,
): PreviewRow[] {
  const labels = getPreviewLabels(quoteType)
  const qty = result.qty || 1
  const pcbCount = result.common.pcbBoardDetails.length
  const multiBoard = pcbCount > 1
  const rows: PreviewRow[] = []

  const smtTotal = pdfSmtSectionTotal(result)
  if (smtTotal > 0) {
    rows.push({
      label: pdfSummarySectionLabel('SMT', quoteType),
      amount: smtTotal,
      sectionTotal: 'smt',
      emphasize: true,
      amountEmphasize: true,
    })

    for (let index = 0; index < pcbCount; index += 1) {
      const smtBoard = result.common.pcbBoardDetails[index]
      const boardName = multiBoard ? smtBoard.pcbName : undefined
      const smtLabor = smtBoardLaborPerUnit(smtBoard)
      const inspectionPerUnit = smtBoardInspectionPerUnit(smtBoard)
      const smtDetails = smtDetailRowsForBoard(smtBoard, result, quoteType)
      const inspectionDetails = inspectionDetailRowsForBoard(smtBoard, quoteType)

      if (smtLabor > 0 || smtDetails.length > 0) {
        rows.push({
          label: 'SMD',
          amount: null,
          indent: 1,
          boardSubtotal: true,
          emphasize: true,
          boardName,
        })
        rows.push(...(multiBoard ? withBoardName(smtDetails, smtBoard.pcbName) : smtDetails))
      }

      if (inspectionPerUnit > 0 || inspectionDetails.length > 0) {
        rows.push({
          label: labels.inspection,
          amount: null,
          indent: 1,
          boardSubtotal: true,
          emphasize: true,
          boardName,
        })
        rows.push(...(multiBoard ? withBoardName(inspectionDetails, smtBoard.pcbName) : inspectionDetails))
      }
    }
  }

  const setupTotal = pdfSetupSectionTotal(result)
  if (setupTotal > 0) {
    rows.push({
      label: 'SET-UP',
      amount: setupTotal,
      sectionTotal: 'setup',
      emphasize: true,
      amountEmphasize: true,
    })

    for (let index = 0; index < pcbCount; index += 1) {
      const smtBoard = result.common.pcbBoardDetails[index]
      const boardName = multiBoard ? smtBoard.pcbName : undefined
      const setupPerUnit = smtSetupPerUnit(smtBoard.setupAmount, qty)
      const setupDetails = smtSetupDetailRowsForBoard(smtBoard, result, quoteType)
      if (setupPerUnit <= 0 && !setupDetails.length) continue

      if (multiBoard && setupDetails.length === 0) {
        rows.push({
          label: '',
          amount: setupPerUnit,
          boardSubtotal: true,
          emphasize: true,
          amountEmphasize: true,
          boardName,
        })
      } else if (setupDetails.length > 0) {
        rows.push({
          label: 'SET-UP',
          amount: null,
          indent: 1,
          boardSubtotal: true,
          emphasize: true,
          boardName,
        })
        rows.push(...(multiBoard ? withBoardName(setupDetails, smtBoard.pcbName) : setupDetails))
      }
    }
  }

  const dipTotal = pdfSolderingSectionTotal(result)
  const postPerUnit = quotePerUnitTotal(result.values.postProcess, qty)
  const postSectionTotal = postPerUnit + dipTotal
  if (postSectionTotal > 0 || hasPostInputs(form) || dipTotal > 0) {
    rows.push({
      label: pdfSummarySectionLabel(labels.postProcess, quoteType),
      amount: postSectionTotal,
      sectionTotal: 'post',
      emphasize: true,
      amountEmphasize: true,
    })

    if (dipTotal > 0) {
      rows.push({
        label: labels.soldering,
        amount: null,
        indent: 1,
        boardSubtotal: true,
        emphasize: true,
      })

      for (let index = 0; index < pcbCount; index += 1) {
        const smtBoard = result.common.pcbBoardDetails[index]
        const dipBoard = result.common.dipBoardDetails[index]
        if (!dipBoard) continue

        const boardName = multiBoard ? smtBoard.pcbName : undefined
        const dip = dipBoard.boardUnit ?? 0
        const dipDetails = dipDetailRowsForBoard(dipBoard, quoteType)
        if (dip <= 0 && !dipDetails.length) continue

        if (multiBoard && !dipDetails.length) {
          rows.push({
            label: '',
            amount: dip,
            indent: 2,
            boardSubtotal: true,
            emphasize: true,
            amountEmphasize: true,
            boardName,
          })
        }
        rows.push(
          ...(multiBoard
            ? withBoardName(
                dipDetails.map((row) => ({ ...row, indent: Math.max(2, (row.indent ?? 1) + 1) })),
                smtBoard.pcbName,
              )
            : dipDetails.map((row) => ({ ...row, indent: Math.max(2, (row.indent ?? 1) + 1) }))),
        )
      }
    }

    if (postPerUnit > 0 || hasPostInputs(form)) {
      rows.push(...postDetailRows(form, 1, quoteType))
    }
  }

  const materialRows = previewMaterialRows(result, form, quoteType)
  if (materialRows.length > 0) {
    const [materialHeader, ...materialDetails] = materialRows
    rows.push({
      ...materialHeader,
      label: pdfSummarySectionLabel(labels.materials, quoteType),
    })
    rows.push(...materialDetails)
  }

  return rows
}

export function buildPreviewRows(result: EstimateResult, form: PreviewFormFields, quoteType: QuoteType) {
  return buildBoardCentricPreviewRows(result, form, quoteType)
}

export type PdfSummaryBreakdownLine = {
  label: string
  total: number
  section: PreviewSection
}

/** @deprecated Use PdfSummaryBreakdownLine */
export type PdfBoardSummaryRow = PdfSummaryBreakdownLine

function pdfSmtSectionTotal(result: EstimateResult) {
  return result.common.pcbBoardDetails.reduce((sum, smtBoard) => {
    const smt = smtBoardLaborPerUnit(smtBoard)
    const inspection = smtBoardInspectionPerUnit(smtBoard)
    return sum + smt + inspection
  }, 0)
}

function pdfSetupSectionTotal(result: EstimateResult) {
  const qty = result.qty || 1
  return result.common.pcbBoardDetails.reduce(
    (sum, smtBoard) => sum + smtSetupPerUnit(smtBoard.setupAmount, qty),
    0,
  )
}

function pdfSolderingSectionTotal(result: EstimateResult) {
  return result.common.pcbBoardDetails.reduce((sum, _smtBoard, index) => {
    const dipBoard = result.common.dipBoardDetails[index]
    return sum + (dipBoard?.boardUnit ?? 0)
  }, 0)
}

export function pdfSummarySectionLabel(label: string, quoteType: QuoteType) {
  return quoteType === 'domestic' ? label : label.toUpperCase()
}

export function buildPdfSummaryBreakdownLines(
  result: EstimateResult,
  form: PreviewFormFields,
  quoteType: QuoteType,
): PdfSummaryBreakdownLine[] {
  const labels = getPreviewLabels(quoteType)
  const lines: PdfSummaryBreakdownLine[] = []

  const smt = pdfSmtSectionTotal(result)
  if (smt > 0) lines.push({ label: pdfSummarySectionLabel('SMT', quoteType), total: smt, section: 'smt' })

  const setup = pdfSetupSectionTotal(result)
  if (setup > 0) lines.push({ label: 'SET-UP', total: setup, section: 'setup' })

  const soldering = pdfSolderingSectionTotal(result)
  const postPerUnit = quotePerUnitTotal(result.values.postProcess, result.qty || 1)
  const postTotal = postPerUnit + soldering
  if (postTotal > 0 || hasPostInputs(form) || soldering > 0) {
    lines.push({
      label: pdfSummarySectionLabel(labels.postProcess, quoteType),
      total: postTotal,
      section: 'post',
    })
  }

  const materialPerUnit = Number(form.materialCost) || 0
  const materialMgmtPerUnit = quotePerUnitTotal(result.common.materialManagement, result.qty || 1)
  const materials = materialPerUnit + materialMgmtPerUnit
  if (materials > 0) {
    lines.push({
      label: pdfSummarySectionLabel(labels.materials, quoteType),
      total: materials,
      section: 'material',
    })
  }

  return lines
}

/** @deprecated Use buildPdfSummaryBreakdownLines */
export function buildPdfSmtBoardSummaryRows(
  result: EstimateResult,
  _productName: string,
): PdfSummaryBreakdownLine[] {
  const total = pdfSmtSectionTotal(result)
  return total > 0 ? [{ label: 'SMT', total, section: 'smt' as const }] : []
}

/** @deprecated Use buildPdfSummaryBreakdownLines */
export function buildPdfSolderingBoardSummaryRows(
  result: EstimateResult,
  _productName: string,
): PdfSummaryBreakdownLine[] {
  const total = pdfSolderingSectionTotal(result)
  return total > 0 ? [{ label: 'Soldering', total, section: 'dip' as const }] : []
}

/** @deprecated Use buildPdfSummaryBreakdownLines */
export function buildPdfPostProcessBoardSummaryRows(
  result: EstimateResult,
  form: PreviewFormFields,
  _productName: string,
): PdfSummaryBreakdownLine[] {
  const soldering = pdfSolderingSectionTotal(result)
  const postPerUnit = quotePerUnitTotal(result.values.postProcess, result.qty || 1)
  const total = soldering + postPerUnit
  if (total <= 0 && !hasPostInputs(form)) return []
  return [{ label: 'Post-Process', total, section: 'post' as const }]
}

/** @deprecated Use buildPdfSummaryBreakdownLines */
export function buildPdfMaterialsBoardSummaryRows(
  result: EstimateResult,
  form: PreviewFormFields,
  _productName: string,
): PdfSummaryBreakdownLine[] {
  const materialPerUnit = Number(form.materialCost) || 0
  const materialMgmtPerUnit = quotePerUnitTotal(result.common.materialManagement, result.qty || 1)
  const total = materialPerUnit + materialMgmtPerUnit
  if (total <= 0) return []
  return [{ label: 'Materials', total, section: 'material' as const }]
}

/** @deprecated Use buildPdfSummaryBreakdownLines */
export function buildPdfBoardDetailRows(result: EstimateResult, _productName = '-'): PdfSummaryBreakdownLine[] {
  return buildPdfSmtBoardSummaryRows(result, _productName)
}

export type PreviewBoardRow = {
  pcbName: string
  smtPerUnit: number
  dipPerUnit: number
  postPerUnit: number | null
  rowTotalPerUnit: number
}

export type PreviewMatrixMaterialRow = {
  label: string
  description?: string
  amountPerUnit: number
}

export type PreviewMatrix = {
  boardRows: PreviewBoardRow[]
  sharedPostRow: { postPerUnit: number } | null
  productionTotal: {
    smtPerUnit: number
    dipPerUnit: number
    postPerUnit: number
    rowTotalPerUnit: number
  }
  materialRows: PreviewMatrixMaterialRow[]
  materialTotalPerUnit: number
  grandPerUnit: number
}

export function buildPreviewMatrix(result: EstimateResult, form: PreviewFormFields): PreviewMatrix {
  const qty = result.qty || 1
  const postOnlyPerUnit = quotePerUnitTotal(result.values.postProcess, qty)
  const smtPerUnit = previewSmtSectionPerUnit(result)
  const setupPerUnit = pdfSetupSectionTotal(result)
  const dipPerUnit = quotePerUnitTotal(result.values.dip, qty)
  /** 표시용 후공정 = 납땜 + 조립·테스트·포장 */
  const postPerUnit = dipPerUnit + postOnlyPerUnit
  const pcbCount = result.common.pcbBoardDetails.length
  const postOnBoardRow = pcbCount <= 1

  const boardRows = result.common.pcbBoardDetails.map((smtBoard, index) => {
    const dipBoard = result.common.dipBoardDetails[index]
    const smtLabor = smtBoardLaborPerUnit(smtBoard)
    const setup = smtSetupPerUnit(smtBoard.setupAmount, qty)
    const inspection = smtBoardInspectionPerUnit(smtBoard)
    const dip = dipBoard?.boardUnit ?? 0
    const post = postOnBoardRow ? postOnlyPerUnit + dip : null

    return {
      pcbName: smtBoard.pcbName,
      smtPerUnit: smtLabor + inspection,
      dipPerUnit: dip,
      postPerUnit: post,
      rowTotalPerUnit: smtLabor + setup + inspection + dip + (postOnBoardRow ? postOnlyPerUnit : 0),
    }
  })

  const sharedPostRow = !postOnBoardRow && postPerUnit > 0 ? { postPerUnit } : null

  const materialPerUnit = Number(form.materialCost) || 0
  const materialMgmtPerUnit = quotePerUnitTotal(result.common.materialManagement, qty)
  const materialRows: PreviewMatrixMaterialRow[] = []

  if (materialPerUnit > 0) {
    materialRows.push({ label: '원자재', amountPerUnit: materialPerUnit })
  }
  if (materialMgmtPerUnit > 0) {
    materialRows.push({
      label: '관리비',
      amountPerUnit: materialMgmtPerUnit,
    })
  }

  return {
    boardRows,
    sharedPostRow,
    productionTotal: {
      smtPerUnit,
      dipPerUnit,
      postPerUnit,
      rowTotalPerUnit: smtPerUnit + setupPerUnit + postPerUnit,
    },
    materialRows,
    materialTotalPerUnit: materialPerUnit + materialMgmtPerUnit,
    grandPerUnit: result.values.grandTotal / qty,
  }
}

export function buildQuotePreviewData(quote: QuoteListItem) {
  const estimate = estimateSavedQuote(quote)
  const form = previewFormFromQuote(quote)
  const rows = buildPreviewRows(estimate, form, quote.quoteType)
  const pdfBreakdownRows = buildProcessCentricPdfBreakdownRows(estimate, form, quote.quoteType)
  const matrix = buildPreviewMatrix(estimate, form)
  return { estimate, rows, pdfBreakdownRows, form, matrix }
}
