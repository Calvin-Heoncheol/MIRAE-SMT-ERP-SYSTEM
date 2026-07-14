import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'
import type { PostProcessTeam } from '@/lib/post-process/teams'

export type PostProcessProductionPlan = {
  id: string
  orderId: string
  assemblyGroupId: string
  plannedDate: string
  team: PostProcessTeam
  plannedQuantity: number
  note: string
  createdAt: string
}

/** 조립 그룹 단위 계획 후보 (드래그·모달 수량용) — 팀은 공유 */
export type PostProcessPlanOrderCandidate = {
  orderId: string
  assemblyGroupId: string
  orderNumber: string
  customer: string
  productSummary: string
  deliveryDate: string
  target: number
  produced: number
  remaining: number
  plannedTotal: number
  unplannedRemaining: number
  daysUntilDelivery: number | null
}

export type PostProcessPlanBlock = PostProcessProductionPlan & {
  orderNumber: string
  customer: string
  productSummary: string
  deliveryDate: string
}

export type PostProcessPlanPageData = {
  weekStart: string
  weekDates: string[]
  /** 주간 전체 팀 계획 (UI에서 팀 필터) */
  plans: PostProcessPlanBlock[]
  productionOrders: ProductionOrderLine[]
  counts: ProductionCounts
  planCandidates: PostProcessPlanOrderCandidate[]
  /** 주간 계획 대비 실적 (date:assemblyGroupId:team) */
  planProgress: Record<string, number>
}

export type UpsertPostProcessProductionPlanInput = {
  id?: string
  orderId: string
  assemblyGroupId: string
  plannedDate: string
  team: PostProcessTeam
  plannedQuantity: number
  note?: string
}
