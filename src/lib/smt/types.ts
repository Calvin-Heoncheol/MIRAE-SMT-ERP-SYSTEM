export type SmtPcbSide = 'SINGLE' | 'TOP' | 'BOT'

export type SmtProductionSource = 'manual' | 'line_sync'

export type SmtProductionRecord = {
  id: string
  recordDate: string
  orderLineId: string
  lineNo: number | null
  pcbSide: SmtPcbSide
  /** 양품 수량 */
  quantity: number
  /** 불량 수량 (진행률·잔량 미포함) */
  defectQuantity: number
  source: SmtProductionSource
  note: string
  createdAt: string
}

export type CreateSmtProductionRecordInput = {
  orderLineId: string
  /** 양품 수량 */
  quantity: number
  /** 불량 수량 (미입력·비어 있으면 0) */
  defectQuantity?: number
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
  /** 양품 수량 */
  quantity: number
  /** 불량 수량 */
  defectQuantity: number
  lineNo: number | null
  pcbSide: SmtPcbSide
  source: SmtProductionSource
  note: string
}
