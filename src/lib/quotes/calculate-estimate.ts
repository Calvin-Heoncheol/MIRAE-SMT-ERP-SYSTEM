import {
  computeMetalMaskCostTotal,
  normalizeMetalMaskSide,
  computeSampleCostTotal,
  DIP_UNIT,
  getAoiUnit,
  getPostRate,
  SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART,
  SMT_PLACEMENT_MIN_SCORE,
  getSmtSetupBaseMinutes,
  getSmtSetupMinutesPerPart,
  getSmtSetupRate,
  getSmtPlacementMinFee,
  getSmtUnitRates,
  isMultiSideSmt,
  normalizeSmtSide,
  RAW_MATERIAL_MANAGEMENT_RATE,
  computePostProcessProfitAmount,
  toBillingSmtSide,
} from './constants'
import type {
  DipBoardDetail,
  DipPcbBoard,
  EstimateInput,
  EstimateResult,
  QuoteType,
  SmtBoardDetail,
  SmtPcbBoard,
  SmtSide,
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

/** SMD 항목(CHIP·ODD 등) 대당 금액 — 견적서 행 표시와 합계가 일치하도록 항목별 원 단위 반올림 */
export function smtLineAmount(count: number, rate: number) {
  return Math.round((Number(count) || 0) * rate)
}

function computeSmtChipOddLabor(
  input: SmtComponentFields,
  quoteType: QuoteType = 'export',
) {
  const rates = getSmtUnitRates(quoteType)
  return smtLineAmount(input.chip, rates.chip) + smtLineAmount(input.smtOdd, rates.odd)
}

function computeSmtOtherLabor(
  input: SmtComponentFields,
  quoteType: QuoteType = 'export',
) {
  const rates = getSmtUnitRates(quoteType)
  return (
    smtLineAmount(input.smtSpecial, rates.special) +
    smtLineAmount(input.icPin, rates.icPin) +
    smtLineAmount(input.bga, rates.bgaBall)
  )
}

function computeBoardInspection(board: SmtPcbBoard, _quoteType: QuoteType = 'export') {
  const smtSide = toBillingSmtSide(board.smtSide)
  const comp = readSmtBoardComponentFields(board)
  const aoiInspectionUnit = hasSmtComponentInputs(comp) ? getAoiUnit(smtSide) : 0

  return {
    aoiInspectionUnit,
    xrayInspectionUnit: 0,
    visualInspectionUnit: 0,
    pcbWashUnit: 0,
    inspectionUnit: aoiInspectionUnit,
  }
}

function computeSmtChipTotal(
  input: SmtComponentFields,
  quoteType: QuoteType = 'export',
) {
  return computeSmtChipOddLabor(input, quoteType) + computeSmtOtherLabor(input, quoteType)
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
  const top = Number(board.smtTopCount) || 0
  const bot = Number(board.smtBotCount) || 0
  return isMultiSideSmt(board.smtSide) ? top + bot : top
}

export type SmtSetupBillingBreakdown = {
  partCount: number
  baseMinutes: number
  firstArticleMinutes: number
  settingMinutes: number
  totalMinutes: number
}

/** SET-UP 청구 분 = 기본시간 + 초품검사(종당 20초) + SETTING(국내 종당 2분 / 해외 종당 3분) */
export function computeSmtSetupBillingBreakdown(
  partCount: number,
  smtSide: SmtSide | 'single' | 'double',
  quoteType: QuoteType = 'export',
): SmtSetupBillingBreakdown {
  const count = Math.max(0, Math.floor(Number(partCount) || 0))
  if (count <= 0) {
    return { partCount: 0, baseMinutes: 0, firstArticleMinutes: 0, settingMinutes: 0, totalMinutes: 0 }
  }

  const baseMinutes = getSmtSetupBaseMinutes(smtSide, quoteType)
  const firstArticleMinutes = (count * SMT_SETUP_FIRST_ARTICLE_SECONDS_PER_PART) / 60
  const settingMinutes = count * getSmtSetupMinutesPerPart(quoteType)
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
  smtSide: SmtSide | 'single' | 'double',
  quoteType: QuoteType = 'export',
): number {
  return computeSmtSetupBillingBreakdown(partCount, smtSide, quoteType).totalMinutes
}

/** 발주 1회 금액의 대당(원) — 견적서 행 표시와 동일한 반올림 */
export function orderLevelPerUnit(amount: number, qty: number) {
  return Math.round((Number(amount) || 0) / (qty || 1))
}

/**
 * SET-UP 금액 = (기본시간·초품검사·SETTING 항목별 대당 원 반올림 합) × 수량.
 * 견적서에 보이는 항목별 대당 금액의 합이 대당단가·합계와 1원도 어긋나지 않게 한다.
 */
function computeSmtSetup(
  partCount: number,
  quoteType: QuoteType,
  smtSide: SmtSide | 'single' | 'double',
  qty: number,
) {
  const count = Math.max(0, Math.floor(Number(partCount) || 0))
  if (count <= 0) {
    return { setupMinutes: 0, setupAmount: 0, setupMinApplied: false, setupRate: 0 }
  }

  const breakdown = computeSmtSetupBillingBreakdown(count, smtSide, quoteType)
  const setupRate = getSmtSetupRate(quoteType)
  const safeQty = qty || 1
  const setupPerUnit =
    orderLevelPerUnit(breakdown.baseMinutes * setupRate, safeQty) +
    orderLevelPerUnit(breakdown.firstArticleMinutes * setupRate, safeQty) +
    orderLevelPerUnit(breakdown.settingMinutes * setupRate, safeQty)
  return {
    setupMinutes: breakdown.totalMinutes,
    setupAmount: setupPerUnit * safeQty,
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
  const chipTotal = computeSmtChipTotal(comp, quoteType)
  const chipOddLabor = computeSmtChipOddLabor(comp, quoteType)
  const otherLabor = computeSmtOtherLabor(comp, quoteType)
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
        smtSide: normalizeSmtSide(board.smtSide),
        aoiEnabled: board.aoiEnabled !== false,
        pcbWashEnabled: false,
        smtTopCount: Number(board.smtTopCount) || 0,
        smtBotCount: Number(board.smtBotCount) || 0,
        ...comp,
      }
    })
  }

  return [
    {
      pcbName: 'PCB 1',
      smtSide: normalizeSmtSide(data.smtSide),
      aoiEnabled: true,
      pcbWashEnabled: false,
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

export function aggregateSmtFromPcbBoards(
  pcbBoards: SmtPcbBoard[],
  quoteType: QuoteType = 'export',
  qty = 1,
) {
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

    const smtSide = toBillingSmtSide(board.smtSide)
    const partCount = getSmtSetupPartCount(board)
    const setup = computeSmtSetup(partCount, quoteType, smtSide, qty)
    const setupMinutes = setup.setupMinutes
    const setupAmt = setup.setupAmount
    const setupMinApplied = setup.setupMinApplied
    setupPartCountTotal += partCount

    setupTotal += setupAmt

    boardDetails.push({
      ...board,
      pcbWashEnabled: false,
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
  const quoteNumber = data.existingQuoteNumber
    ? String(data.existingQuoteNumber)
    : '저장 시 MRQ-YYMMDD-NN 자동 발급'

  const pcbBoards = normalizeSmtPcbBoards(data)
  const smtAgg = aggregateSmtFromPcbBoards(pcbBoards, quoteType, qty || 1)
  const smtUnit = smtAgg.smtLaborUnit
  const smtSetupAmount = smtAgg.smtSetupAmount
  const setupPartCount = smtAgg.setupPartCount
  const smtInspectionPerUnit = smtAgg.smtInspectionPerUnit

  const dipBoards = normalizeDipPcbBoards(data)
  const dipAgg = aggregateDipFromPcbBoards(dipBoards)
  const dipUnit = dipAgg.dipUnit

  const postAssembly = Number(data.postAssembly) || 0
  const postDownload = Number(data.postDownload) || 0
  const postTest = Number(data.postTest) || 0
  const postPacking = Number(data.postPacking) || 0
  const postProcessUnit =
    (postAssembly + postDownload + postTest + postPacking) * getPostRate(quoteType)
  const matUnit =
    data.includeMaterialCosts === false ? 0 : Number(data.materialCost) || 0
  const includeMetalMask = data.includeMetalMask !== false
  const metalMaskTotal = includeMetalMask
    ? Math.max(
        0,
        Math.round(Number(data.metalMaskCost) || 0) ||
          computeMetalMaskCostTotal(pcbBoards, true, normalizeMetalMaskSide(data.metalMaskSide)),
      )
    : 0
  const sampleCostTotal =
    orderLevelPerUnit(computeSampleCostTotal(qty, pcbBoards, data.productionKind), qty || 1) *
    (qty || 1)

  const matTotalRaw = matUnit * qty
  const smtPlacementTotal = smtUnit * qty + smtInspectionPerUnit * qty
  const smtTotal = smtPlacementTotal + smtSetupAmount
  const orderLevelTotal = smtSetupAmount + metalMaskTotal + sampleCostTotal
  const dipTotal = dipUnit * qty
  const postProcessTotal = postProcessUnit * qty
  const dipSectionTotal = dipTotal + postProcessTotal
  const smtAuxiliaryMaterialTotal = 0
  /** 후공정 부자재는 견적에 미포함(항상 0). 필드 호환용 */
  const postAuxiliaryMaterialTotal = 0
  const auxiliaryMaterialTotal = smtAuxiliaryMaterialTotal
  /** 기업이윤 — 견적 미포함(항상 0) */
  const postProcessProfitTotal = computePostProcessProfitAmount(0)
  const laborFinal = smtTotal + dipTotal + postProcessTotal
  const materialManagementTotal =
    data.includeMaterialCosts === false || matTotalRaw <= 0
      ? 0
      : matTotalRaw * RAW_MATERIAL_MANAGEMENT_RATE

  const subtotalBeforeDiscount =
    laborFinal +
    matTotalRaw +
    materialManagementTotal +
    metalMaskTotal +
    sampleCostTotal +
    auxiliaryMaterialTotal +
    postProcessProfitTotal
  let specialDiscount = Math.max(0, Number(data.specialDiscount) || 0)
  if (specialDiscount > subtotalBeforeDiscount) specialDiscount = subtotalBeforeDiscount
  const rawGrandTotal = subtotalBeforeDiscount - specialDiscount
  const safeQty = qty || 1
  /** 대당(원) 반올림 × 수량 + 메탈마스크(일회성, 대당단가 미포함) = 합계 */
  const metalMaskInTotal = Math.min(metalMaskTotal, Math.max(0, rawGrandTotal))
  const unitTotal = Math.round((rawGrandTotal - metalMaskInTotal) / safeQty)
  const grandTotal = unitTotal * safeQty + metalMaskInTotal

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
      unitPrice: unitTotal,
      metalMask: metalMaskInTotal,
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
      subMaterial: metalMaskTotal,
      sampleCost: sampleCostTotal,
      orderLevelTotal,
      smtPlacementTotal,
      smtAuxiliaryMaterial: smtAuxiliaryMaterialTotal,
      postAuxiliaryMaterial: postAuxiliaryMaterialTotal,
      /** 기업이윤 — 견적 미포함(항상 0) */
      postProcessProfit: postProcessProfitTotal,
      auxiliaryMaterial: auxiliaryMaterialTotal,
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
