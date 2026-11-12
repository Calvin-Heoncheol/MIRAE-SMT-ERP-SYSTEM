import type { AiQuoteDraft } from '@/lib/quotes/ai-quote-draft'
import {
  foldLegacyWaveCounts,
  normalizeMetalMaskSide,
  withQuoteRates,
  type MetalMaskSide,
  type QuoteRates,
} from '@/lib/quotes/constants'
import {
  calculateEstimate,
  NEW_QUOTE_UNIT_PRICE_ROUND_UNIT,
  normalizeUnitPriceRoundUnit,
} from '@/lib/quotes/calculate-estimate'
import { todayYmdSeoul } from '@/lib/orders/utils'
import {
  defaultDipBoardForm,
  defaultSmtBoardForm,
  dipBoardFormToModel,
  dipBoardToForm,
  resizeBoardForms,
  smtBoardFormToModel,
  smtBoardToForm,
  type DipBoardForm,
  type SmtBoardForm,
} from '@/lib/quotes/form-state'
import {
  DEFAULT_POST_PROCESS_ORDER,
  defaultPostProcessBufferPercent,
  emptyPostProcessLineForm,
  normalizePostProcessOrder,
  parsePostProcessBufferPercent,
  resolveCategorizedPostProcessLineForms,
  sumPostProcessBilledMinutes,
  type PostProcessCategory,
  type PostProcessLineForm,
} from '@/lib/quotes/post-process-lines'
import type { EstimateResult, QuoteListItem, QuoteType } from '@/lib/quotes/types'
import { toEstimateInputFromDetail } from '@/lib/quotes/utils'
import type { Product } from '@/lib/products/types'
import { findProductById, resolveOrderLineProduct } from '@/lib/products/utils'

export type FormState = {
  customer: string
  productCode: string
  productName: string
  productId: string
  /** 견적일 (YYYY-MM-DD) */
  quoteDate: string
  boardQty: string
  pcbBoardCount: string
  productionKind: '샘플' | '양산'
  /** true = VAT 포함 표시 */
  includeVat: boolean
  assemblyLines: PostProcessLineForm[]
  downloadLines: PostProcessLineForm[]
  testLines: PostProcessLineForm[]
  packingLines: PostProcessLineForm[]
  /** 후공정 시간 여유 % */
  postProcessBufferPercent: string
  /** 조립·다운로드·테스트·포장 순서 */
  postProcessOrder: PostProcessCategory[]
  materialCost: string
  specialDiscount: string
  includeSmd: boolean
  includeDip: boolean
  /** 원자재·관리비 포함 (견적 자재 섹션) */
  includeMaterialCosts: boolean
  /** 메탈마스크 포함 (발주 1회, SET-UP) */
  includeMetalMask: boolean
  /** 메탈마스크 단면/양면 — 미설정이면 보드 면 기준 */
  metalMaskSide?: MetalMaskSide
  /** 대당단가 반올림 단위(원) */
  unitPriceRoundUnit: number
}

const INITIAL_FORM: FormState = {
  customer: '',
  productCode: '',
  productName: '',
  productId: '',
  quoteDate: todayYmdSeoul(),
  boardQty: '1000',
  pcbBoardCount: '1',
  productionKind: '양산',
  includeVat: false,
  assemblyLines: [emptyPostProcessLineForm()],
  downloadLines: [emptyPostProcessLineForm()],
  testLines: [emptyPostProcessLineForm()],
  packingLines: [emptyPostProcessLineForm()],
  postProcessBufferPercent: '',
  postProcessOrder: DEFAULT_POST_PROCESS_ORDER,
  materialCost: '0',
  specialDiscount: '0',
  includeSmd: true,
  includeDip: true,
  includeMaterialCosts: true,
  includeMetalMask: true,
  unitPriceRoundUnit: NEW_QUOTE_UNIT_PRICE_ROUND_UNIT,
}

function inferIncludeFlags(quote: QuoteListItem): { includeSmd: boolean; includeDip: boolean } {
  const settings = quote.detailInfo.settings || {}
  if (typeof settings.includeSmd === 'boolean' || typeof settings.includeDip === 'boolean') {
    return {
      includeSmd: Boolean(settings.includeSmd),
      includeDip: Boolean(settings.includeDip),
    }
  }

  const amounts = quote.detailInfo.amounts
  const post = quote.detailInfo.inputs?.postProcess || {}
  const hasSmd =
    (amounts?.smt || 0) > 0 ||
    Boolean(quote.detailInfo.inputs?.smt?.pcbBoards?.some((board) => board.chip || board.icPin || board.bga))
  const hasPostLines =
    Boolean(post.lines?.length) ||
    Boolean(post.assemblyLines?.length) ||
    Boolean(post.downloadLines?.length) ||
    Boolean(post.testLines?.length) ||
    Boolean(post.packingLines?.length)
  const hasDip =
    (amounts?.dip || 0) > 0 ||
    (amounts?.assembly || 0) > 0 ||
    (amounts?.download || 0) > 0 ||
    (post.postAssembly || 0) > 0 ||
    (post.postDownload || 0) > 0 ||
    (post.postTest || 0) > 0 ||
    (post.postPacking || 0) > 0 ||
    hasPostLines ||
    Boolean(
      quote.detailInfo.inputs?.dip?.dipBoards?.some(
        (board) => {
          const counts = foldLegacyWaveCounts(board)
          return counts.dipGeneral || counts.dipConnector || counts.dipWire || counts.dipXLarge
        },
      ),
    )

  // 기존 견적(플래그 없음)은 섹션을 열어 두어 편집 가능
  return {
    includeSmd: hasSmd || !hasDip,
    includeDip: hasDip || !hasSmd,
  }
}

export function clampPcbCount(value: string) {
  const parsed = Math.floor(Number(value) || 1)
  return String(Math.min(20, Math.max(1, parsed)))
}

export function syncDipNamesFromSmt(smtForms: SmtBoardForm[], dipForms: DipBoardForm[]) {
  return dipForms.map((dip, index) => ({
    ...dip,
    pcbName: smtForms[index]?.pcbName.trim() || dip.pcbName || `PCB ${index + 1}`,
  }))
}

function buildStateFromQuote(quote: QuoteListItem) {
  const input = toEstimateInputFromDetail(quote)
  const flags = inferIncludeFlags(quote)
  const pcbBoardCount = String(input.pcbBoardCount || input.pcbBoards?.length || 1)
  const smtForms = input.pcbBoards?.length
    ? input.pcbBoards.map(smtBoardToForm)
    : [defaultSmtBoardForm(0)]
  const dipForms = syncDipNamesFromSmt(
    smtForms,
    input.dipBoards?.length ? input.dipBoards.map(dipBoardToForm) : [defaultDipBoardForm(0)],
  )
  const post = quote.detailInfo.inputs?.postProcess || {}
  const categorized = resolveCategorizedPostProcessLineForms(post)
  const boardQty = String(quote.boardQty || 1000)
  const bufferPercent =
    parsePostProcessBufferPercent(post.timeBufferPercent) ??
    defaultPostProcessBufferPercent(boardQty)

  return {
    form: {
      customer: quote.customer,
      productCode: String(quote.detailInfo.settings?.productCode || '').trim(),
      productName: quote.productName,
      productId: quote.detailInfo.settings?.productId || '',
      quoteDate: quote.quoteDate || todayYmdSeoul(),
      boardQty,
      pcbBoardCount,
      productionKind:
        quote.detailInfo.settings?.productionKind === '샘플'
          ? ('샘플' as const)
          : ('양산' as const),
      includeVat: quote.detailInfo.settings?.includeVat === true,
      assemblyLines: categorized.assemblyLines,
      downloadLines: categorized.downloadLines,
      testLines: categorized.testLines,
      packingLines: categorized.packingLines,
      postProcessBufferPercent: String(bufferPercent),
      postProcessOrder: normalizePostProcessOrder(post.order),
      materialCost: String(input.materialCost || 0),
      specialDiscount: String(input.specialDiscount || 0),
      includeSmd: flags.includeSmd,
      includeDip: flags.includeDip,
      includeMaterialCosts: quote.detailInfo.settings?.includeMaterialCosts !== false,
      includeMetalMask: quote.detailInfo.settings?.includeMetalMask !== false,
      metalMaskSide: normalizeMetalMaskSide(quote.detailInfo.settings?.metalMaskSide),
      unitPriceRoundUnit: normalizeUnitPriceRoundUnit(quote.detailInfo.settings?.unitPriceRoundUnit),
    } satisfies FormState,
    smtForms,
    dipForms,
  }
}

export function createInitialState(
  mode: 'create' | 'edit',
  quote?: QuoteListItem | null,
  copyFrom?: QuoteListItem | null,
) {
  if (mode === 'edit' && quote) return buildStateFromQuote(quote)
  if (mode === 'create' && copyFrom) {
    const copied = buildStateFromQuote(copyFrom)
    return { ...copied, form: { ...copied.form, unitPriceRoundUnit: NEW_QUOTE_UNIT_PRICE_ROUND_UNIT } }
  }

  const count = Number(INITIAL_FORM.pcbBoardCount)
  const smtForms = resizeBoardForms([], count, defaultSmtBoardForm)
  const dipForms = syncDipNamesFromSmt(smtForms, resizeBoardForms([], count, defaultDipBoardForm))

  return {
    form: {
      ...INITIAL_FORM,
      postProcessBufferPercent: String(defaultPostProcessBufferPercent(INITIAL_FORM.boardQty)),
    },
    smtForms,
    dipForms,
  }
}

export function computeEstimate(
  form: FormState,
  smtForms: SmtBoardForm[],
  dipForms: DipBoardForm[],
  quoteType: QuoteType,
  options: {
    mode: 'create' | 'edit'
    quote?: QuoteListItem | null
    rates: QuoteRates
  },
): EstimateResult {
  return withQuoteRates(options.rates, () =>
    computeEstimateWithActiveRates(form, smtForms, dipForms, quoteType, options),
  )
}

function computeEstimateWithActiveRates(
  form: FormState,
  smtForms: SmtBoardForm[],
  dipForms: DipBoardForm[],
  quoteType: QuoteType,
  options: {
    mode: 'create' | 'edit'
    quote?: QuoteListItem | null
    rates: QuoteRates
  },
): EstimateResult {
  const pcbCount = Number(clampPcbCount(form.pcbBoardCount))
  const pcbBoards = smtForms.map(smtBoardFormToModel)
  const dipBoards = dipForms.map((dip, index) =>
    dipBoardFormToModel({
      ...dip,
      pcbName: smtForms[index]?.pcbName.trim() || dip.pcbName,
    }),
  )

  const postAssembly = sumPostProcessBilledMinutes(
    form.assemblyLines,
    form.boardQty,
    form.postProcessBufferPercent,
  )
  const postDownload = sumPostProcessBilledMinutes(
    form.downloadLines,
    form.boardQty,
    form.postProcessBufferPercent,
  )
  const postTest = sumPostProcessBilledMinutes(
    form.testLines,
    form.boardQty,
    form.postProcessBufferPercent,
  )
  const postPacking = sumPostProcessBilledMinutes(
    form.packingLines,
    form.boardQty,
    form.postProcessBufferPercent,
  )

  return calculateEstimate({
    boardQty: form.boardQty,
    materialCost: form.materialCost,
    includeMetalMask: form.includeMetalMask,
    metalMaskSide: form.metalMaskSide,
    productionKind: form.productionKind,
    postAssembly,
    postDownload,
    postTest,
    postPacking,
    specialDiscount: form.specialDiscount,
    pcbBoardCount: pcbCount,
    pcbBoards,
    dipBoards,
    quoteType,
    existingQuoteNumber: options.mode === 'edit' ? options.quote?.quoteNumber : undefined,
    includeSmd: true,
    includeMaterialCosts: form.includeMaterialCosts,
    rates: options.rates,
    unitPriceRoundUnit: form.unitPriceRoundUnit,
  })
}

/** 제품코드가 비어 있으면 품목마스터에서 id·제품명으로 찾아 채움 */
export function fillProductFromList(current: FormState, products: Product[]): FormState {
  if (current.productCode.trim()) return current
  const byId = current.productId.trim() ? findProductById(products, current.productId) : null
  if (byId) return { ...current, productCode: byId.productCode, productId: byId.id }
  if (!current.productName.trim()) return current
  const byName = resolveOrderLineProduct(products, current.customer, {
    productId: current.productId || null,
    productName: current.productName,
  })
  if (!byName) return current
  return { ...current, productCode: byName.productCode, productId: byName.id }
}

export function applyAiQuoteDraft(
  base: ReturnType<typeof createInitialState>,
  draft: AiQuoteDraft,
): ReturnType<typeof createInitialState> {
  const hasDipCounts = draft.dipForms.some(
    (board) => Number(board.dipGeneral) > 0 || Number(board.dipConnector) > 0,
  )

  return {
    form: {
      ...base.form,
      productName: draft.productName || base.form.productName,
      includeSmd: true,
      includeDip: hasDipCounts || base.form.includeDip,
      includeMaterialCosts: Boolean(draft.bomAnalysis) || base.form.includeMaterialCosts,
    },
    smtForms: draft.smtForms.length ? draft.smtForms : base.smtForms,
    dipForms: draft.dipForms.length ? draft.dipForms : base.dipForms,
  }
}
