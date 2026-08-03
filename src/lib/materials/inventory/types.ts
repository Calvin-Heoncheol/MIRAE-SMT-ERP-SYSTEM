import type { Material } from '@/lib/materials/types'

export type MaterialInventoryRow = Material & {
  onHandQuantity: number
  expectedInboundQuantity: number
}

export type MaterialPurchaseOrderLineAggregateRecord = {
  material_id: string | null
  quantity: number
  inbound_quantity: number
}

export const INVENTORY_FILTER_MODES = ['all', 'pending', 'negative'] as const
export type InventoryFilterMode = (typeof INVENTORY_FILTER_MODES)[number]
