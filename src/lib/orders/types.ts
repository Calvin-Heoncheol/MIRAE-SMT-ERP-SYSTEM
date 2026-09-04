import type { PaymentTermSnapshot } from '@/lib/partners/payment-term-snapshot'

export type OrderCategory = '양산' | '샘플' | '자재'

export const ORDER_CATEGORIES: OrderCategory[] = ['양산', '샘플', '자재']

/** 발주서 표시 통화 */
export type OrderCurrency = 'KRW' | 'USD'

export const ORDER_CURRENCIES: OrderCurrency[] = ['KRW', 'USD']

export const ORDER_CURRENCY_LABELS: Record<OrderCurrency, string> = {
  KRW: '원화 (KRW)',
  USD: '달러 (USD)',
}

export type OrderLineItem = {
  lineId?: string
  productId?: string | null
  productCode: string
  productName: string
  quantity: number
  /** 대당 참고 (SMD+후공정) */
  unitPrice: number
  orderAmount: number
  /** SET-UP 전체 비용 */
  setupCost: number
  /** SMD 대당 */
  smdUnitPrice: number
  /** 후공정 대당 */
  dipUnitPrice: number
  /** 자재비 (회차별 총액) */
  materialCost: number
  /** 제품(라인)별 납기일 YYYY-MM-DD */
  deliveryDate: string
  /** BOM 펼침으로 생성된 반제품 줄 */
  derivedFromLineId?: string | null
  /** 작업번호 — {고객접두}-{발주일}-{NN} (예: LEE-260904-01, 추가작업은 없음) */
  workNumber?: string | null
}

export type OrderListGroup = {
  orderId: string
  orderNumber: string
  orderDate: string
  deliveryDate: string
  customer: string
  category: OrderCategory
  /** 표시 통화 — 기본 KRW */
  currency: OrderCurrency
  note: string
  /** 발주번호(고객 PO/NO) — 발주ID와 별도 */
  customerPoNumber: string
  items: OrderLineItem[]
  totalQuantity: number
  totalAmount: number
  source?: string
  sourceQuoteId?: string | null
  paymentTerms: PaymentTermSnapshot
  createdBy?: string | null
  createdByName: string
  createdAt: string
}

export type OrderLineRecord = {
  id: string
  order_id: string
  line_seq: number
  product_id: string | null
  product_code: string
  product_name: string
  quantity: number
  unit_price: number
  order_amount: number
  setup_cost?: number | null
  smd_unit_price?: number | null
  dip_unit_price?: number | null
  material_cost?: number | null
  delivery_date?: string | null
  derived_from_line_id?: string | null
  work_number?: string | null
}

export type OrderRecord = {
  id: string
  order_date: string
  delivery_date: string | null
  customer: string
  category: string
  currency?: string | null
  source: string
  source_quote_id: string | null
  note?: string
  customer_po_number?: string
  payment_term_type?: string | null
  payment_deposit_percent?: number | null
  payment_net_days?: number | null
  payment_monthly_day?: number | null
  created_by?: string | null
  created_by_name?: string | null
  created_at: string
  updated_at: string
  order_lines: OrderLineRecord[]
}

export type OrderRowPayload = {
  id?: string
  order_date: string
  delivery_date: string
  customer: string
  category: OrderCategory
  currency?: OrderCurrency
  note?: string
  customer_po_number?: string
  source?: string
  source_quote_id?: string | null
  paymentTerms?: PaymentTermSnapshot
  items: OrderLineItem[]
}
