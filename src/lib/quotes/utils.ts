import type {
  DipPcbBoard,
  EstimateInput,
  QuoteDetailInfo,
  QuoteListFilter,
  QuoteListItem,
  QuoteRecord,
  QuoteType,
  SmtPcbBoard,
} from './types'

export function defaultSmtPcbBoard(index = 0): SmtPcbBoard {
  return {
    pcbName: `PCB ${index + 1}`,
    chip: 0,
    icPin: 0,
    bga: 0,
    smtOdd: 0,
    smtSpecial: 0,
    smtSide: 'single',
    aoiEnabled: false,
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

export function inferQuoteType(source: {
  quoteType?: QuoteType
  detailInfo?: QuoteDetailInfo
}): QuoteType {
  const settingsType = source.detailInfo?.settings?.quoteType
  if (settingsType) {
    return settingsType === 'domestic' ? 'domestic' : 'export'
  }
  if (source.quoteType) {
    return source.quoteType === 'domestic' ? 'domestic' : 'export'
  }
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
    customer: record.customer,
    productName: record.product_name,
    boardQty: record.board_qty,
    totalAmount: Number(record.total_amount) || 0,
    detailInfo,
    createdAt: record.created_at,
  }
}

export function filterQuotes(quotes: QuoteListItem[], filter: QuoteListFilter) {
  if (filter === 'all') return quotes
  return quotes.filter((quote) => quote.quoteType === filter)
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

  return {
    boardQty: quote.boardQty,
    materialCost: settings.materialCostPerUnit ?? 0,
    postAssembly: post.postAssembly ?? 0,
    postTest: post.postTest ?? 0,
    postPacking: post.postPacking ?? 0,
    specialDiscount: settings.specialDiscount ?? 0,
    pcbBoardCount: settings.pcbBoardCount ?? smtBoards.length,
    pcbBoards: smtBoards,
    dipBoards,
    quoteType: quote.quoteType,
    existingQuoteNumber: quote.quoteNumber,
    ...overrides,
  }
}
