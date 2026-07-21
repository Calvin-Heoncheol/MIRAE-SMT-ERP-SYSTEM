/** 자재 기준 발주 제안 — 전체 미완료 주문의 소요를 자재별로 합산한 표준 MRP 라인 */
export type MaterialPurchaseSuggestionLine = {
  materialId: string
  materialName: string
  specification: string
  mpn: string
  supplier: string
  unitPrice: number
  /** 전체 주문 소요 합계 */
  totalRequiredQuantity: number
  /** 창고 현재고 (물리적 수량) */
  onHandQuantity: number
  /** 전체 발주서의 미입고 잔량 합계 */
  pendingInboundQuantity: number
  /** 발주필요 = 총소요 − 현재고 − 입고예정 */
  suggestedQuantity: number
}

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
  /** 연결된 고객 주문서(orders.id) — 주문서 카드에서 발주 시 자동 연결 */
  sourceOrderId: string | null
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
  source_order_id?: string | null
  created_at: string
  updated_at: string
  material_purchase_order_lines: MaterialPurchaseOrderLineRecord[]
}

export type MaterialPurchaseOrderRowPayload = {
  order_date: string
  delivery_date: string
  supplier: string
  /** 연결된 고객 주문서 — 신규 발주 시에만 설정 */
  source_order_id?: string | null
  items: MaterialPurchaseOrderLineItem[]
}
