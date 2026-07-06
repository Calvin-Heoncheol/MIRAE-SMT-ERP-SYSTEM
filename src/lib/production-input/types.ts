export type ProductionOrderState = 'none' | 'progress' | 'full'

export type ProductionProductKind = 'semi' | 'finished'

export type ProductionPcbSideMode = 'single' | 'dual'

export type ProductionOrderLine = {
  uiKey: string
  countKey: string
  orderLineId: string
  /** 후공정·출하 — order_assembly_groups.id */
  assemblyGroupId?: string
  orderNumber: string
  orderDate: string
  customer: string
  productCode: string
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
}

export type ProductionInputConfig = {
  productKindLabel: string
  fetchErrorTitle: string
  qtyInputId: string
  productionModule: 'smt' | 'post_process' | 'delivery'
}
