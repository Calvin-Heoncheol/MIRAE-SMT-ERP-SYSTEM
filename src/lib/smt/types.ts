export type SmtPcbSide = 'SINGLE' | 'TOP' | 'BOT'

export type SmtProductionSource = 'manual' | 'line_sync'

export type SmtProductionRecord = {
  id: string
  recordDate: string
  orderLineId: string
  lineNo: number | null
  pcbSide: SmtPcbSide
  quantity: number
  source: SmtProductionSource
  note: string
  createdAt: string
}

export type CreateSmtProductionRecordInput = {
  orderLineId: string
  quantity: number
  recordDate?: string
  lineNo?: number | null
  pcbSide?: SmtPcbSide
  source?: SmtProductionSource
  note?: string
}

export type SmtProductionHistoryRow = {
  id: string
  recordDate: string
  createdAt: string
  orderNumber: string
  customer: string
  productName: string
  productCode: string
  orderQuantity: number
  quantity: number
  lineNo: number | null
  pcbSide: SmtPcbSide
  source: SmtProductionSource
  note: string
}
