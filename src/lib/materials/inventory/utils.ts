import type { Material } from '@/lib/materials/types'
import { computePurchaseOrderRemainingQuantity } from '@/lib/materials/purchase-orders/utils'
import type {
  InventoryFilterMode,
  MaterialInventoryRow,
  MaterialPurchaseOrderLineAggregateRecord,
  PendingInboundAggregate,
} from './types'

export function computePendingInboundQuantity(quantity: number, inboundQuantity: number) {
  return computePurchaseOrderRemainingQuantity(quantity, inboundQuantity)
}

function normalizeDeliveryYmd(value: string | null | undefined) {
  if (!value) return null
  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

export function aggregatePendingInboundByMaterialId(
  lines: MaterialPurchaseOrderLineAggregateRecord[],
): PendingInboundAggregate {
  const pendingByMaterialId = new Map<string, number>()
  const latestDeliveryDateByMaterialId = new Map<string, string>()

  for (const line of lines) {
    const materialId = line.material_id?.trim()
    if (!materialId) continue

    const pending = computePendingInboundQuantity(line.quantity, line.inbound_quantity)
    if (pending <= 0) continue

    pendingByMaterialId.set(materialId, (pendingByMaterialId.get(materialId) ?? 0) + pending)

    const deliveryDate = normalizeDeliveryYmd(line.delivery_date)
    if (!deliveryDate) continue
    const prev = latestDeliveryDateByMaterialId.get(materialId)
    if (!prev || deliveryDate > prev) {
      latestDeliveryDateByMaterialId.set(materialId, deliveryDate)
    }
  }

  return { pendingByMaterialId, latestDeliveryDateByMaterialId }
}

export function mergeMaterialInventoryRows(
  materials: Material[],
  pendingByMaterialId: Map<string, number>,
  onHandByMaterialId: Map<string, number>,
): MaterialInventoryRow[] {
  return materials.map((material) => {
    const onHandQuantity = onHandByMaterialId.get(material.id) ?? 0
    return {
      ...material,
      onHandQuantity,
      expectedInboundQuantity: pendingByMaterialId.get(material.id) ?? 0,
    }
  })
}

export function matchesInventoryQuery(row: MaterialInventoryRow, query: string) {
  if (!query) return true

  const haystack = [
    row.id,
    row.baseCode,
    row.materialName,
    row.specification,
    row.package,
    row.type,
    row.mpn,
    ...row.alternateMpns,
    row.supplyType,
    row.supplier,
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

export function matchesInventoryFilter(row: MaterialInventoryRow, mode: InventoryFilterMode) {
  if (mode === '도급') return row.supplyType === '도급'
  if (mode === '사급') return row.supplyType === '사급'
  return true
}

/** 사급 재고: 공급사 필드 = 고객사 */
export function matchesInventoryCustomer(row: MaterialInventoryRow, customer: string) {
  const q = customer.trim().toLowerCase()
  if (!q) return true
  return row.supplier.trim().toLowerCase().includes(q)
}

export function listInventoryConsigneeCustomers(rows: MaterialInventoryRow[]) {
  const names = new Set<string>()
  for (const row of rows) {
    if (row.supplyType !== '사급') continue
    const name = row.supplier.trim()
    if (name) names.add(name)
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'ko'))
}

export function formatInventoryQuantity(value: number) {
  return value.toLocaleString('ko-KR')
}

export function summarizeInventoryRows(rows: MaterialInventoryRow[]) {
  return {
    total: rows.length,
    contractCount: rows.filter((row) => row.supplyType === '도급').length,
    consignedCount: rows.filter((row) => row.supplyType === '사급').length,
    expectedInboundCount: rows.filter((row) => row.expectedInboundQuantity > 0).length,
    negativeCount: rows.filter((row) => row.onHandQuantity < 0).length,
  }
}
