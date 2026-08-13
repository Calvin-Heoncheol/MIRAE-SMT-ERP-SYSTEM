export type ProductionLotSource = 'production' | 'backfill' | 'catch_up'

export type ProductionLot = {
  id: string
  lotDate: string
  assemblyGroupId: string
  productCode: string
  productName: string
  orderId: string
  quantity: number
  shippedQuantity: number
  remaining: number
  source: string
}

export type LotAllocation = {
  lotId: string
  lotDate: string
  quantity: number
  remaining: number
}

export type LotSyncResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }
