export type OrderCategory = '양산' | '샘플' | '자재'

export const ORDER_CATEGORIES: OrderCategory[] = ['양산', '샘플', '자재']

export type OrderLineItem = {
  lineId?: string
  productId?: string | null
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  orderAmount: number
  /** BOM 펼침으로 생성된 반제품 줄 */
  derivedFromLineId?: string | null
}

export type OrderListGroup = {
  orderId: string
  orderNumber: string
  orderDate: string
  deliveryDate: string
  customer: string
  category: OrderCategory
  items: OrderLineItem[]
  totalQuantity: number
  totalAmount: number
  source?: string
  sourceQuoteId?: string | null
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
  derived_from_line_id?: string | null
}

export type OrderRecord = {
  id: string
  order_date: string
  delivery_date: string | null
  customer: string
  category: string
  source: string
  source_quote_id: string | null
  created_at: string
  updated_at: string
  order_lines: OrderLineRecord[]
}

export type OrderRowPayload = {
  order_date: string
  delivery_date: string
  customer: string
  category: OrderCategory
  source?: string
  source_quote_id?: string | null
  items: OrderLineItem[]
}
