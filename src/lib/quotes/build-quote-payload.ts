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

export type LegacyBoardFormRow = {
  name: string
  smtSide: 'single' | 'double'
}

export type LegacyQuoteFormSnapshot = {
  customer: string
  productName: string
  boards: LegacyBoardFormRow[]
  /** 통합 단가 */
  unitPrice: string
  /** SMD 카테고리 선택 */
  includeSmd: boolean
  /** 후공정 카테고리 선택 */
  includePost: boolean
  quoteDate?: string
  linkedSemiItemId?: string
  linkedSemiItemIds?: string[]
  linkedFinishedItemId?: string
}

export function readLegacyUnitPrice(detail: {
  amounts?: { smt?: number; assembly?: number; materialCost?: number }
  settings?: { unitPrice?: number; materialCostPerUnit?: number }
  totalAmount?: number
}): number {
  const stored = detail.settings?.unitPrice
  if (typeof stored === 'number' && Number.isFinite(stored) && stored >= 0) {
    return stored
  }
  const amounts = detail.amounts
  const legacySum =
    (amounts?.smt ?? 0) + (amounts?.assembly ?? 0) + (amounts?.materialCost ?? 0)
  if (legacySum > 0) return legacySum
  if (typeof detail.totalAmount === 'number' && detail.totalAmount > 0) {
    return detail.totalAmount
  }
  return 0
}

export const LEGACY_MAX_BOARD_COUNT = 20

export function clampLegacyBoardCount(value: number) {
  return Math.min(LEGACY_MAX_BOARD_COUNT, Math.max(1, Math.floor(value) || 1))
}

export function defaultLegacyBoardName(index: number) {
  return `보드${index + 1}`
}

export function resizeLegacyBoards(boards: LegacyBoardFormRow[], count: number): LegacyBoardFormRow[] {
  const nextCount = clampLegacyBoardCount(count)
  const next = boards.slice(0, nextCount).map((board) => ({
    name: board.name,
    smtSide: board.smtSide === 'double' ? ('double' as const) : ('single' as const),
  }))
  while (next.length < nextCount) {
    next.push({
      name: defaultLegacyBoardName(next.length),
      smtSide: next[next.length - 1]?.smtSide || 'single',
    })
  }
  return next
}

export function normalizeLegacyBoards(
  boards: LegacyBoardFormRow[],
  options?: { productName?: string },
): LegacyBoardFormRow[] {
  const resized = resizeLegacyBoards(
    boards?.length ? boards : [{ name: '', smtSide: 'single' }],
    boards?.length || 1,
  )

  if (resized.length <= 1) {
    return [
      {
        name: '',
        smtSide: resized[0]?.smtSide === 'double' ? 'double' : 'single',
      },
    ]
  }

  const productName = options?.productName?.trim() || ''
  return resized.map((board, index) => {
    const trimmed = board.name.trim()
    // 예전 기본값 "보드1"만 있고 실제 이름이 아니면 제품명을 1번 보드 기본으로
    if (index === 0 && (!trimmed || trimmed === defaultLegacyBoardName(0)) && productName) {
      return { name: productName, smtSide: board.smtSide === 'double' ? 'double' : 'single' }
    }
    return {
      name: trimmed || defaultLegacyBoardName(index),
      smtSide: board.smtSide === 'double' ? 'double' : 'single',
    }
  })
}

export function readLegacyBoardsFromQuote(detail: {
  inputs?: {
    smt?: { smtSide?: string; legacyBoards?: Array<{ name?: string; smtSide?: string }> }
  }
  settings?: { pcbBoardCount?: number }
}): LegacyBoardFormRow[] {
  const stored = detail.inputs?.smt?.legacyBoards
  if (Array.isArray(stored) && stored.length > 0) {
    if (stored.length <= 1) {
      return [
        {
          name: '',
          smtSide: stored[0]?.smtSide === 'double' ? 'double' : 'single',
        },
      ]
    }
    return stored.map((board, index) => ({
      name: String(board.name || '').trim() || defaultLegacyBoardName(index),
      smtSide: board.smtSide === 'double' ? ('double' as const) : ('single' as const),
    }))
  }

  const fallbackSide = detail.inputs?.smt?.smtSide === 'double' ? 'double' : 'single'
  const count = clampLegacyBoardCount(detail.settings?.pcbBoardCount ?? 1)
  if (count <= 1) {
    return [{ name: '', smtSide: fallbackSide as 'single' | 'double' }]
  }
  return Array.from({ length: count }, (_, index) => ({
    name: defaultLegacyBoardName(index),
    smtSide: fallbackSide as 'single' | 'double',
  }))
}

export function legacyProcessTypeFromFlags(
  includeSmd: boolean,
  includePost: boolean,
): 'smt' | 'post' | 'smt_post' | null {
  if (includeSmd && includePost) return 'smt_post'
  if (includeSmd) return 'smt'
  if (includePost) return 'post'
  return null
}

export function legacyFlagsFromProcessType(
  processType: 'smt' | 'post' | 'smt_post' | undefined,
  fallback?: { smtCost: number; postProcessCost: number },
): { includeSmd: boolean; includePost: boolean } {
  if (processType === 'smt') return { includeSmd: true, includePost: false }
  if (processType === 'post') return { includeSmd: false, includePost: true }
  if (processType === 'smt_post') return { includeSmd: true, includePost: true }
  if (fallback) {
    const hasSmt = fallback.smtCost > 0
    const hasPost = fallback.postProcessCost > 0
    if (hasSmt || hasPost) {
      return { includeSmd: hasSmt || !hasPost, includePost: hasPost || !hasSmt }
    }
  }
  return { includeSmd: false, includePost: false }
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

export function buildLegacyQuoteRowPayload(form: LegacyQuoteFormSnapshot): QuoteRowPayload {
  const includeSmd = form.includeSmd
  const includePost = form.includePost
  const processType = legacyProcessTypeFromFlags(includeSmd, includePost)
  const boards = normalizeLegacyBoards(form.boards, { productName: form.productName })
  const unitPrice = Math.max(0, Number(form.unitPrice) || 0)
  const primarySide = boards[0]?.smtSide === 'double' ? 'double' : 'single'
  const linkedSemiIds = (form.linkedSemiItemIds || [])
    .map((id) => id.trim())
    .filter(Boolean)
  const linkedSemiId = form.linkedSemiItemId?.trim() || linkedSemiIds[0] || ''

  return {
    quote_date: form.quoteDate?.trim() || formatSeoulDate(),
    customer: form.customer.trim(),
    product_name: form.productName.trim(),
    board_qty: 1,
    total_amount: unitPrice,
    detail_info: {
      amounts: {
        smt: 0,
        dip: 0,
        assembly: 0,
        test: 0,
        packing: 0,
        materialCost: 0,
        materialManagementCost: 0,
        setupCost: 0,
        subMaterialCost: 0,
      },
      inputs: {
        smt: {
          smtSide: primarySide,
          legacyBoards: boards,
        },
        postProcess: {},
      },
      settings: {
        materialCostPerUnit: 0,
        smtIncludesSetup: false,
        pcbBoardCount: boards.length,
        specialDiscount: 0,
        quoteType: 'legacy',
        unitPrice,
        ...(processType ? { processType } : {}),
        ...(linkedSemiId ? { linkedSemiItemId: linkedSemiId } : {}),
        ...(linkedSemiIds.length ? { linkedSemiItemIds: linkedSemiIds } : {}),
        ...(form.linkedFinishedItemId?.trim()
          ? { linkedFinishedItemId: form.linkedFinishedItemId.trim() }
          : {}),
      },
    },
  }
}
