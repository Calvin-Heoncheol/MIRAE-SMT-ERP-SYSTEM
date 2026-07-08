import {
  DIP_UNIT,
  POST_RATE,
  SMT_PLACEMENT_MIN_SCORE,
  getSmtPlacementMinFee,
  SMT_UNIT_BGA_BALL,
  SMT_UNIT_CHIP,
  SMT_UNIT_IC_PIN,
  SMT_UNIT_ODD,
  SMT_UNIT_SPECIAL,
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
  QuoteDisplayCurrency,
  QuoteListItem,
  QuoteType,
  SmtBoardDetail,
} from './types'
import { toEstimateInputFromDetail } from './utils'

export type PreviewSection = 'smt' | 'dip' | 'post' | 'material'

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
}

export type PreviewFormFields = {
  postAssembly: string | number
  postTest: string | number
  postPacking: string | number
  materialCost: string | number
}

export const SECTION_TOTAL_ROW_CLASS = 'bg-slate-300 border-t-2 border-slate-500'
export const SECTION_TOTAL_ROW_ACCENT_CLASS = 'border-l-4 border-slate-600'
export const SECTION_TOTAL_ROW_BG = '#cbd5e1'
export const BOARD_SUBTOTAL_ROW_CLASS = 'bg-slate-200'
export const BOARD_SUBTOTAL_ROW_BG = '#e2e8f0'

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

/** PDF Board Details — 보드별 총액 + 공통 후공정·자재만 */
export function isPdfBoardDetailSummaryRow(row: PreviewRow) {
  if (row.boardTotal) return true
  return row.sectionTotal === 'post' || row.sectionTotal === 'material'
}

export function filterPdfBoardDetailRows(rows: PreviewRow[]) {
  return rows.filter(isPdfBoardDetailSummaryRow)
}

export type PdfBreakdownSection = 'smt' | 'post' | 'material'

export function filterPdfBreakdownRows(
  rows: PreviewRow[],
  section: PdfBreakdownSection,
  quoteType: QuoteType,
): PreviewRow[] {
  const labels = getPreviewLabels(quoteType)
  const result: PreviewRow[] = []
  let block: PdfBreakdownSection | null = null

  for (const row of rows) {
    if (row.sectionTotal === 'post') {
      block = 'post'
      if (section === 'post') result.push(row)
      continue
    }
    if (row.sectionTotal === 'material') {
      block = 'material'
      if (section === 'material') result.push(row)
      continue
    }
    if (row.boardSubtotal && row.label === labels.postProcess) {
      block = 'post'
      if (section === 'post') result.push(row)
      continue
    }

    if (block === 'post') {
      if (section === 'post') result.push(row)
      continue
    }
    if (block === 'material') {
      if (section === 'material') result.push(row)
      continue
    }

    if (section === 'smt') {
      result.push(row)
    }
  }

  return result
}

/** Board Summary 페이지 — 후공정 합계 행만 */
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

/** Board Summary 페이지 — 자재 합계 행만 */
export function filterPdfBoardDetailsMaterialSummaryRows(
  rows: PreviewRow[],
  quoteType: QuoteType,
): PreviewRow[] {
  return filterPdfBreakdownRows(rows, 'material', quoteType).filter((row) => row.sectionTotal === 'material')
}

function quotePerUnitTotal(total: number, qty: number) {
  return Math.round(total / (qty || 1))
}

function smtSetupPerUnit(setupAmount: number, qty: number) {
  return Math.round(setupAmount / (qty || 1))
}

function smtBoardLaborPerUnit(board: SmtBoardDetail) {
  return board.laborUnit
}

function setupComponentPerUnit(minutes: number, rate: number, qty: number) {
  return smtSetupPerUnit(Math.round(minutes * rate), qty)
}

function smtBoardInspectionPerUnit(board: SmtBoardDetail) {
  return board.inspectionUnit
}

/** SMT 대당 합계 = 실장비(대당) + SET-UP(총액 안분) + 검사(대당) */
function previewSmtSectionPerUnit(result: EstimateResult) {
  const qty = result.qty || 1
  const laborTotal = Math.floor(result.common.smtLaborPerUnit * qty)
  const inspectionTotal = Math.floor(result.common.smtInspectionPerUnit * qty)
  return quotePerUnitTotal(laborTotal + result.common.smtSetup + inspectionTotal, qty)
}

export function previewFormFromQuote(quote: QuoteListItem): PreviewFormFields {
  const input = toEstimateInputFromDetail(quote)
  return {
    postAssembly: input.postAssembly ?? 0,
    postTest: input.postTest ?? 0,
    postPacking: input.postPacking ?? 0,
    materialCost: input.materialCost ?? 0,
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
        unit: SMT_UNIT_CHIP,
        count: labels.partsCount(board.chip),
        amount: board.chip * SMT_UNIT_CHIP,
        indent: 2,
      })
    }
    if (board.smtOdd > 0) {
      rows.push({
        label: labels.oddParts,
        unit: SMT_UNIT_ODD,
        count: labels.partsCount(board.smtOdd),
        amount: board.smtOdd * SMT_UNIT_ODD,
        indent: 2,
      })
    }
    if (board.smtSpecial > 0) {
      rows.push({
        label: labels.specialParts,
        unit: SMT_UNIT_SPECIAL,
        count: labels.partsCount(board.smtSpecial),
        amount: board.smtSpecial * SMT_UNIT_SPECIAL,
        indent: 2,
      })
    }
    if (board.icPin > 0) {
      rows.push({
        label: 'IC PIN',
        unit: SMT_UNIT_IC_PIN,
        count: `${board.icPin} PIN`,
        amount: board.icPin * SMT_UNIT_IC_PIN,
        indent: 2,
      })
    }
    if (board.bga > 0) {
      rows.push({
        label: 'BGA BALL',
        unit: SMT_UNIT_BGA_BALL,
        count: `${board.bga} BALL`,
        amount: board.bga * SMT_UNIT_BGA_BALL,
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

  return [
    {
      label: labels.inspectionCombined,
      description: sideLabel,
      unit: board.inspectionUnit,
      count: labels.onePcb,
      amount: board.inspectionUnit,
      indent: 2,
    },
  ]
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
  const breakdown = computeSmtSetupBillingBreakdown(board.setupPartCount, smtSide)

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

function postDetailRows(form: PreviewFormFields, indent: number, quoteType: QuoteType): PreviewRow[] {
  const labels = getPreviewLabels(quoteType)
  const rows: PreviewRow[] = []
  if (Number(form.postAssembly) > 0) {
    rows.push({
      label: labels.assembly,
      description: labels.assemblyDesc,
      unit: POST_RATE,
      count: labels.minutesCount(form.postAssembly),
      amount: Number(form.postAssembly) * POST_RATE,
      indent,
    })
  }
  if (Number(form.postTest) > 0) {
    rows.push({
      label: labels.test,
      description: labels.testDesc,
      unit: POST_RATE,
      count: labels.minutesCount(form.postTest),
      amount: Number(form.postTest) * POST_RATE,
      indent,
    })
  }
  if (Number(form.postPacking) > 0) {
    rows.push({
      label: labels.packing,
      description: labels.packingDesc,
      unit: POST_RATE,
      count: labels.minutesCount(form.postPacking),
      amount: Number(form.postPacking) * POST_RATE,
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
      amount: smtLabor + setupPerUnit + inspectionPerUnit + dip + boardPost,
      boardTotal: true,
      emphasize: true,
      amountEmphasize: true,
    })

    if (smtLabor > 0 || smtDetails.length > 0) {
      rows.push({
        label: 'SMT',
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

    if (dip > 0 || dipDetails.length > 0) {
      rows.push({
        label: labels.soldering,
        amount: dip,
        indent: 1,
        boardSubtotal: true,
        emphasize: true,
        amountEmphasize: true,
      })
      rows.push(...dipDetails)
    }

    if (singlePcb && (postPerUnit > 0 || hasPostInputs(form))) {
      rows.push({
        label: labels.postProcess,
        amount: postPerUnit,
        indent: 1,
        boardSubtotal: true,
        emphasize: true,
        amountEmphasize: true,
      })
      rows.push(...postDetailRows(form, 2, quoteType))
    }
  }

  if (!singlePcb && (postPerUnit > 0 || hasPostInputs(form))) {
    rows.push({
      label: labels.postProcess,
      amount: postPerUnit,
      emphasize: true,
      amountEmphasize: true,
      sectionTotal: 'post',
    })
    rows.push(...postDetailRows(form, 1, quoteType))
  }

  rows.push(...previewMaterialRows(result, form, quoteType))
  return rows
}

export function buildPreviewRows(result: EstimateResult, form: PreviewFormFields, quoteType: QuoteType) {
  return buildBoardCentricPreviewRows(result, form, quoteType)
}

export type PdfBoardDetailRow = {
  pcbName: string
  smt: number
  setup: number
  inspection: number
  soldering: number
  total: number
}

export function buildPdfBoardDetailRows(result: EstimateResult): PdfBoardDetailRow[] {
  const qty = result.qty || 1

  return result.common.pcbBoardDetails.map((smtBoard, index) => {
    const dipBoard = result.common.dipBoardDetails[index]
    const smt = smtBoardLaborPerUnit(smtBoard)
    const setup = smtSetupPerUnit(smtBoard.setupAmount, qty)
    const inspection = smtBoardInspectionPerUnit(smtBoard)
    const soldering = dipBoard?.boardUnit ?? 0

    return {
      pcbName: smtBoard.pcbName,
      smt,
      setup,
      inspection,
      soldering,
      total: smt + setup + inspection + soldering,
    }
  })
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
  const postPerUnit = quotePerUnitTotal(result.values.postProcess, qty)
  const smtPerUnit = previewSmtSectionPerUnit(result)
  const dipPerUnit = quotePerUnitTotal(result.values.dip, qty)
  const pcbCount = result.common.pcbBoardDetails.length
  const postOnBoardRow = pcbCount <= 1

  const boardRows = result.common.pcbBoardDetails.map((smtBoard, index) => {
    const dipBoard = result.common.dipBoardDetails[index]
    const smtLabor = smtBoardLaborPerUnit(smtBoard)
    const setup = smtSetupPerUnit(smtBoard.setupAmount, qty)
    const inspection = smtBoardInspectionPerUnit(smtBoard)
    const dip = dipBoard?.boardUnit ?? 0
    const post = postOnBoardRow ? postPerUnit : null

    return {
      pcbName: smtBoard.pcbName,
      smtPerUnit: smtLabor + setup + inspection,
      dipPerUnit: dip,
      postPerUnit: post,
      rowTotalPerUnit: smtLabor + setup + inspection + dip + (post ?? 0),
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
      rowTotalPerUnit: smtPerUnit + dipPerUnit + postPerUnit,
    },
    materialRows,
    materialTotalPerUnit: materialPerUnit + materialMgmtPerUnit,
    grandPerUnit: Math.floor(result.values.grandTotal / qty),
  }
}

export function buildQuotePreviewData(quote: QuoteListItem) {
  const estimate = estimateSavedQuote(quote)
  const form = previewFormFromQuote(quote)
  const rows = buildPreviewRows(estimate, form, quote.quoteType)
  const matrix = buildPreviewMatrix(estimate, form)
  return { estimate, rows, form, matrix }
}
