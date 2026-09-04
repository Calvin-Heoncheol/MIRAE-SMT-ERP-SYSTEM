import type { MaterialInboundStatus } from '@/lib/materials/material-inbound-status'

export type ProductionPlanScope = 'material' | 'smt' | 'post'

/** 표 입력 목록 필터 — 지금 배정 / 이번 달 확정 / 미완료 전체 */
export type ProductionPlanSheetFilter = 'actionable' | 'month' | 'all_pending'

export type ProductionPlanBoardStatus = 'waiting' | 'confirmed'

export type ProductionPlanPcbSide = 'SINGLE' | 'TOP' | 'BOT' | 'BOTH'

export type ProductionPlanBoardRow = {
  key: string
  scope: ProductionPlanScope
  orderId: string
  orderNumber: string
  /** 고객 발주번호(PO) — 화면 표시용 */
  customerPoNumber?: string
  customer: string
  deliveryDate: string
  daysUntilDelivery: number | null
  productId: string
  productName: string
  productCode: string
  productKindLabel: string
  /** SMT·자재: order_line_id / 후공정: assembly_group_id */
  targetId: string
  splitPcbSides: boolean
  orderQty: number
  producedQty: number
  remainingQty: number
  materialReadyQty: number
  materialScheduledQty?: number
  /** 입고예정 병목일(YYYY-MM-DD) */
  materialExpectedReadyDate?: string
  materialShort: boolean
  /** (레거시) 자재 자동 계산 불가 — 수동 입고 사용 시 false */
  materialUnknown: boolean
  materialInboundStatus?: MaterialInboundStatus
  /** 후공정 행 — 같은 발주 SMD 계획 종료일 */
  smtPlannedEndDate?: string
  status: ProductionPlanBoardStatus
  confirmedAt: string
  confirmedByName: string
  plannedDate: string
  lineNo: number | null
  team: string
  pcbSide: ProductionPlanPcbSide
  plannedQuantity: number | null
  /** 확정된 계획 수량 합계 (분할 배정) */
  plannedTotalQty?: number
  /** 아직 계획되지 않은 수량 */
  unplannedQty?: number
  /** schedule=확정 일정, remainder=미계획 잔량 대기 */
  rowKind?: 'schedule' | 'remainder'
  /** smt/post 생산계획 테이블 id */
  planId?: string
  /** material 등 보드 테이블 id */
  boardItemId?: string
}

export type ConfirmProductionPlanScheduleInput = {
  scope: ProductionPlanScope
  orderId: string
  targetId: string
  plannedDate: string
  plannedQuantity: number
  /** SMT */
  lineNo?: number
  pcbSide?: ProductionPlanPcbSide
  /** 후공정 */
  team?: string
  note?: string
  planId?: string
  boardItemId?: string
}

export type ProductionPlanBoardPageData = {
  rows: ProductionPlanBoardRow[]
}

export type FetchProductionPlanBoardResult =
  | { ok: true; data: ProductionPlanBoardPageData }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export const PRODUCTION_PLAN_SCOPE_LABELS: Record<ProductionPlanScope, string> = {
  material: '자재',
  smt: 'SMT',
  post: '후공정',
}

export const PRODUCTION_PLAN_STATUS_LABELS: Record<ProductionPlanBoardStatus, string> = {
  waiting: '대기',
  confirmed: '확정',
}
