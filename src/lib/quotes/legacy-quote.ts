import type { QuoteRowPayload } from '@/lib/quotes/build-quote-payload'
import type { QuoteDetailInfo, QuoteListItem, QuoteStatus } from '@/lib/quotes/types'
import { isLegacyQuoteDetail } from '@/lib/quotes/utils'
import { todayYmdSeoul } from '@/lib/orders/utils'

export type LegacyQuoteCostKey = 'smd' | 'post' | 'material'

export type LegacyQuoteFormState = {
  quoteDate: string
  customer: string
  productName: string
  productId: string
  productionKind: '샘플' | '양산'
  smd: string
  post: string
  material: string
}

export const LEGACY_QUOTE_COST_FIELDS: {
  key: LegacyQuoteCostKey
  label: string
  hint: string
}[] = [
  { key: 'smd', label: 'SMD', hint: '대당' },
  { key: 'post', label: '후공정', hint: '대당' },
  { key: 'material', label: '자재', hint: '대당' },
]

/** 과거 견적은 수량 없이 대당 단가만 보관 (board_qty 고정 1) */
export const LEGACY_QUOTE_BOARD_QTY = 1

export function defaultLegacyQuoteForm(): LegacyQuoteFormState {
  return {
    quoteDate: todayYmdSeoul(),
    customer: '',
    productName: '',
    productId: '',
    productionKind: '양산',
    smd: '0',
    post: '0',
    material: '0',
  }
}

function money(value: string | number) {
  return Math.max(0, Math.round(Number(value) || 0))
}

export function legacyQuoteUnitPrice(form: Pick<LegacyQuoteFormState, LegacyQuoteCostKey>) {
  return money(form.smd) + money(form.post) + money(form.material)
}

export function legacyQuoteFormFromQuote(quote: QuoteListItem): LegacyQuoteFormState {
  const costs = quote.detailInfo.settings?.legacyCosts
  const qty = Math.max(1, Math.floor(Number(quote.boardQty) || 0) || 1)
  const amounts = quote.detailInfo.amounts

  const smd =
    costs?.smd ??
    (amounts?.smt != null ? Math.round(Number(amounts.smt) / qty) : 0)
  const post =
    costs?.post ??
    (amounts
      ? Math.round(
          ((Number(amounts.assembly) || 0) +
            (Number(amounts.test) || 0) +
            (Number(amounts.packing) || 0) +
            (Number(amounts.dip) || 0)) /
            qty,
        )
      : 0)
  const material =
    costs?.material ??
    (amounts?.materialCost != null ? Math.round(Number(amounts.materialCost) / qty) : 0)

  return {
    quoteDate: quote.quoteDate || todayYmdSeoul(),
    customer: quote.customer || '',
    productName: quote.productName || '',
    productId: quote.detailInfo.settings?.productId || '',
    productionKind: quote.detailInfo.settings?.productionKind === '샘플' ? '샘플' : '양산',
    smd: String(Math.max(0, Math.round(Number(smd) || 0))),
    post: String(Math.max(0, Math.round(Number(post) || 0))),
    material: String(Math.max(0, Math.round(Number(material) || 0))),
  }
}

export function buildLegacyQuotePayload(
  form: LegacyQuoteFormState,
  quoteStatus: QuoteStatus = 'draft',
): QuoteRowPayload {
  const qty = LEGACY_QUOTE_BOARD_QTY
  const smd = money(form.smd)
  const post = money(form.post)
  const material = money(form.material)
  const unit = smd + post + material

  const detail_info: QuoteDetailInfo = {
    amounts: {
      smt: smd * qty,
      dip: 0,
      assembly: post * qty,
      test: 0,
      packing: 0,
      materialCost: material * qty,
      materialManagementCost: 0,
      setupCost: 0,
      subMaterialCost: 0,
    },
    settings: {
      quoteType: 'legacy',
      quoteStatus: quoteStatus === 'confirmed' ? 'confirmed' : 'draft',
      productionKind: form.productionKind === '샘플' ? '샘플' : '양산',
      legacyCosts: { smd, post, material, other: 0 },
      ...(form.productId.trim() ? { productId: form.productId.trim() } : {}),
    },
  }

  return {
    quote_date: form.quoteDate.trim() || todayYmdSeoul(),
    customer: form.customer.trim(),
    product_name: form.productName.trim(),
    board_qty: qty,
    total_amount: unit,
    detail_info,
    status: quoteStatus === 'confirmed' ? 'confirmed' : 'draft',
  }
}

export { isLegacyQuoteDetail }
