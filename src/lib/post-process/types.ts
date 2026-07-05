export type PostProcessProductionSource = 'manual'

export type PostProcessProductionRecord = {
  id: string
  recordDate: string
  assemblyGroupId: string
  quantity: number
  source: PostProcessProductionSource
  note: string
  createdAt: string
}

export type CreatePostProcessProductionRecordInput = {
  assemblyGroupId: string
  quantity: number
  recordDate?: string
  source?: PostProcessProductionSource
  note?: string
}

export type PostProcessProductionHistoryRow = {
  id: string
  recordDate: string
  createdAt: string
  orderNumber: string
  customer: string
  productName: string
  productCode: string
  targetQuantity: number
  quantity: number
  source: PostProcessProductionSource
  note: string
}
