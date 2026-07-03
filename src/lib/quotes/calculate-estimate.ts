import {
  AOI_UNIT_PRICE_DOUBLE,
  AOI_UNIT_PRICE_SINGLE,
  DIP_UNIT,
  PCB_WASH_UNIT_PRICE,
  POST_RATE,
  SMT_SETUP_BASE_MINUTES,
  SMT_SETUP_MINUTES_PER_PART,
  SMT_PLACEMENT_MIN_SCORE,
  getSmtSetupRate,
  getSmtPlacementMinFee,
  SMT_UNIT_BGA_BALL,
  SMT_UNIT_CHIP,
  SMT_UNIT_IC_PIN,
  SMT_UNIT_ODD,
  SMT_UNIT_SPECIAL,
  SUB_MATERIAL_RATE,
} from './constants'
import type {
  DipBoardDetail,
  DipPcbBoard,
  EstimateInput,
  EstimateResult,
  QuoteType,
  SmtBoardDetail,
  SmtPcbBoard,
} from './types'
import { generateQuoteNumberPreview } from './utils'

type SmtComponentFields = Pick<SmtPcbBoard, 'chip' | 'icPin' | 'bga' | 'smtOdd' | 'smtSpecial'>

function readSmtBoardComponentFields(board: Partial<SmtPcbBoard>): SmtComponentFields {
  return {
    chip: Number(board.chip) || 0,
    icPin: Number(board.icPin) || 0,
    bga: Number(board.bga) || 0,
    smtOdd: Number(board.smtOdd) || 0,
    smtSpecial: Number(board.smtSpecial) || 0,
  }
}

function computeSmtChipOddLabor(input: SmtComponentFields) {
  return (
    (Number(input.chip) || 0) * SMT_UNIT_CHIP + (Number(input.smtOdd) || 0) * SMT_UNIT_ODD
  )
}

function computeSmtOtherLabor(
  input: SmtComponentFields,
  aoiUnit: number,
  pcbWashUnit: number,
) {
  return (
    (Number(input.smtSpecial) || 0) * SMT_UNIT_SPECIAL +
    (Number(input.icPin) || 0) * SMT_UNIT_IC_PIN +
    (Number(input.bga) || 0) * SMT_UNIT_BGA_BALL +
    aoiUnit +
    pcbWashUnit
  )
}

function computeSmtChipTotal(input: SmtComponentFields) {
  const chip = Number(input.chip) || 0
  const smtOdd = Number(input.smtOdd) || 0
  const smtSpecial = Number(input.smtSpecial) || 0

  return (
    chip * SMT_UNIT_CHIP +
    smtOdd * SMT_UNIT_ODD +
    smtSpecial * SMT_UNIT_SPECIAL +
    (Number(input.icPin) || 0) * SMT_UNIT_IC_PIN +
    (Number(input.bga) || 0) * SMT_UNIT_BGA_BALL
  )
}

function hasSmtComponentInputs(input: SmtComponentFields) {
  return (
    (Number(input.chip) || 0) +
      (Number(input.smtOdd) || 0) +
      (Number(input.smtSpecial) || 0) +
      (Number(input.icPin) || 0) +
      (Number(input.bga) || 0) >
    0
  )
}

function computeSmtSetup(partCount: number, quoteType: QuoteType, smtSide: 'single' | 'double') {
  const count = Math.max(0, Math.floor(Number(partCount) || 0))
  if (count <= 0) {
    return { setupMinutes: 0, setupAmount: 0, setupMinApplied: false, setupRate: 0 }
  }

  const setupMinutes =
    SMT_SETUP_BASE_MINUTES + count * SMT_SETUP_MINUTES_PER_PART
  const setupRate = getSmtSetupRate(quoteType, smtSide)
  return {
    setupMinutes,
    setupAmount: setupMinutes * setupRate,
    setupMinApplied: true,
    setupRate,
  }
}

function computeSmtPlacementScore(input: SmtComponentFields) {
  return (Number(input.chip) || 0) + (Number(input.smtOdd) || 0)
}

function shouldApplyMinPlacementFee(input: SmtComponentFields) {
  const score = computeSmtPlacementScore(input)
  return score > 0 && score <= SMT_PLACEMENT_MIN_SCORE
}

function computeSmtLaborPerUnit(board: SmtPcbBoard, quoteType: QuoteType) {
  const comp = readSmtBoardComponentFields(board)
  const chipTotal = computeSmtChipTotal(comp)
  const smtSide = board.smtSide === 'double' ? 'double' : 'single'
  const aoiEnabled = board.aoiEnabled === true
  const pcbWashEnabled = board.pcbWashEnabled === true
  const aoiUnit = aoiEnabled ? (smtSide === 'double' ? AOI_UNIT_PRICE_DOUBLE : AOI_UNIT_PRICE_SINGLE) : 0
  const pcbWashUnit = pcbWashEnabled ? PCB_WASH_UNIT_PRICE : 0
  const chipOddLabor = computeSmtChipOddLabor(comp)
  const otherLabor = computeSmtOtherLabor(comp, aoiUnit, pcbWashUnit)
  const smtLaborRaw = chipOddLabor + otherLabor
  const hasChipOdd = computeSmtPlacementScore(comp) > 0
  const hasSmtLabor =
    smtLaborRaw > 0 || hasSmtComponentInputs(comp) || aoiEnabled || pcbWashEnabled
  const applyMinFee = hasChipOdd && shouldApplyMinPlacementFee(comp)
  const minPlacementFee = getSmtPlacementMinFee(quoteType)

  const smtLaborUnit = applyMinFee
    ? minPlacementFee + aoiUnit
    : hasSmtLabor
      ? chipOddLabor + otherLabor
      : 0

  return {
    smtLaborUnit,
    smtLaborRaw,
    smtLaborMinApplied: applyMinFee,
    smtLaborMinAdjustment: applyMinFee ? minPlacementFee : 0,
    chipTotal,
    aoiUnit,
    pcbWashUnit,
  }
}

export function normalizeSmtPcbBoards(data: EstimateInput): SmtPcbBoard[] {
  const src = data.pcbBoards?.length ? data.pcbBoards : null
  if (src) {
    return src.map((board, index) => {
      const comp = readSmtBoardComponentFields(board)
      return {
        pcbName: String(board.pcbName || `PCB ${index + 1}`).trim() || `PCB ${index + 1}`,
        smtSide: board.smtSide === 'double' ? 'double' : 'single',
        aoiEnabled: board.aoiEnabled === true,
        pcbWashEnabled: board.pcbWashEnabled === true,
        smtTopCount: Number(board.smtTopCount) || 0,
        smtBotCount: Number(board.smtBotCount) || 0,
        ...comp,
      }
    })
  }

  return [
    {
      pcbName: 'PCB 1',
      smtSide: data.smtSide === 'double' ? 'double' : 'single',
      aoiEnabled: data.aoiEnabled === true,
      pcbWashEnabled: data.pcbWashEnabled === true,
      smtTopCount: Number(data.smtTopCount) || 0,
      smtBotCount: Number(data.smtBotCount) || 0,
      ...readSmtBoardComponentFields(data),
    },
  ]
}

export function normalizeDipPcbBoards(data: EstimateInput): DipPcbBoard[] {
  const src = data.dipBoards?.length ? data.dipBoards : null
  if (src) {
    return src.map((board, index) => ({
      pcbName: String(board.pcbName || `PCB ${index + 1}`).trim() || `PCB ${index + 1}`,
      dipGeneral: Number(board.dipGeneral) || 0,
      dipConnector: Number(board.dipConnector) || 0,
      dipWire: Number(board.dipWire) || 0,
      waveGeneral: Number(board.waveGeneral) || 0,
      waveConnector: Number(board.waveConnector) || 0,
      waveWire: Number(board.waveWire) || 0,
    }))
  }

  return [
    {
      pcbName: 'PCB 1',
      dipGeneral: Number(data.dipGeneral) || 0,
      dipConnector: Number(data.dipConnector) || 0,
      dipWire: Number(data.dipWire) || 0,
      waveGeneral: Number(data.waveGeneral) || 0,
      waveConnector: Number(data.waveConnector) || 0,
      waveWire: Number(data.waveWire) || 0,
    },
  ]
}

function computeDipBoardUnit(board: DipPcbBoard) {
  return (
    (Number(board.dipGeneral) || 0) * DIP_UNIT.dipGeneral +
    (Number(board.dipConnector) || 0) * DIP_UNIT.dipConnector +
    (Number(board.dipWire) || 0) * DIP_UNIT.dipWire +
    (Number(board.waveGeneral) || 0) * DIP_UNIT.waveGeneral +
    (Number(board.waveConnector) || 0) * DIP_UNIT.waveConnector +
    (Number(board.waveWire) || 0) * DIP_UNIT.waveWire
  )
}

export function aggregateSmtFromPcbBoards(pcbBoards: SmtPcbBoard[], quoteType: QuoteType = 'export') {
  let laborUnit = 0
  let laborRaw = 0
  let laborMinAdj = 0
  let anyLaborMin = false
  let setupTotal = 0
  let setupPartCountTotal = 0
  const boardDetails: SmtBoardDetail[] = []

  for (const board of pcbBoards) {
    const lab = computeSmtLaborPerUnit(board, quoteType)
    laborUnit += lab.smtLaborUnit
    laborRaw += lab.smtLaborRaw
    laborMinAdj += lab.smtLaborMinAdjustment
    if (lab.smtLaborMinApplied) anyLaborMin = true

    const smtSide = board.smtSide === 'double' ? 'double' : 'single'
    const partCount = Number(board.smtTopCount) || 0
    const setup = computeSmtSetup(partCount, quoteType, smtSide)
    const setupMinutes = setup.setupMinutes
    const setupAmt = setup.setupAmount
    const setupMinApplied = setup.setupMinApplied
    setupPartCountTotal += partCount

    setupTotal += setupAmt

    boardDetails.push({
      ...board,
      setupPartCount: partCount,
      setupMinutes,
      setupMinApplied,
      setupAmount: setupAmt,
      setupRate: setup.setupRate,
      laborUnit: lab.smtLaborUnit,
      laborRaw: lab.smtLaborRaw,
      laborMinApplied: lab.smtLaborMinApplied,
      laborMinAdjustment: lab.smtLaborMinAdjustment,
      chipTotal: lab.chipTotal,
      aoiUnit: lab.aoiUnit,
      pcbWashUnit: lab.pcbWashUnit,
    })
  }

  return {
    smtLaborUnit: laborUnit,
    smtLaborRaw: laborRaw,
    smtLaborMinApplied: anyLaborMin,
    smtLaborMinAdjustment: laborMinAdj,
    smtSetupAmount: setupTotal,
    setupPartCount: setupPartCountTotal,
    boardDetails,
  }
}

export function aggregateDipFromPcbBoards(dipBoards: DipPcbBoard[]) {
  let unit = 0
  const boardDetails: DipBoardDetail[] = []

  for (const board of dipBoards) {
    const boardUnit = computeDipBoardUnit(board)
    unit += boardUnit
    boardDetails.push({ ...board, boardUnit })
  }

  return { dipUnit: unit, boardDetails }
}

function formatSeoulDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

export function calculateEstimate(
  data: EstimateInput,
  options: { existingQuoteNumbers?: string[] } = {},
): EstimateResult {
  const qty = Number(data.boardQty) || 0
  const today = formatSeoulDate()
  const quoteType = data.quoteType === 'domestic' ? 'domestic' : 'export'
  const quoteNumber = data.existingQuoteNumber
    ? String(data.existingQuoteNumber)
    : generateQuoteNumberPreview(quoteType, options.existingQuoteNumbers || [])

  const pcbBoards = normalizeSmtPcbBoards(data)
  const smtAgg = aggregateSmtFromPcbBoards(pcbBoards, quoteType)
  const smtUnit = smtAgg.smtLaborUnit
  const smtSetupAmount = smtAgg.smtSetupAmount
  const setupPartCount = smtAgg.setupPartCount

  const dipBoards = normalizeDipPcbBoards(data)
  const dipAgg = aggregateDipFromPcbBoards(dipBoards)
  const dipUnit = dipAgg.dipUnit

  const postAssembly = Number(data.postAssembly) || 0
  const postTest = Number(data.postTest) || 0
  const postPacking = Number(data.postPacking) || 0
  const postProcessUnit = (postAssembly + postTest + postPacking) * POST_RATE
  const matUnit = Number(data.materialCost) || 0

  const matTotalRaw = matUnit * qty
  const smtTotal = Math.floor(smtUnit * qty) + smtSetupAmount
  const dipTotal = Math.floor(dipUnit * qty)
  const postProcessTotal = Math.floor(postProcessUnit * qty)
  const laborFinal = smtTotal + dipTotal + postProcessTotal
  const subMaterialTotal = Math.round(laborFinal * SUB_MATERIAL_RATE)

  const subtotalBeforeDiscount = laborFinal + matTotalRaw + subMaterialTotal
  let specialDiscount = Math.max(0, Math.round(Number(data.specialDiscount) || 0))
  if (specialDiscount > subtotalBeforeDiscount) specialDiscount = subtotalBeforeDiscount
  const grandTotal = subtotalBeforeDiscount - specialDiscount

  return {
    estNo: quoteNumber,
    date: today,
    qty,
    values: {
      smt: smtTotal,
      dip: dipTotal,
      postProcess: postProcessTotal,
      assy: postProcessTotal,
      laborMarkup: 0,
      specialDiscount,
      subtotalBeforeDiscount,
      grandTotal: Math.floor(grandTotal),
    },
    common: {
      smtSetup: smtSetupAmount,
      smtSetupPartCount: setupPartCount,
      smtLaborPerUnit: smtAgg.smtLaborUnit,
      smtLaborRawPerUnit: smtAgg.smtLaborRaw,
      smtLaborMinApplied: smtAgg.smtLaborMinApplied,
      smtLaborMinAdjustment: smtAgg.smtLaborMinAdjustment,
      pcbBoardCount: Number(data.pcbBoardCount) || pcbBoards.length,
      pcbBoardDetails: smtAgg.boardDetails,
      dipBoardDetails: dipAgg.boardDetails,
      subMaterial: subMaterialTotal,
      specialDiscount,
      subtotalBeforeDiscount,
      unitTotal: Math.floor(grandTotal / (qty || 1)).toLocaleString('ko-KR'),
      grandTotal: Math.floor(grandTotal).toLocaleString('ko-KR'),
    },
  }
}
