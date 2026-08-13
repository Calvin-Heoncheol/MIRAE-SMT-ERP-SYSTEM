import type { Material } from '@/lib/materials/types'

export type MaterialInventoryRow = Material & {
  onHandQuantity: number
  expectedInboundQuantity: number
}

export type MaterialPurchaseOrderLineAggregateRecord = {
  material_id: string | null
  quantity: number
  inbound_quantity: number
  /** 라인 입고예정일 (없으면 null) */
  delivery_date?: string | null
}

export type PendingInboundAggregate = {
  pendingByMaterialId: Map<string, number>
  /** 미입고 잔량이 있는 라인 중 자재별 최만기 납기 (YYYY-MM-DD) */
  latestDeliveryDateByMaterialId: Map<string, string>
}

export const INVENTORY_FILTER_MODES = ['all', '도급', '사급'] as const
export type InventoryFilterMode = (typeof INVENTORY_FILTER_MODES)[number]
