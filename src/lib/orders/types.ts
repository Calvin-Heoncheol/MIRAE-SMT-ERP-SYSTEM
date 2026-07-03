export type OrderCategory = '양산' | '샘플' | '자재'

export const ORDER_CATEGORIES: OrderCategory[] = ['양산', '샘플', '자재']

export type OrderLineItem = {
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  orderAmount: number
}

export type OrderListGroup = {
  orderNumber: string
  orderDate: string
  deliveryDate: string
  customer: string
  category: OrderCategory
  items: OrderLineItem[]
  totalQuantity: number
  totalAmount: number
  source?: string
  sourceQuoteNumber?: string | null
}

export type OrderLineRecord = {
  id: string
  order_id: string
  line_seq: number
  product_code: string
  product_name: string
  quantity: number
  unit_price: number
  order_amount: number
}

export type OrderRecord = {
  id: string
  order_number: string
  order_date: string
  delivery_date: string | null
  customer: string
  category: string
  source: string
  source_quote_number: string | null
  created_at: string
  updated_at: string
  order_lines: OrderLineRecord[]
}

export type OrderRowPayload = {
  order_number?: string
  order_date: string
  delivery_date: string
  customer: string
  category: OrderCategory
  source?: string
  source_quote_number?: string | null
  items: OrderLineItem[]
}
