import type { Material } from '@/lib/materials/types'
import { computePurchaseOrderRemainingQuantity } from '@/lib/materials/purchase-orders/utils'
import type { InventoryFilterMode, MaterialInventoryRow, MaterialPurchaseOrderLineAggregateRecord } from './types'

export function computePendingInboundQuantity(quantity: number, inboundQuantity: number) {
  return computePurchaseOrderRemainingQuantity(quantity, inboundQuantity)
}

export function aggregatePendingInboundByMaterialId(
  lines: MaterialPurchaseOrderLineAggregateRecord[],
): Map<string, number> {
  const totals = new Map<string, number>()

  for (const line of lines) {
    const materialId = line.material_id?.trim()
    if (!materialId) continue

    const pending = computePendingInboundQuantity(line.quantity, line.inbound_quantity)
    if (pending <= 0) continue

    totals.set(materialId, (totals.get(materialId) ?? 0) + pending)
  }

  return totals
}

export function mergeMaterialInventoryRows(
  materials: Material[],
  pendingByMaterialId: Map<string, number>,
  onHandByMaterialId: Map<string, number>,
): MaterialInventoryRow[] {
  return materials.map((material) => ({
    ...material,
    onHandQuantity: onHandByMaterialId.get(material.id) ?? 0,
    expectedInboundQuantity: pendingByMaterialId.get(material.id) ?? 0,
  }))
}

export function matchesInventoryQuery(row: MaterialInventoryRow, query: string) {
  if (!query) return true

  const haystack = [
    row.id,
    row.customer,
    row.materialName,
    row.specification,
    row.type,
    row.mpn,
    ...row.alternateMpns,
    row.supplier,
    row.supplyType,
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

export function matchesInventoryFilter(row: MaterialInventoryRow, mode: InventoryFilterMode) {
  if (mode === 'pending') return row.expectedInboundQuantity > 0
  if (mode === 'negative') return row.onHandQuantity < 0
  return true
}

export function formatInventoryQuantity(value: number) {
  return value.toLocaleString('ko-KR')
}

export function summarizeInventoryRows(rows: MaterialInventoryRow[]) {
  return {
    total: rows.length,
    expectedInboundCount: rows.filter((row) => row.expectedInboundQuantity > 0).length,
    negativeCount: rows.filter((row) => row.onHandQuantity < 0).length,
  }
}
