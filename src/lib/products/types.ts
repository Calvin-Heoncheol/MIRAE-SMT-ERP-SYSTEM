export type ProductPcbSideMode = 'single' | 'duo' | 'double'

export type ProductKind = 'pcb' | 'assembly'

/** 반제품 공정 — smt / post / smt_post (빈 값은 미설정) */
export type ProductProcessType = '' | 'smt' | 'post' | 'smt_post'

export type Product = {
  id: string
  customer: string
  /** 표시용 품목코드 (버전 제외) */
  productCode: string
  /** 버전 라벨 (A1 등). 없으면 빈 문자열 */
  version: string
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
