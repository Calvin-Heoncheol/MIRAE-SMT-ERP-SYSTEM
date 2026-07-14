export type SqueegeeStatus = 'active' | 'retired'

export type SqueegeeAsset = {
  id: string
  barcode: string
  name: string
  useLimit: number
  useCount: number
  status: SqueegeeStatus
  note: string
  createdAt: string
  updatedAt: string
}

export type SqueegeeAssetPayload = {
  barcode: string
  name?: string
  useLimit?: number
  note?: string
}

export type SqueegeeUsageLog = {
  id: string
  assetId: string
  deltaQty: number
  recordDate: string
  createdAt: string
}

export const DEFAULT_SQUEEGEE_USE_LIMIT = 50000

/** 잔여가 이 값 이하면 교체 임박으로 표시 */
export const SQUEEGEE_WARN_REMAINING = 1000

export const SQUEEGEE_STATUS_LABELS: Record<SqueegeeStatus, string> = {
  active: '사용중',
  retired: '교체완료',
}
