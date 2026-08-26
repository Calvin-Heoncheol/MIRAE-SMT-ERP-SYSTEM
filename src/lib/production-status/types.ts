import type { DeliveryAvailability } from '@/lib/delivery/utils'
import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'

export type ProductionStatusStage = 'smt' | 'post_process' | 'delivery'

/** 조립제품 행에 중첩되는 BOM 반제품 SMT 진행 */
export type ProductionStatusSmtChild = {
  key: string
  productName: string
  productCode: string
  version: string
  quantity: number
  smtTarget: number
  smtProduced: number
  smtDefected: number
  smtPercent: number
  smtDefectPercent: number
  smtOrderLineIds: string[]
}

/** 주문 내 제품(라인)별 진행 — 펼친 행 */
export type ProductionStatusProductLine = {
  key: string
  productName: string
  productCode: string
  version: string
  quantity: number
  smtTarget: number
  smtProduced: number
  smtDefected: number
  smtPercent: number
  smtDefectPercent: number
  postTarget: number
  postProduced: number
  postDefected: number
  postPercent: number
  postDefectPercent: number
  deliveryTarget: number
  deliveryProduced: number
  deliveryPercent: number
  /** 모달 SMT 필터 */
  smtOrderLineIds: string[]
  /** 모달 후공정·출하 필터 */
  assemblyGroupIds: string[]
  /** 조립제품: 구성 반제품 SMT (부모 행 요약 + 펼침) */
  smtChildren: ProductionStatusSmtChild[]
}

export type ProductionStatusLine = {
  orderId: string
  /** 내부 발주ID (MRO-…) */
  orderNumber: string
  /** 고객 발주번호(PO) — 화면 표시용 */
  customerPoNumber: string
  customer: string
  productName: string
  /** 펼친 행에 쓰는 제품 수 */
  productCount: number
  deliveryDate: string
  /** 발주서 주문수량 합계 */
  quantity: number
  smtTarget: number
  smtProduced: number
  smtDefected: number
  smtPercent: number
  smtDefectPercent: number
  postTarget: number
  postProduced: number
  postDefected: number
  postPercent: number
  postDefectPercent: number
  deliveryTarget: number
  deliveryProduced: number
  deliveryPercent: number
  products: ProductionStatusProductLine[]
}

export type ProductionStatusPageData = {
  lines: ProductionStatusLine[]
  /** 클릭 없이 바로 입력용 */
  smtOrders: ProductionOrderLine[]
  postOrders: ProductionOrderLine[]
  deliveryOrders: ProductionOrderLine[]
  smtCounts: ProductionCounts
  smtDefectCounts: ProductionCounts
  postCounts: ProductionCounts
  postDefectCounts: ProductionCounts
  deliveryCounts: ProductionCounts
  deliveryAvailabilityByGroupId: Record<string, DeliveryAvailability>
}
