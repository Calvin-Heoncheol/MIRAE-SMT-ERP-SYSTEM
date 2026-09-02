import type { ItemSmtQuoteParts } from '@/lib/items/smt-quote-parts'

export type ProductPcbSideMode = 'single' | 'duo' | 'double'

export type ProductKind = 'pcb' | 'assembly'

/** 반제품 공정 — SMD/DIP 단가로 유도 (smt / post / smt_post, 빈 값=생산공정 없음) */
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
  setupUnitPrice: number
  smdUnitPrice: number
  dipUnitPrice: number
  materialUnitPrice: number
  /** 추가비용 — 발주 추가작업 행 자동 반영 (items.other_unit_price) */
  additionalUnitPrice: number
  pcbSideMode: ProductPcbSideMode
  processType: ProductProcessType
  productKind: ProductKind
  /** @deprecated */
  smtQuoteParts: ItemSmtQuoteParts
  /** @deprecated */
  baselineQuoteId: string
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
