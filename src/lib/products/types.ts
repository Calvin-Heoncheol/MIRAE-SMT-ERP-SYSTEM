export type ProductPcbSideMode = 'single' | 'duo' | 'double'

export type ProductKind = 'pcb' | 'assembly'

/** 반제품 공정 — smt / post / smt_post (빈 값은 미설정) */
export type ProductProcessType = '' | 'smt' | 'post' | 'smt_post'

export type Product = {
  id: string
  customer: string
  productCode: string
  productName: string
  defaultUnitPrice: number
  pcbSideMode: ProductPcbSideMode
  processType: ProductProcessType
  productKind: ProductKind
  isActive: boolean
}

export type ProductPayload = {
  customer: string
  productName: string
  defaultUnitPrice?: number
  pcbSideMode?: ProductPcbSideMode
  processType?: ProductProcessType
  productKind?: 'pcb' | 'assembly'
  isActive?: boolean
}
