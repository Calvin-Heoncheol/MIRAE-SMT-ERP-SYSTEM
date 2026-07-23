import type { BusinessPartner } from '@/lib/partners/types'
import { resolvePartnerFromInput } from '@/lib/partners/utils'
import type { Product } from '@/lib/products/types'
import { resolveOrderLineProduct } from '@/lib/products/utils'
import type { OrderRowPayload } from './types'
import { computeLineAmount, todayYmdSeoul } from './utils'

export type BuildOrderFromQuoteInput = {
  quoteId: string
  quoteNumber: string
  customer: string
  productName: string
  boardQty: number
  totalAmount: number
}

/**
 * 견적 1건 → 주문서 1라인 페이로드.
 * 고객사·제품명이 기초등록과 일치해야 합니다.
 */
export function buildOrderPayloadFromQuote(
  input: BuildOrderFromQuoteInput,
  products: Product[],
  salesPartners: BusinessPartner[],
): { ok: true; payload: OrderRowPayload } | { ok: false; detail: string } {
  const partner = resolvePartnerFromInput(salesPartners, input.customer)
  if (!partner) {
    return {
      ok: false,
      detail: '거래처등록에 등록된 매출 고객사만 주문서로 전환할 수 있습니다.',
    }
  }

  const productName = String(input.productName || '').trim()
  if (!productName) {
    return { ok: false, detail: '제품명이 없습니다.' }
  }

  const quantity = Math.max(0, Math.floor(Number(input.boardQty) || 0))
  if (quantity <= 0) {
    return { ok: false, detail: '보드 수량이 올바르지 않습니다.' }
  }

  const totalAmount = Math.max(0, Math.round(Number(input.totalAmount) || 0))
  const unitPrice = Math.round(totalAmount / quantity)

  const matched = resolveOrderLineProduct(products, partner.name, {
    productId: null,
    productName,
  })
  if (!matched) {
    return {
      ok: false,
      detail: `「${productName}」 제품이 품목등록에 없습니다. 기초등록 → 품목등록에서 해당 고객사 완제품을 먼저 등록해 주세요.`,
    }
  }

  return {
    ok: true,
    payload: {
      order_date: todayYmdSeoul(),
      delivery_date: '',
      customer: partner.name,
      category: '양산',
      note: `견적 ${input.quoteNumber} 전환`,
      source: 'quote',
      source_quote_id: input.quoteId,
      items: [
        {
          productId: matched.id,
          productCode: matched.productCode,
          productName: matched.productName,
          quantity,
          unitPrice,
          orderAmount: computeLineAmount(quantity, unitPrice),
        },
      ],
    },
  }
}
