export type DeliverySource = 'manual'

export type DeliveryRecord = {
  id: string
  recordDate: string
  assemblyGroupId: string
  quantity: number
  source: DeliverySource
  note: string
  createdAt: string
}

export type CreateDeliveryRecordInput = {
  assemblyGroupId: string
  quantity: number
  /** 비어 있으면 record_date 기준 MRS260706 형식 자동 발급 */
  shipmentNumber?: string
  recordDate?: string
  source?: DeliverySource
  note?: string
}

export type DeliveryHistoryRow = {
  id: string
  recordDate: string
  createdAt: string
  orderNumber: string
  customer: string
  productName: string
  productCode: string
  targetQuantity: number
  quantity: number
  source: DeliverySource
  note: string
}
