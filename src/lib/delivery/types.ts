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
  /** 비어 있으면 MRS-0001 형식 순번 자동 발급 */
  shipmentNumber?: string
  recordDate?: string
  source?: DeliverySource
  note?: string
}

export type UpdateDeliveryRecordInput = {
  recordDate?: string
  quantity?: number
  note?: string
}

export type DeliveryHistoryRow = {
  id: string
  assemblyGroupId: string
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

export type DeliveryStatementData = {
  docNo: string
  shipDate: string
  orderNumber: string
  customer: string
  productName: string
  productCode: string
  qty: number
  unitPrice: number
  supplyAmount: number
  note: string
}
