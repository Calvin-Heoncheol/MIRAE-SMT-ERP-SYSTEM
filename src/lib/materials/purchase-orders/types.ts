export const MATERIAL_PURCHASE_ORDER_STATUSES = ['발주'] as const
export type MaterialPurchaseOrderStatus = (typeof MATERIAL_PURCHASE_ORDER_STATUSES)[number]

export type MaterialPurchaseOrderLineItem = {
  lineId?: string
  materialId?: string | null
  materialCode: string
  materialName: string
  specification: string
  mpn: string
  quantity: number
  unitPrice: number
  orderAmount: number
  status: MaterialPurchaseOrderStatus
  inboundQuantity: number
}

export type MaterialPurchaseOrderListGroup = {
  orderId: string
  orderNumber: string
  orderDate: string
  deliveryDate: string
  supplier: string
  items: MaterialPurchaseOrderLineItem[]
  totalQuantity: number
  totalAmount: number
  createdAt: string
  hasInbound: boolean
}

export type MaterialPurchaseOrderLineRecord = {
  id: string
  order_id: string
  line_seq: number
  material_id: string | null
  cpn: string
  material_name: string
  specification: string
  mpn: string
  quantity: number
  unit_price: number
  order_amount: number
  status: string
  inbound_quantity: number
}

export type MaterialPurchaseOrderRecord = {
  id: string
  order_date: string
  delivery_date: string | null
  supplier: string
  created_at: string
  updated_at: string
  material_purchase_order_lines: MaterialPurchaseOrderLineRecord[]
}

export type MaterialPurchaseOrderRowPayload = {
  order_date: string
  delivery_date: string
  supplier: string
  items: MaterialPurchaseOrderLineItem[]
}
