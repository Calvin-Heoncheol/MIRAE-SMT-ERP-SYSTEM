import { paymentTermSnapshotFromDbRow } from '@/lib/partners/payment-term-snapshot'
import {
  resolveUnifiedPostProcessLineForms,
  sumPostProcessBilledMinutes,
  sumPostProcessLineMinutes,
} from './post-process-lines'
import { formatQuoteProcessLabel } from './production-flags'
import type {
  DipPcbBoard,
  EstimateInput,
  QuoteDetailInfo,
  QuoteListFilter,
  QuoteListItem,
  QuoteRecord,
  QuoteStatus,
  QuoteType,
  SmtPcbBoard,
} from './types'
import { QUOTE_STATUS_LABELS } from './types'

export function defaultSmtPcbBoard(index = 0): SmtPcbBoard {
  return {
    pcbName: `PCB ${index + 1}`,
    chip: 0,
    icPin: 0,
    bga: 0,
    smtOdd: 0,
    smtSpecial: 0,
    smtSide: 'single',
    aoiEnabled: true,
    pcbWashEnabled: false,
    smtTopCount: 0,
    smtBotCount: 0,
  }
}

export function defaultDipPcbBoard(index = 0): DipPcbBoard {
  return {
    pcbName: `PCB ${index + 1}`,
    dipGeneral: 0,
    dipConnector: 0,
    dipWire: 0,
    waveGeneral: 0,
    waveConnector: 0,
    waveWire: 0,
  }
}

export function isLegacyQuoteDetail(detailInfo?: QuoteDetailInfo): boolean {
  return detailInfo?.settings?.quoteType === 'legacy'
}

export function normalizeQuoteStatus(value: unknown): QuoteStatus {
  return value === 'confirmed' ? 'confirmed' : 'draft'
}

export function inferQuoteType(source: {
  quoteType?: QuoteType
  detailInfo?: QuoteDetailInfo
}): QuoteType {
  const settingsType = source.detailInfo?.settings?.quoteType
  // 과거 견적은 원화 표시
  if (settingsType === 'legacy') return 'domestic'
  if (settingsType === 'domestic' || source.quoteType === 'domestic') return 'domestic'
  if (settingsType === 'export' || source.quoteType === 'export') return 'export'
  return 'export'
}

export function parseQuoteDateForSort(quoteDate: string) {
  if (!quoteDate) return 0
  const match = quoteDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
  }
  const parsed = Date.parse(quoteDate)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function sortQuotesNewestFirst(quotes: QuoteListItem[]) {
  return [...quotes].sort((a, b) => {
    const dateDiff = parseQuoteDateForSort(b.quoteDate) - parseQuoteDateForSort(a.quoteDate)
    if (dateDiff !== 0) return dateDiff
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export function mapQuoteRecord(record: QuoteRecord): QuoteListItem {
  const detailInfo = record.detail_info || {}
  return {
    quoteId: record.id,
    quoteNumber: record.id,
    quoteDate: record.quote_date,
    quoteType: inferQuoteType({ detailInfo }),
    quoteStatus: normalizeQuoteStatus(record.status || detailInfo.settings?.quoteStatus),
    customer: record.customer,
    productName: record.product_name,
    boardQty: record.board_qty,
    totalAmount: Number(record.total_amount) || 0,
    detailInfo,
    paymentTerms: paymentTermSnapshotFromDbRow(record),
    createdBy: record.created_by ?? null,
    createdByName: String(record.created_by_name || '').trim(),
    updatedBy: record.updated_by ?? null,
    updatedByName: String(record.updated_by_name || '').trim(),
    createdAt: record.created_at,
  }
}

/** 목록·화면용 — 최종 수정자 우선, 없으면 등록자 */
export function quoteRegistrantLabel(quote: Pick<QuoteListItem, 'createdByName' | 'updatedByName'>) {
  return quote.updatedByName.trim() || quote.createdByName.trim() || ''
}

export function filterQuotes(quotes: QuoteListItem[], filter: QuoteListFilter) {
  if (filter === 'all') return quotes
  return quotes.filter((quote) => quote.quoteType === filter)
}

export function filterQuotesForSearch(quotes: QuoteListItem[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return quotes
  return quotes.filter((quote) => {
    const productionKind =
      quote.detailInfo.settings?.productionKind === '샘플' ? '샘플' : '양산'
    const isLegacy = isLegacyQuoteDetail(quote.detailInfo)
    const haystack = [
      quote.quoteNumber,
      quote.customer,
      quote.productName,
      formatQuoteProcessLabel(quote),
      quote.quoteDate,
      quote.quoteType === 'domestic' ? '국내' : '해외',
      productionKind,
      QUOTE_STATUS_LABELS[quote.quoteStatus],
      isLegacy ? '과거' : '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function toEstimateInputFromDetail(
  quote: QuoteListItem,
  overrides: Partial<EstimateInput> = {},
): EstimateInput {
  const inputs = quote.detailInfo.inputs || {}
  const settings = quote.detailInfo.settings || {}
  const smtBoards = inputs.smt?.pcbBoards || [defaultSmtPcbBoard(0)]
  const dipBoards = inputs.dip?.dipBoards || [defaultDipPcbBoard(0)]
  const post = inputs.postProcess || {}
  const productionKind = settings.productionKind === '샘플' ? '샘플' : '양산'
  const postAssembly = post.lines?.length
    ? sumPostProcessLineMinutes(post.lines)
    : sumPostProcessBilledMinutes(resolveUnifiedPostProcessLineForms(post), productionKind)

  return {
    boardQty: quote.boardQty,
    materialCost: settings.materialCostPerUnit ?? 0,
    metalMaskCost:
      settings.metalMaskCost ?? quote.detailInfo.amounts?.subMaterialCost ?? 0,
    productionKind: settings.productionKind === '샘플' ? '샘플' : '양산',
    postAssembly,
    postTest: 0,
    postPacking: 0,
    specialDiscount: settings.specialDiscount ?? 0,
    pcbBoardCount: settings.pcbBoardCount ?? smtBoards.length,
    pcbBoards: smtBoards,
    dipBoards,
    quoteType: quote.quoteType,
    existingQuoteNumber: quote.quoteNumber,
    includeSmd: settings.includeSmd,
    // 미설정(구 견적) = 포함. 신규만 false
    includeMaterialCosts: settings.includeMaterialCosts !== false,
    includeMetalMask: settings.includeMetalMask !== false,
    ...overrides,
  }
}

/** 미설정(구 견적) = 자재 비용 포함. 명시적 false 만 제외 */
export function resolveIncludeMaterialCosts(value?: boolean | null) {
  return value !== false
}
