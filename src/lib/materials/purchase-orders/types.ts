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

export type OrderPurchaseStatus = 'none' | 'partial' | 'done'

/** 주문서 발주 — 제품(주문 라인) 단위 부분 발주 현황 */
export type OrderPurchaseProductLine = {
  orderLineId: string
  productId: string
  productCode: string
  productName: string
  orderQuantity: number
  /** 이 라인에 연결된 발주서들의 covered_product_quantity 합 */
  coveredQuantity: number
  remainingQuantity: number
  purchaseStatus: OrderPurchaseStatus
  /** 해당 제품 BOM(구성) 등록 여부 — 없으면 발주 불가 */
  hasBom: boolean
}

export type OrderPurchaseCard = {
  key: string
  orderId: string
  orderNumber: string
  customer: string
  deliveryDate: string
  orderDate: string
  products: OrderPurchaseProductLine[]
  purchaseStatus: OrderPurchaseStatus
}

/** 부분 발주 시 BOM 전개 미리보기 라인 */
export type OrderPurchaseMaterialPreview = {
  materialId: string
  materialCode: string
  materialName: string
  specification: string
  mpn: string
  supplier: string
  unitPrice: number
  requiredQuantity: number
  onHandQuantity: number
  /** 발주수량 = max(0, 소요 − 현재고) */
  suggestedQuantity: number
}

/** @deprecated 구 주문서 카드 UI 호환용 — 신규는 OrderPurchaseCard 사용 */
export type MaterialPurchaseNeedLine = {
  materialId: string
  materialCode: string
  materialName: string
  specification: string
  mpn: string
  supplier: string
  unitPrice: number
  requiredQuantity: number
  onHandQuantity: number
  shortageQuantity: number
  status: '부족' | '충분'
}

/** @deprecated 구 주문서 카드 UI 호환용 */
export type MaterialPurchaseNeedCard = {
  key: string
  orderId: string
  orderNumber: string
  customer: string
  deliveryDate: string
  orderDate: string
  productLabel: string
  productQuantity: number
  materialCount: number
  shortageCount: number
  sufficientCount: number
  lines: MaterialPurchaseNeedLine[]
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
  /** 부분 발주 시 커버한 주문 라인 */
  coveredOrderLineId: string | null
  /** 부분 발주 시 커버한 제품 수량 */
  coveredProductQuantity: number
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
  covered_order_line_id?: string | null
  covered_product_quantity?: number | null
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
  /** 부분 발주 — 커버한 주문 라인 / 제품 수량 */
  covered_order_line_id?: string | null
  covered_product_quantity?: number | null
  items: MaterialPurchaseOrderLineItem[]
}
