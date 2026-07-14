import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'
import type { SmtPcbSide } from '@/lib/smt/types'

export type SmtProductionPlan = {
  id: string
  orderId: string
  orderLineId: string
  plannedDate: string
  lineNo: number
  pcbSide: SmtPcbSide
  plannedQuantity: number
  note: string
  createdAt: string
}

/** 주문 라인 단위 계획 후보 (드래그·모달 수량용) */
export type SmtPlanOrderCandidate = {
  orderId: string
  orderLineId: string
  orderNumber: string
  customer: string
  productSummary: string
  deliveryDate: string
  splitPcbSides: boolean
  smtTarget: number
  smtProduced: number
  smtRemaining: number
  plannedTotal: number
  unplannedRemaining: number
  unplannedBySide: Partial<Record<SmtPcbSide, number>>
  daysUntilDelivery: number | null
}

export type SmtPlanBlock = SmtProductionPlan & {
  orderNumber: string
  customer: string
  productSummary: string
  deliveryDate: string
  splitPcbSides: boolean
}

export type SmtPlanPageData = {
  weekStart: string
  weekDates: string[]
  lineNos: number[]
  plans: SmtPlanBlock[]
  /** 생산입력과 동일한 라인 단위 주문 선택 목록 */
  productionOrders: ProductionOrderLine[]
  counts: ProductionCounts
  /** 주문 라인 단위 계획 후보 (드래그·모달 수량용) */
  planCandidates: SmtPlanOrderCandidate[]
  /** 주간 계획 대비 실적 (date:orderLine:pcbSide:lineNo) */
  planProgress: Record<string, number>
}

export type UpsertSmtProductionPlanInput = {
  id?: string
  orderId: string
  orderLineId: string
  plannedDate: string
  lineNo: number
  pcbSide: SmtPcbSide
  plannedQuantity: number
  note?: string
}
