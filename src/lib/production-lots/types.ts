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
  | { ok: true; usedCatchUp?: boolean }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

/** catch_up LOT 생성 시 사용자에게 보여줄 안내 */
export const CATCH_UP_LOT_WARNING =
  '생산 LOT 잔량이 부족해 보충 LOT가 생성되었습니다. 재고·생산실적을 확인해 주세요.'
