import type { DeliveryAvailability } from '@/lib/delivery/utils'
import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'
import type { SmtProductionHistoryRow } from '@/lib/smt/types'

export type ProductionStatusStage = 'smt' | 'post_process' | 'delivery'

export type ProductionStatusLine = {
  orderId: string
  orderNumber: string
  customer: string
  productName: string
  quantity: number
  smtProduced: number
  smtPercent: number
  postTarget: number
  postProduced: number
  postPercent: number
  deliveryTarget: number
  deliveryProduced: number
  deliveryPercent: number
}

export type TodayProductionStageKey =
  | 'smt'
  | 'post_process_2'
  | 'post_process_3'
  | 'post_process_4'

export type TodayProductionStage = {
  key: TodayProductionStageKey
  label: string
  recordCount: number
  quantity: number
  linked: boolean
}

export type ProductionStatusPageData = {
  todayDate: string
  todayStages: TodayProductionStage[]
  todaySmtRecords: SmtProductionHistoryRow[]
  lines: ProductionStatusLine[]
  /** 계획 없이 바로 입력용 */
  smtOrders: ProductionOrderLine[]
  postOrders: ProductionOrderLine[]
  deliveryOrders: ProductionOrderLine[]
  smtCounts: ProductionCounts
  postCounts: ProductionCounts
  deliveryCounts: ProductionCounts
  deliveryAvailabilityByGroupId: Record<string, DeliveryAvailability>
}
