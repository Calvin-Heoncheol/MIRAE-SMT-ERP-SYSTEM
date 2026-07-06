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
  shipTarget: number
  shipProduced: number
  shipPercent: number
}

export type TodayProductionStageKey = 'smt' | 'post_process' | 'shipment'

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
