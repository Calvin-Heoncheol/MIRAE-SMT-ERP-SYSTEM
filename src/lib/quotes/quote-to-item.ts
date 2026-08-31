import type { ItemFormState } from '@/lib/items/form-state'
import { smtSideToItemPcbSide } from '@/lib/items/smt-quote-parts'
import {
  deriveItemProcessType,
  type ItemPcbSideMode,
  type ItemProcessType,
} from '@/lib/items/types'
import { calculateEstimate } from '@/lib/quotes/calculate-estimate'
import { legacyQuoteFormFromQuote } from '@/lib/quotes/legacy-quote'
import { getQuoteProductionFlags } from '@/lib/quotes/production-flags'
import type { QuoteListItem } from '@/lib/quotes/types'
import { isLegacyQuoteDetail, toEstimateInputFromDetail } from '@/lib/quotes/utils'

function money(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0))
}

function quotePerUnitTotal(total: number, qty: number) {
  const q = Math.max(1, Math.floor(Number(qty) || 0) || 1)
  return money(total) / q
}

export type ItemPriceBreakdownFromQuote = {
  setupUnitPrice: number
  smdUnitPrice: number
  dipUnitPrice: number
  materialUnitPrice: number
}

function processTypeFromQuote(quote: QuoteListItem): ItemProcessType {
  const flags = getQuoteProductionFlags(quote)
  if (flags.hasSmd && flags.hasPost) return 'smt_post'
  if (flags.hasSmd) return 'smt'
  if (flags.hasPost) return 'post'
  return ''
}

function pcbSideFromQuote(quote: QuoteListItem): ItemPcbSideMode {
  const boards = quote.detailInfo.inputs?.smt?.pcbBoards
  const side = boards?.[0]?.smtSide ?? quote.detailInfo.inputs?.smt?.smtSide
  return smtSideToItemPcbSide(side) || 'single'
}

export function buildItemPriceBreakdownFromQuote(quote: QuoteListItem): ItemPriceBreakdownFromQuote {
  const qty = Math.max(1, Math.floor(Number(quote.boardQty) || 0) || 1)

  if (isLegacyQuoteDetail(quote.detailInfo)) {
    const legacy = legacyQuoteFormFromQuote(quote)
    return {
      setupUnitPrice: 0,
      smdUnitPrice: money(legacy.smd),
      dipUnitPrice: money(legacy.post),
      materialUnitPrice: money(legacy.material),
    }
  }

  const amounts = quote.detailInfo.amounts
  const settings = quote.detailInfo.settings || {}

  if (amounts) {
    const setupUnitPrice = money(amounts.setupCost)
    const smdUnitPrice = money((money(amounts.smt) - setupUnitPrice) / qty)
    const dipUnitPrice = money(
      (money(amounts.dip) +
        money(amounts.assembly) +
        money(amounts.test) +
        money(amounts.packing)) /
        qty,
    )
    const materialPerUnit = money(settings.materialCostPerUnit)
    const materialMgmtPerUnit = money(quotePerUnitTotal(amounts.materialManagementCost, qty))
    const materialFromAmounts = money(quotePerUnitTotal(amounts.materialCost, qty))
    const materialUnitPrice =
      materialPerUnit > 0
        ? materialPerUnit + materialMgmtPerUnit
        : materialFromAmounts + materialMgmtPerUnit

    return { setupUnitPrice, smdUnitPrice, dipUnitPrice, materialUnitPrice }
  }

  const estimate = calculateEstimate(toEstimateInputFromDetail(quote))
  const setupUnitPrice = money(estimate.common.smtSetup)
  const smdUnitPrice = money((money(estimate.values.smt) - setupUnitPrice) / qty)
  const dipUnitPrice = money(
    (money(estimate.values.dip) + money(estimate.values.postProcess)) / qty,
  )
  const materialUnitPrice = money(
    (Number(settings.materialCostPerUnit) || 0) +
      quotePerUnitTotal(estimate.common.materialManagement, qty),
  )

  return { setupUnitPrice, smdUnitPrice, dipUnitPrice, materialUnitPrice }
}

export function displayItemFormUnitPrice(
  form: Pick<
    ItemFormState,
    'setupUnitPrice' | 'smdUnitPrice' | 'dipUnitPrice' | 'materialUnitPrice'
  >,
) {
  return (
    money(form.setupUnitPrice) +
    money(form.smdUnitPrice) +
    money(form.dipUnitPrice) +
    money(form.materialUnitPrice)
  )
}

export function formatQuoteOptionLabel(quote: QuoteListItem) {
  const status = quote.quoteStatus === 'confirmed' ? '확정' : '미확정'
  return `${quote.quoteNumber} · ${quote.productName} · ${quote.quoteDate} · ${status}`
}

export function buildItemDefaultsFromQuote(quote: QuoteListItem): Partial<ItemFormState> {
  const { setupUnitPrice, smdUnitPrice, dipUnitPrice, materialUnitPrice } =
    buildItemPriceBreakdownFromQuote(quote)

  const processType =
    processTypeFromQuote(quote) || deriveItemProcessType(smdUnitPrice, dipUnitPrice)

  return {
    baselineQuoteId: quote.quoteId,
    baselineQuoteLabel: formatQuoteOptionLabel(quote),
    customerName: quote.customer || '',
    name: quote.productName || '',
    processType,
    pcbSideMode: pcbSideFromQuote(quote),
    setupUnitPrice,
    smdUnitPrice,
    dipUnitPrice,
    materialUnitPrice,
    unitPrice: smdUnitPrice + dipUnitPrice,
  }
}
