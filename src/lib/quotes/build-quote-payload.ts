import type {
  DipPcbBoard,
  EstimateResult,
  PostProcessLine,
  QuoteDetailInfo,
  QuoteStatus,
  QuoteType,
  SmtPcbBoard,
} from './types'
import { postProcessLinesToModels, sumPostProcessLineMinutes } from './post-process-lines'
import type { PostProcessLineForm } from './post-process-lines'
import { getPostRate } from './constants'

export type QuoteFormSnapshot = {
  customer: string
  productName: string
  /** 품목마스터에서 고른 경우 품목 id */
  productId?: string
  quoteStatus?: QuoteStatus
  boardQty: string
  pcbBoardCount: string
  materialCost: string
  metalMaskCost?: string
  /** @deprecated 합계는 카테고리 라인에서 산출 */
  postAssembly?: string
  postDownload?: string
  postTest?: string
  postPacking?: string
  specialDiscount: string
  productionKind?: '샘플' | '양산'
  includeSmd?: boolean
  includeDip?: boolean
  /** false = 원자재·관리비 제외 */
  includeMaterialCosts?: boolean
  includeMetalMask?: boolean
  /** @deprecated 카테고리별 배열 사용 */
  postProcessLines?: PostProcessLineForm[]
  assemblyLines?: PostProcessLineForm[]
  downloadLines?: PostProcessLineForm[]
  testLines?: PostProcessLineForm[]
  packingLines?: PostProcessLineForm[]
}

export type QuoteRowPayload = {
  quote_date: string
  customer: string
  product_name: string
  board_qty: number
  total_amount: number
  detail_info: QuoteDetailInfo
  status?: QuoteStatus
}

export function buildQuoteDetailInfo(
  form: QuoteFormSnapshot,
  pcbBoards: SmtPcbBoard[],
  dipBoards: DipPcbBoard[],
  result: EstimateResult,
  quoteType: QuoteType,
  quoteStatus: QuoteStatus = 'draft',
): QuoteDetailInfo {
  const sanitizedPcbBoards = pcbBoards.map((board) => ({
    ...board,
    aoiEnabled: board.aoiEnabled !== false,
    pcbWashEnabled: board.pcbWashEnabled === true,
  }))
  const b0 = sanitizedPcbBoards[0]
  const d0 = dipBoards[0]
  const qty = result.qty || 0
  const includeMaterialCosts = form.includeMaterialCosts !== false
  const materialCostPerUnit = includeMaterialCosts ? Number(form.materialCost) || 0 : 0
  const metalMaskCost = Math.max(0, Math.round(result.common.subMaterial || 0))
  const sampleCost = Math.max(0, Math.round(result.common.sampleCost || 0))
  const auxiliaryMaterialCostPerUnit =
    (result.common.auxiliaryMaterial || 0) / (qty || 1)
  const productionKind = form.productionKind === '샘플' ? '샘플' : '양산'
  const postRate = getPostRate(quoteType)

  const assemblyLines: PostProcessLine[] = form.assemblyLines
    ? postProcessLinesToModels(form.assemblyLines, productionKind)
    : form.postProcessLines
      ? postProcessLinesToModels(form.postProcessLines, productionKind)
      : []
  const downloadLines: PostProcessLine[] = form.downloadLines
    ? postProcessLinesToModels(form.downloadLines, productionKind)
    : []
  const testLines: PostProcessLine[] = form.testLines
    ? postProcessLinesToModels(form.testLines, productionKind)
    : []
  const packingLines: PostProcessLine[] = form.packingLines
    ? postProcessLinesToModels(form.packingLines, productionKind)
    : []

  const postAssembly =
    form.assemblyLines || form.postProcessLines
      ? sumPostProcessLineMinutes(assemblyLines)
      : Number(form.postAssembly) || 0
  const postDownload = form.downloadLines
    ? sumPostProcessLineMinutes(downloadLines)
    : Number(form.postDownload) || 0
  const postTest = form.testLines
    ? sumPostProcessLineMinutes(testLines)
    : Number(form.postTest) || 0
  const postPacking = form.packingLines
    ? sumPostProcessLineMinutes(packingLines)
    : Number(form.postPacking) || 0

  const mergedLines = [...assemblyLines, ...downloadLines, ...testLines, ...packingLines]

  return {
    amounts: {
      smt: result.values.smt,
      dip: result.values.dip,
      assembly: postAssembly * postRate * qty,
      download: postDownload * postRate * qty,
      test: postTest * postRate * qty,
      packing: postPacking * postRate * qty,
      postProcessProfit: result.common.postProcessProfit || 0,
      materialCost: materialCostPerUnit * qty,
      materialManagementCost: includeMaterialCosts ? result.common.materialManagement : 0,
      setupCost: result.common.smtSetup,
      subMaterialCost: metalMaskCost,
      sampleCost,
      auxiliaryMaterialCost: result.common.auxiliaryMaterial,
    },
    inputs: {
      smt: {
        pcbBoards: sanitizedPcbBoards,
        ...(b0
          ? {
              aoiEnabled: b0.aoiEnabled,
              pcbWashEnabled: b0.pcbWashEnabled,
              chip: b0.chip,
              icPin: b0.icPin,
              bga: b0.bga,
              smtOdd: b0.smtOdd,
              smtSpecial: b0.smtSpecial,
              smtSide: b0.smtSide,
              smtTopCount: b0.smtTopCount,
              smtBotCount: b0.smtBotCount,
            }
          : {}),
      },
      dip: {
        dipBoards,
        ...(d0
          ? {
              dipGeneral: d0.dipGeneral,
              dipConnector: d0.dipConnector,
              dipWire: d0.dipWire,
              waveGeneral: d0.waveGeneral,
              waveConnector: d0.waveConnector,
              waveWire: d0.waveWire,
            }
          : {}),
      },
      postProcess: {
        postAssembly,
        postDownload,
        postTest,
        postPacking,
        assemblyLines,
        downloadLines,
        testLines,
        packingLines,
        lines: mergedLines,
      },
    },
    settings: {
      materialCostPerUnit,
      metalMaskCost,
      auxiliaryMaterialCostPerUnit,
      smtIncludesSetup: true,
      pcbBoardCount: Number(form.pcbBoardCount) || pcbBoards.length,
      specialDiscount: Number(form.specialDiscount) || 0,
      productionKind: form.productionKind === '샘플' ? '샘플' : '양산',
      quoteType,
      quoteStatus: quoteStatus === 'confirmed' ? 'confirmed' : 'draft',
      includeSmd: Boolean(form.includeSmd),
      includeDip: Boolean(form.includeDip),
      includeMaterialCosts,
      includeMetalMask: form.includeMetalMask !== false,
      ...(form.productId?.trim() ? { productId: form.productId.trim() } : {}),
    },
  }
}

export function buildQuoteRowPayload(
  form: QuoteFormSnapshot,
  pcbBoards: SmtPcbBoard[],
  dipBoards: DipPcbBoard[],
  result: EstimateResult,
  quoteType: QuoteType,
  quoteStatus: QuoteStatus = 'draft',
): QuoteRowPayload {
  const status = quoteStatus === 'confirmed' ? 'confirmed' : 'draft'
  return {
    quote_date: result.date,
    customer: form.customer.trim(),
    product_name: form.productName.trim(),
    board_qty: result.qty || 0,
    total_amount: result.values.grandTotal,
    detail_info: buildQuoteDetailInfo(form, pcbBoards, dipBoards, result, quoteType, status),
    status,
  }
}
