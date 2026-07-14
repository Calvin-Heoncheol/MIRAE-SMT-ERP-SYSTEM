export type MetalMaskPcbSide = 'SINGLE' | 'TOP' | 'BOT'

export type MetalMaskStatus = 'active' | 'retired'

export type MetalMaskAsset = {
  id: string
  barcode: string
  name: string
  pcbSide: MetalMaskPcbSide
  useLimit: number
  useCount: number
  status: MetalMaskStatus
  note: string
  createdAt: string
  updatedAt: string
}

export type MetalMaskAssetPayload = {
  barcode: string
  name?: string
  pcbSide: MetalMaskPcbSide
  useLimit?: number
  note?: string
}

export type MetalMaskUsageLog = {
  id: string
  assetId: string
  smtProductionRecordId: string | null
  pcbSide: MetalMaskPcbSide
  deltaQty: number
  recordDate: string
  createdAt: string
}

export const DEFAULT_METAL_MASK_USE_LIMIT = 50000

/** 잔여가 이 값 이하면 교체 임박으로 표시 */
export const METAL_MASK_WARN_REMAINING = 1000

export const METAL_MASK_PCB_SIDE_LABELS: Record<MetalMaskPcbSide, string> = {
  SINGLE: '단면',
  TOP: 'TOP',
  BOT: 'BOT',
}

export const METAL_MASK_STATUS_LABELS: Record<MetalMaskStatus, string> = {
  active: '사용중',
  retired: '교체완료',
}
