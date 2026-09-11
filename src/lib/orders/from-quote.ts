import {

  snapshotFromPartner,

  type PaymentTermSnapshot,

} from '@/lib/partners/payment-term-snapshot'

import type { BusinessPartner } from '@/lib/partners/types'

import { resolvePartnerFromInput } from '@/lib/partners/utils'

import type { Product } from '@/lib/products/types'

import { resolveOrderLineProduct } from '@/lib/products/utils'

import {

  buildItemPriceBreakdownFromQuote,

  processTypeFromQuote,

} from '@/lib/quotes/quote-to-item'

import type { QuoteListItem } from '@/lib/quotes/types'

import {

  resolveOrderProcessType,

  scopeOrderLinePrices,

  type OrderProcessType,

} from './process-scope'

import type { OrderCategory, OrderRowPayload } from './types'

import {

  computeLineAmount,

  computeOrderLineAmortizedUnitPrice,

  computeOrderLineMaterialCost,

  todayYmdSeoul,

} from './utils'



export type BuildOrderFromQuoteInput = {

  quote: QuoteListItem

  category?: OrderCategory

  paymentTerms?: PaymentTermSnapshot

}



/**

 * 견적 1건 → 발주서 1라인 페이로드.

 * 견적의 공정·단가 구성을 반영하고, 없으면 품목 표준단가로 보완한다.

 */

export function buildOrderPayloadFromQuote(

  input: BuildOrderFromQuoteInput,

  products: Product[],

  salesPartners: BusinessPartner[],

): { ok: true; payload: OrderRowPayload } | { ok: false; detail: string } {

  const quote = input.quote

  const partner = resolvePartnerFromInput(salesPartners, quote.customer)

  if (!partner) {

    return {

      ok: false,

      detail: '거래처등록에 등록된 거래처만 발주서로 전환할 수 있습니다.',

    }

  }



  const productName = String(quote.productName || '').trim()

  if (!productName) {

    return { ok: false, detail: '제품명이 없습니다.' }

  }



  const quantity = Math.max(0, Math.floor(Number(quote.boardQty) || 0))

  if (quantity <= 0) {

    return { ok: false, detail: '보드 수량이 올바르지 않습니다.' }

  }



  const matched = resolveOrderLineProduct(products, partner.name, {

    productId: null,

    productName,

  })

  if (!matched) {

    return {

      ok: false,

      detail: `「${productName}」 제품이 품목등록에 없습니다. 기초등록 → 품목등록에서 해당 고객사 반제품을 먼저 등록해 주세요.`,

    }

  }



  const quoteBreakdown = buildItemPriceBreakdownFromQuote(quote)

  const quoteProcess = processTypeFromQuote(quote)

  const processType: OrderProcessType = resolveOrderProcessType({

    processType: quoteProcess,

    productProcessType: matched.processType,

    setupCost: quoteBreakdown.setupUnitPrice || matched.setupUnitPrice,

    smdUnitPrice: quoteBreakdown.smdUnitPrice || matched.smdUnitPrice,

    dipUnitPrice: quoteBreakdown.dipUnitPrice || matched.dipUnitPrice,

  })



  const masterSetup = Math.max(0, Math.round(Number(matched.setupUnitPrice) || 0))

  const masterSmd = Math.max(0, Math.round(Number(matched.smdUnitPrice) || 0))

  const masterDip = Math.max(0, Math.round(Number(matched.dipUnitPrice) || 0))

  const masterMaterial = Math.max(0, Math.round(Number(matched.materialUnitPrice) || 0))



  const setupCost = quoteBreakdown.setupUnitPrice > 0 ? quoteBreakdown.setupUnitPrice : masterSetup

  const smdUnitPrice = quoteBreakdown.smdUnitPrice > 0 ? quoteBreakdown.smdUnitPrice : masterSmd

  const dipUnitPrice = quoteBreakdown.dipUnitPrice > 0 ? quoteBreakdown.dipUnitPrice : masterDip

  const materialUnitPrice =

    quoteBreakdown.materialUnitPrice > 0 ? quoteBreakdown.materialUnitPrice : masterMaterial



  const scoped = scopeOrderLinePrices({

    processType,

    setupCost,

    smdUnitPrice,

    dipUnitPrice,

    materialUnitPrice,

  })



  const unitPrice = computeOrderLineAmortizedUnitPrice({

    quantity,

    setupCost: scoped.setupCost,

    smdUnitPrice: scoped.smdUnitPrice,

    dipUnitPrice: scoped.dipUnitPrice,

    materialUnitPrice: scoped.materialUnitPrice,

  })

  const materialCost = computeOrderLineMaterialCost(quantity, scoped.materialUnitPrice)

  const orderAmount = computeLineAmount(quantity, unitPrice)

  const productionKind = quote.detailInfo.settings?.productionKind



  return {

    ok: true,

    payload: {

      order_date: todayYmdSeoul(),

      delivery_date: '',

      customer: partner.name,

      category:

        input.category === '샘플' || productionKind === '샘플'

          ? '샘플'

          : input.category === '자재'

            ? '자재'

            : '양산',

      note: `견적 ${quote.quoteNumber} 전환`,

      source: 'quote',

      source_quote_id: quote.quoteId || quote.quoteNumber,

      paymentTerms: input.paymentTerms || snapshotFromPartner(partner),

      items: [

        {

          productId: matched.id,

          productCode: matched.productCode,

          productName: matched.productName,

          quantity,

          unitPrice,

          orderAmount,

          setupCost: scoped.setupCost,

          smdUnitPrice: scoped.smdUnitPrice,

          dipUnitPrice: scoped.dipUnitPrice,

          materialCost,

          processType,

          deliveryDate: '',

        },

      ],

    },

  }

}


