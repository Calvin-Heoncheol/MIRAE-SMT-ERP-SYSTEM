import type { MaterialInboundStatus } from '@/lib/materials/material-inbound-status'

export type ProductionPlanScope = 'material' | 'smt' | 'post'

export type ProductionPlanBoardStatus = 'waiting' | 'confirmed'

export type ProductionPlanPcbSide = 'SINGLE' | 'TOP' | 'BOT' | 'BOTH'

export type ProductionPlanBoardRow = {
  key: string
  scope: ProductionPlanScope
  orderId: string
  orderNumber: string
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
  /** BOM 없음 등으로 자재 계산 불가 */
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
