import {
  DIP_UNIT,
  POST_RATE,
  getAoiUnit,
  PCB_WASH_UNIT,
  SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART,
  SMT_SETUP_MINUTES_PER_PART,
  SMT_PLACEMENT_MIN_SCORE,
  getSmtSetupBaseMinutes,
  getSmtSetupRate,
  getSmtPlacementMinFee,
  SMT_UNIT_BGA_BALL,
  SMT_UNIT_CHIP,
  SMT_UNIT_IC_PIN,
  SMT_UNIT_ODD,
  SMT_UNIT_SPECIAL,
  RAW_MATERIAL_MANAGEMENT_RATE,
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

function computeSmtOtherLabor(input: SmtComponentFields) {
  return (
    (Number(input.smtSpecial) || 0) * SMT_UNIT_SPECIAL +
    (Number(input.icPin) || 0) * SMT_UNIT_IC_PIN +
    (Number(input.bga) || 0) * SMT_UNIT_BGA_BALL
  )
}

function computeBoardInspection(board: SmtPcbBoard, quoteType: QuoteType = 'export') {
  const smtSide = board.smtSide === 'double' ? 'double' : 'single'
  const aoiInspectionUnit = board.aoiEnabled ? getAoiUnit(smtSide) : 0
  const pcbWashUnit =
    quoteType === 'domestic' && board.pcbWashEnabled ? PCB_WASH_UNIT : 0

  return {
    aoiInspectionUnit,
    xrayInspectionUnit: 0,
    visualInspectionUnit: 0,
    pcbWashUnit,
    inspectionUnit: aoiInspectionUnit + pcbWashUnit,
  }
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

export function getSmtSetupPartCount(board: Pick<SmtPcbBoard, 'smtSide' | 'smtTopCount' | 'smtBotCount'>) {
  const smtSide = board.smtSide === 'double' ? 'double' : 'single'
  const top = Number(board.smtTopCount) || 0
  const bot = Number(board.smtBotCount) || 0
  return smtSide === 'double' ? top + bot : top
}

export type SmtSetupBillingBreakdown = {
  partCount: number
  baseMinutes: number
  firstArticleMinutes: number
  settingMinutes: number
  totalMinutes: number
}

/** SET-UP 청구 분 = 기본시간 + 초품검사(종당 20초) + SETTING(종당 3분) */
export function computeSmtSetupBillingBreakdown(
  partCount: number,
  smtSide: 'single' | 'double',
): SmtSetupBillingBreakdown {
  const count = Math.max(0, Math.floor(Number(partCount) || 0))
  if (count <= 0) {
    return { partCount: 0, baseMinutes: 0, firstArticleMinutes: 0, settingMinutes: 0, totalMinutes: 0 }
  }

  const baseMinutes = getSmtSetupBaseMinutes(smtSide)
  const firstArticleMinutes = (count * SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART) / 60
  const settingMinutes = count * SMT_SETUP_MINUTES_PER_PART
  return {
    partCount: count,
    baseMinutes,
    firstArticleMinutes,
    settingMinutes,
    totalMinutes: baseMinutes + firstArticleMinutes + settingMinutes,
  }
}

export function computeSmtSetupBillingMinutes(
  partCount: number,
  smtSide: 'single' | 'double',
): number {
  return computeSmtSetupBillingBreakdown(partCount, smtSide).totalMinutes
}

function computeSmtSetup(partCount: number, quoteType: QuoteType, smtSide: 'single' | 'double') {
  const count = Math.max(0, Math.floor(Number(partCount) || 0))
  if (count <= 0) {
    return { setupMinutes: 0, setupAmount: 0, setupMinApplied: false, setupRate: 0 }
  }

  const setupMinutes = computeSmtSetupBillingMinutes(count, smtSide)
  const setupRate = getSmtSetupRate(quoteType)
  return {
    setupMinutes,
    setupAmount: setupMinutes * setupRate,
    setupMinApplied: true,
    setupRate,
  }
}

export function computeSmtPlacementScore(input: SmtComponentFields) {
  return (
    (Number(input.chip) || 0) +
    (Number(input.smtOdd) || 0) +
    (Number(input.smtSpecial) || 0) +
    (Number(input.icPin) || 0) +
    (Number(input.bga) || 0)
  )
}

function shouldApplyMinPlacementFee(input: SmtComponentFields) {
  const score = computeSmtPlacementScore(input)
  return score > 0 && score <= SMT_PLACEMENT_MIN_SCORE
}

function computeSmtLaborPerUnit(board: SmtPcbBoard, quoteType: QuoteType) {
  const comp = readSmtBoardComponentFields(board)
  const chipTotal = computeSmtChipTotal(comp)
  const chipOddLabor = computeSmtChipOddLabor(comp)
  const otherLabor = computeSmtOtherLabor(comp)
  const smtLaborRaw = chipOddLabor + otherLabor
  const hasPlacementInputs = hasSmtComponentInputs(comp)
  const hasSmtLabor = smtLaborRaw > 0 || hasPlacementInputs
  const applyMinFee = hasPlacementInputs && shouldApplyMinPlacementFee(comp)
  const minPlacementFee = getSmtPlacementMinFee(quoteType)

  const smtLaborUnit = applyMinFee
    ? minPlacementFee
    : hasSmtLabor
      ? chipOddLabor + otherLabor
      : 0

  return {
    smtLaborUnit,
    smtLaborRaw,
    smtLaborMinApplied: applyMinFee,
    smtLaborMinAdjustment: applyMinFee ? minPlacementFee : 0,
    chipTotal,
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
  let inspectionUnit = 0
  const boardDetails: SmtBoardDetail[] = []

  for (const board of pcbBoards) {
    const lab = computeSmtLaborPerUnit(board, quoteType)
    const inspection = computeBoardInspection(board, quoteType)
    laborUnit += lab.smtLaborUnit
    laborRaw += lab.smtLaborRaw
    laborMinAdj += lab.smtLaborMinAdjustment
    if (lab.smtLaborMinApplied) anyLaborMin = true
    inspectionUnit += inspection.inspectionUnit

    const smtSide = board.smtSide === 'double' ? 'double' : 'single'
    const partCount = getSmtSetupPartCount(board)
    const setup = computeSmtSetup(partCount, quoteType, smtSide)
    const setupMinutes = setup.setupMinutes
    const setupAmt = setup.setupAmount
    const setupMinApplied = setup.setupMinApplied
    setupPartCountTotal += partCount

    setupTotal += setupAmt

    boardDetails.push({
      ...board,
      pcbWashEnabled: quoteType === 'domestic' && board.pcbWashEnabled === true,
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
      aoiInspectionUnit: inspection.aoiInspectionUnit,
      xrayInspectionUnit: inspection.xrayInspectionUnit,
      visualInspectionUnit: inspection.visualInspectionUnit,
      inspectionUnit: inspection.inspectionUnit,
      pcbWashUnit: inspection.pcbWashUnit,
    })
  }

  return {
    smtLaborUnit: laborUnit,
    smtLaborRaw: laborRaw,
    smtLaborMinApplied: anyLaborMin,
    smtLaborMinAdjustment: laborMinAdj,
    smtSetupAmount: setupTotal,
    setupPartCount: setupPartCountTotal,
    smtInspectionPerUnit: inspectionUnit,
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
  const quoteNumber = data.existingQuoteNumber ? String(data.existingQuoteNumber) : '저장 시 자동 발급'

  const pcbBoards = normalizeSmtPcbBoards(data)
  const smtAgg = aggregateSmtFromPcbBoards(pcbBoards, quoteType)
  const smtUnit = smtAgg.smtLaborUnit
  const smtSetupAmount = smtAgg.smtSetupAmount
  const setupPartCount = smtAgg.setupPartCount
  const smtInspectionPerUnit = smtAgg.smtInspectionPerUnit

  const dipBoards = normalizeDipPcbBoards(data)
  const dipAgg = aggregateDipFromPcbBoards(dipBoards)
  const dipUnit = dipAgg.dipUnit

  const postAssembly = Number(data.postAssembly) || 0
  const postTest = Number(data.postTest) || 0
  const postPacking = Number(data.postPacking) || 0
  const postProcessUnit = (postAssembly + postTest + postPacking) * POST_RATE
  const matUnit = Number(data.materialCost) || 0

  const matTotalRaw = matUnit * qty
  const smtTotal = smtUnit * qty + smtSetupAmount + smtInspectionPerUnit * qty
  const dipTotal = dipUnit * qty
  const postProcessTotal = postProcessUnit * qty
  const laborFinal = smtTotal + dipTotal + postProcessTotal
  const materialManagementTotal =
    matTotalRaw > 0 ? matTotalRaw * RAW_MATERIAL_MANAGEMENT_RATE : 0

  const subtotalBeforeDiscount = laborFinal + matTotalRaw + materialManagementTotal
  let specialDiscount = Math.max(0, Number(data.specialDiscount) || 0)
  if (specialDiscount > subtotalBeforeDiscount) specialDiscount = subtotalBeforeDiscount
  const grandTotal = subtotalBeforeDiscount - specialDiscount
  const unitTotal = grandTotal / (qty || 1)

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
      grandTotal,
    },
    common: {
      smtSetup: smtSetupAmount,
      smtSetupPartCount: setupPartCount,
      smtInspectionPerUnit,
      smtLaborPerUnit: smtAgg.smtLaborUnit,
      smtLaborRawPerUnit: smtAgg.smtLaborRaw,
      smtLaborMinApplied: smtAgg.smtLaborMinApplied,
      smtLaborMinAdjustment: smtAgg.smtLaborMinAdjustment,
      pcbBoardCount: Number(data.pcbBoardCount) || pcbBoards.length,
      pcbBoardDetails: smtAgg.boardDetails,
      dipBoardDetails: dipAgg.boardDetails,
      subMaterial: 0,
      materialManagement: materialManagementTotal,
      specialDiscount,
      subtotalBeforeDiscount,
      unitTotal: formatEstimateNumber(unitTotal),
      grandTotal: formatEstimateNumber(grandTotal),
    },
  }
}

function formatEstimateNumber(value: number) {
  const isWhole = Math.abs(value - Math.round(value)) < 1e-9
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  })
}
