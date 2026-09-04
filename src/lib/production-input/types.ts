export type ProductionOrderState = 'none' | 'progress' | 'full'

export type ProductionProductKind = 'semi' | 'finished'

export type ProductionPcbSideMode = 'single' | 'duo' | 'double'

export type ProductionOrderLine = {
  uiKey: string
  countKey: string
  orderLineId: string
  /** 발주서 PK — 생산계획 드래그/집계용 */
  orderId: string
  /** 후공정·출하 — order_assembly_groups.id */
  assemblyGroupId?: string
  /** 내부 발주ID (MRO-…) — 조인·키용 */
  orderNumber: string
  /** 고객 발주번호(PO) — 화면 표시용 */
  customerPoNumber: string
  /** 작업번호 — {고객접두}-{발주일}-01 (발주번호 아래 표시) */
  workNumber: string
  orderDate: string
  deliveryDate: string
  customer: string
  productId?: string
  productCode: string
  /** 버전 라벨 (마스터 기준, 표시용) */
  productVersion: string | null
  productName: string
  productLabel: string
  quantity: number
  unitPrice: number
  lineSeq: number
  productKind: ProductionProductKind
  productKindLabel: string
  /** 제품 마스터 면구분 (표시용) */
  pcbSideMode: ProductionPcbSideMode
  /** SMT 양면일 때만 TOP/BOT 분리 입력 */
  splitPcbSides: boolean
}

export type ProductionCounts = Record<string, number>

export type ProductionPageData = {
  orders: ProductionOrderLine[]
  counts: ProductionCounts
  defectCounts: ProductionCounts
}

export type ProductionInputConfig = {
  productKindLabel: string
  fetchErrorTitle: string
  qtyInputId: string
  productionModule: 'smt' | 'post_process' | 'delivery'
}
