import {
  AOI_UNIT_PRICE_DOUBLE,
  AOI_UNIT_PRICE_SINGLE,
  DIP_UNIT,
  POST_RATE,
  SMT_PLACEMENT_MIN_SCORE,
  getSmtPlacementMinFee,
  SMT_UNIT_BGA_BALL,
  SMT_UNIT_CHIP,
  SMT_UNIT_IC_PIN,
  SMT_UNIT_ODD,
  SMT_UNIT_SPECIAL,
  SUB_MATERIAL_RATE,
} from './constants'
import { calculateEstimate, computeSmtPlacementScore } from './calculate-estimate'
import { formatQuoteMoneyUnit, formatQuoteSetupMinutes } from './format'
import type { DipBoardDetail, EstimateResult, QuoteListItem, QuoteType, SmtBoardDetail } from './types'
import { toEstimateInputFromDetail } from './utils'

export type PreviewSection = 'smt' | 'dip' | 'post' | 'material'

export type PreviewRow = {
  label: string
  subLabel?: string
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

export function formatPreviewRowUnit(row: PreviewRow, quoteType: QuoteType) {
  if (row.unitLabel) return row.unitLabel
  if (row.unit != null) return formatQuoteMoneyUnit(row.unit, quoteType)
  return '-'
}

export function isPreviewHighlightRow(row: PreviewRow) {
  return Boolean(row.sectionTotal || row.boardTotal)
}

function quotePerUnitTotal(total: number, qty: number) {
  return Math.round(total / (qty || 1))
}

function smtSetupPerUnit(setupAmount: number, qty: number) {
  return Math.round(setupAmount / (qty || 1))
}

function smtBoardPerUnit(board: SmtBoardDetail, qty: number) {
  return board.laborUnit + smtSetupPerUnit(board.setupAmount, qty)
}

/** SMT 대당 합계 = 실장비(대당) + SET-UP(총액, 수량 무관) 안분 */
function previewSmtSectionPerUnit(result: EstimateResult) {
  const qty = result.qty || 1
  const laborTotal = Math.floor(result.common.smtLaborPerUnit * qty)
  return quotePerUnitTotal(laborTotal + result.common.smtSetup, qty)
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
  multiPcb: boolean,
): PreviewRow[] {
  const rows: PreviewRow[] = []
  const useMinPlacementFee = board.laborMinApplied && board.laborMinAdjustment > 0
  const placementScore = computeSmtPlacementScore(board)

  if (useMinPlacementFee) {
    rows.push({
      label: '최소 실장비',
      subLabel: `(${placementScore}점 · ${SMT_PLACEMENT_MIN_SCORE}점 이하)`,
      unit: getSmtPlacementMinFee(quoteType),
      count: '1 PCB',
      amount: board.laborMinAdjustment,
      indent: 2,
    })
  } else {
    if (board.chip > 0) {
      rows.push({ label: 'CHIP', unit: SMT_UNIT_CHIP, count: `${board.chip}개`, amount: board.chip * SMT_UNIT_CHIP, indent: 2 })
    }
    if (board.smtOdd > 0) {
      rows.push({ label: '이형', unit: SMT_UNIT_ODD, count: `${board.smtOdd}개`, amount: board.smtOdd * SMT_UNIT_ODD, indent: 2 })
    }
    if (board.smtSpecial > 0) {
      rows.push({
        label: '특수/모듈',
        unit: SMT_UNIT_SPECIAL,
        count: `${board.smtSpecial}개`,
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

  if (board.aoiUnit > 0 && board.laborUnit > 0) {
    const sideLabel = board.smtSide === 'double' ? '양면' : '단면'
    rows.push({
      label: multiPcb
        ? `AOI 및 외관검사 (${sideLabel}) ${board.pcbName}`
        : `AOI 및 외관검사 (${sideLabel})`,
      unit: board.smtSide === 'double' ? AOI_UNIT_PRICE_DOUBLE : AOI_UNIT_PRICE_SINGLE,
      count: '1 PCB',
      amount: board.aoiUnit,
      indent: 2,
    })
  }

  if (board.setupAmount > 0) {
    rows.push({
      label: multiPcb ? `SET-UP ${board.pcbName}` : 'SET-UP',
      unit: board.setupRate,
      count: formatQuoteSetupMinutes(board.setupMinutes),
      amount: smtSetupPerUnit(board.setupAmount, result.qty),
      indent: 2,
    })
  }

  return rows
}

function dipDetailRowsForBoard(board: DipBoardDetail): PreviewRow[] {
  const rows: PreviewRow[] = []
  if (board.dipGeneral > 0) {
    rows.push({
      label: '수납땜 소형(1~3PIN)',
      unit: DIP_UNIT.dipGeneral,
      count: board.dipGeneral,
      amount: board.dipGeneral * DIP_UNIT.dipGeneral,
      indent: 2,
    })
  }
  if (board.dipConnector > 0) {
    rows.push({
      label: '수납땜 중형(4~10PIN)',
      unit: DIP_UNIT.dipConnector,
      count: board.dipConnector,
      amount: board.dipConnector * DIP_UNIT.dipConnector,
      indent: 2,
    })
  }
  if (board.dipWire > 0) {
    rows.push({
      label: '수납땜 대형(10PIN+)',
      unit: DIP_UNIT.dipWire,
      count: board.dipWire,
      amount: board.dipWire * DIP_UNIT.dipWire,
      indent: 2,
    })
  }
  if (board.waveGeneral > 0) {
    rows.push({
      label: 'WAVE 일반(1~3PIN)',
      unit: DIP_UNIT.waveGeneral,
      count: board.waveGeneral,
      amount: board.waveGeneral * DIP_UNIT.waveGeneral,
      indent: 2,
    })
  }
  if (board.waveConnector > 0) {
    rows.push({
      label: 'WAVE 중형(4~10PIN)',
      unit: DIP_UNIT.waveConnector,
      count: board.waveConnector,
      amount: board.waveConnector * DIP_UNIT.waveConnector,
      indent: 2,
    })
  }
  if (board.waveWire > 0) {
    rows.push({
      label: 'WAVE 대형(10PIN+)',
      unit: DIP_UNIT.waveWire,
      count: board.waveWire,
      amount: board.waveWire * DIP_UNIT.waveWire,
      indent: 2,
    })
  }
  return rows
}

function postDetailRows(form: PreviewFormFields, indent: number): PreviewRow[] {
  const rows: PreviewRow[] = []
  if (Number(form.postAssembly) > 0) {
    rows.push({
      label: '조립',
      unit: POST_RATE,
      count: `${form.postAssembly}분`,
      amount: Number(form.postAssembly) * POST_RATE,
      indent,
    })
  }
  if (Number(form.postTest) > 0) {
    rows.push({
      label: '테스트',
      unit: POST_RATE,
      count: `${form.postTest}분`,
      amount: Number(form.postTest) * POST_RATE,
      indent,
    })
  }
  if (Number(form.postPacking) > 0) {
    rows.push({
      label: '포장',
      unit: POST_RATE,
      count: `${form.postPacking}분`,
      amount: Number(form.postPacking) * POST_RATE,
      indent,
    })
  }
  return rows
}

function hasPostInputs(form: PreviewFormFields) {
  return Number(form.postAssembly) > 0 || Number(form.postTest) > 0 || Number(form.postPacking) > 0
}

function previewMaterialRows(result: EstimateResult, form: PreviewFormFields): PreviewRow[] {
  const materialPerUnit = Number(form.materialCost) || 0
  const subMaterialPerUnit = quotePerUnitTotal(result.common.subMaterial, result.qty)
  const hasRaw = materialPerUnit > 0
  const hasSub = result.common.subMaterial > 0
  if (!hasRaw && !hasSub) return []

  const rows: PreviewRow[] = [
    {
      label: '자재',
      amount: materialPerUnit + subMaterialPerUnit,
      emphasize: true,
      amountEmphasize: true,
      sectionTotal: 'material',
    },
  ]

  if (hasRaw) {
    rows.push({
      label: '원자재',
      unit: materialPerUnit,
      count: '1대',
      amount: materialPerUnit,
      indent: 1,
    })
  }
  if (hasSub) {
    rows.push({
      label: '부자재',
      subLabel: `(생산비용의 ${SUB_MATERIAL_RATE * 100}%)`,
      unit: subMaterialPerUnit,
      count: '1대',
      amount: subMaterialPerUnit,
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
  const qty = result.qty || 1
  const pcbCount = result.common.pcbBoardDetails.length
  const multiPcb = pcbCount > 1
  const singlePcb = pcbCount <= 1
  const postPerUnit = quotePerUnitTotal(result.values.postProcess, qty)
  const rows: PreviewRow[] = []

  for (let index = 0; index < pcbCount; index += 1) {
    const smtBoard = result.common.pcbBoardDetails[index]
    const dipBoard = result.common.dipBoardDetails[index]
    const smt = smtBoardPerUnit(smtBoard, qty)
    const dip = dipBoard?.boardUnit ?? 0
    const boardPost = singlePcb ? postPerUnit : 0
    const smtDetails = smtDetailRowsForBoard(smtBoard, result, quoteType, multiPcb)
    const dipDetails = dipBoard ? dipDetailRowsForBoard(dipBoard) : []

    rows.push({
      label: `■ ${smtBoard.pcbName}`,
      amount: smt + dip + boardPost,
      boardTotal: true,
      emphasize: true,
      amountEmphasize: true,
    })

    if (smt > 0 || smtDetails.length > 0) {
      rows.push({
        label: 'SMT',
        amount: smt,
        indent: 1,
        boardSubtotal: true,
        emphasize: true,
        amountEmphasize: true,
      })
      rows.push(...smtDetails)
    }

    if (dip > 0 || dipDetails.length > 0) {
      rows.push({
        label: '납땜',
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
        label: '후공정',
        amount: postPerUnit,
        indent: 1,
        boardSubtotal: true,
        emphasize: true,
        amountEmphasize: true,
      })
      rows.push(...postDetailRows(form, 2))
    }
  }

  if (!singlePcb && (postPerUnit > 0 || hasPostInputs(form))) {
    rows.push({
      label: '후공정 (완제품 공통)',
      amount: postPerUnit,
      emphasize: true,
      amountEmphasize: true,
      sectionTotal: 'post',
    })
    rows.push(...postDetailRows(form, 1))
  }

  rows.push(...previewMaterialRows(result, form))
  return rows
}

export function buildPreviewRows(result: EstimateResult, form: PreviewFormFields, quoteType: QuoteType) {
  return buildBoardCentricPreviewRows(result, form, quoteType)
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
  subLabel?: string
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
    const smt = smtBoardPerUnit(smtBoard, qty)
    const dip = dipBoard?.boardUnit ?? 0
    const post = postOnBoardRow ? postPerUnit : null

    return {
      pcbName: smtBoard.pcbName,
      smtPerUnit: smt,
      dipPerUnit: dip,
      postPerUnit: post,
      rowTotalPerUnit: smt + dip + (post ?? 0),
    }
  })

  const sharedPostRow = !postOnBoardRow && postPerUnit > 0 ? { postPerUnit } : null

  const materialPerUnit = Number(form.materialCost) || 0
  const subMaterialPerUnit = quotePerUnitTotal(result.common.subMaterial, qty)
  const materialRows: PreviewMatrixMaterialRow[] = []

  if (materialPerUnit > 0) {
    materialRows.push({ label: '원자재', amountPerUnit: materialPerUnit })
  }
  if (subMaterialPerUnit > 0) {
    materialRows.push({
      label: '부자재',
      subLabel: `(생산비용의 ${SUB_MATERIAL_RATE * 100}%)`,
      amountPerUnit: subMaterialPerUnit,
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
    materialTotalPerUnit: materialPerUnit + subMaterialPerUnit,
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
