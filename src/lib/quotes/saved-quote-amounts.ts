import { quoteMetalMaskAmount, quoteUnitPriceKrw } from './format'
import { estimateSavedQuote } from './preview-rows'
import type { QuoteListItem } from './types'
import { isLegacyQuoteDetail } from './utils'

export type SavedQuoteAmounts = {
  /** 대당단가 (메탈마스크 제외) */
  unitPrice: number
  /** 대당단가 × 수량 + 메탈마스크 */
  totalAmount: number
  metalMask: number
}

const cache = new WeakMap<QuoteListItem, SavedQuoteAmounts>()

function storedAmounts(quote: QuoteListItem): SavedQuoteAmounts {
  return {
    unitPrice: quoteUnitPriceKrw(quote),
    totalAmount: Math.max(0, Math.round(Number(quote.totalAmount) || 0)),
    metalMask: quoteMetalMaskAmount(quote.detailInfo),
  }
}

/**
 * 저장 견적의 대당단가·합계 — 모달·미리보기·PDF 와 같은 현재 계산식으로 재산정.
 * 과거(legacy) 견적이나 재계산 실패 시 저장된 total_amount 기준.
 */
export function resolveSavedQuoteAmounts(quote: QuoteListItem): SavedQuoteAmounts {
  const cached = cache.get(quote)
  if (cached) return cached

  let amounts: SavedQuoteAmounts
  if (isLegacyQuoteDetail(quote.detailInfo)) {
    amounts = storedAmounts(quote)
  } else {
    try {
      const estimate = estimateSavedQuote(quote)
      amounts =
        estimate.values.grandTotal > 0
          ? {
              unitPrice: estimate.values.unitPrice,
              totalAmount: estimate.values.grandTotal,
              metalMask: estimate.values.metalMask,
            }
          : storedAmounts(quote)
    } catch {
      amounts = storedAmounts(quote)
    }
  }

  cache.set(quote, amounts)
  return amounts
}
