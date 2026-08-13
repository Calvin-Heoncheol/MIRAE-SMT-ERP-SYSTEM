export type PostProcessProductionSource = 'manual'

export type PostProcessProductionRecord = {
  id: string
  recordDate: string
  assemblyGroupId: string
  /** 양품 수량 */
  quantity: number
  /** 불량 수량 (게이지에 빨간색으로 표시, 잔량·완료 판정에는 미포함) */
  defectQuantity: number
  source: PostProcessProductionSource
  team: string
  note: string
  createdBy: string | null
  createdByName: string
  createdAt: string
}

export type CreatePostProcessProductionRecordInput = {
  assemblyGroupId: string
  /** 양품 수량 */
  quantity: number
  /** 불량 수량 (미입력·비어 있으면 0) */
  defectQuantity?: number
  recordDate?: string
  source?: PostProcessProductionSource
  team?: string
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
  /** 양품 수량 */
  quantity: number
  /** 불량 수량 */
  defectQuantity: number
  source: PostProcessProductionSource
  team: string
  note: string
  createdByName: string
}
