import type { SmtProductionHistoryRow } from '@/lib/smt/types'

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
}
