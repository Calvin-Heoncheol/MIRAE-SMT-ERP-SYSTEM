import type {
  DipPcbBoard,
  EstimateResult,
  QuoteDetailInfo,
  QuoteType,
  SmtPcbBoard,
} from './types'

export type QuoteFormSnapshot = {
  customer: string
  productName: string
  boardQty: string
  pcbBoardCount: string
  materialCost: string
  postAssembly: string
  postTest: string
  postPacking: string
  specialDiscount: string
}

export type QuoteRowPayload = {
  quote_date: string
  customer: string
  product_name: string
  board_qty: number
  total_amount: number
  detail_info: QuoteDetailInfo
}

export function buildQuoteDetailInfo(
  form: QuoteFormSnapshot,
  pcbBoards: SmtPcbBoard[],
  dipBoards: DipPcbBoard[],
  result: EstimateResult,
  quoteType: QuoteType,
): QuoteDetailInfo {
  const sanitizedPcbBoards =
    quoteType === 'export'
      ? pcbBoards.map((board) => ({ ...board, pcbWashEnabled: false }))
      : pcbBoards
  const b0 = sanitizedPcbBoards[0]
  const d0 = dipBoards[0]
  const qty = result.qty || 0
  const materialCostPerUnit = Number(form.materialCost) || 0

  return {
    amounts: {
      smt: result.values.smt,
      dip: result.values.dip,
      assembly: result.values.postProcess,
      test: 0,
      packing: 0,
      materialCost: materialCostPerUnit * qty,
      materialManagementCost: result.common.materialManagement,
      setupCost: result.common.smtSetup,
      subMaterialCost: result.common.subMaterial,
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
        postAssembly: Number(form.postAssembly) || 0,
        postTest: Number(form.postTest) || 0,
        postPacking: Number(form.postPacking) || 0,
      },
    },
    settings: {
      materialCostPerUnit,
      smtIncludesSetup: true,
      pcbBoardCount: Number(form.pcbBoardCount) || pcbBoards.length,
      specialDiscount: Number(form.specialDiscount) || 0,
      quoteType,
    },
  }
}

export function buildQuoteRowPayload(
  form: QuoteFormSnapshot,
  pcbBoards: SmtPcbBoard[],
  dipBoards: DipPcbBoard[],
  result: EstimateResult,
  quoteType: QuoteType,
): QuoteRowPayload {
  return {
    quote_date: result.date,
    customer: form.customer.trim(),
    product_name: form.productName.trim(),
    board_qty: result.qty || 0,
    total_amount: result.values.grandTotal,
    detail_info: buildQuoteDetailInfo(form, pcbBoards, dipBoards, result, quoteType),
  }
}
