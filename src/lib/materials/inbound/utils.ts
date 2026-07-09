import {
  computePurchaseOrderRemainingQuantity,
  formatMaterialPurchaseOrderDate,
} from '@/lib/materials/purchase-orders/utils'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import type { PurchaseInboundItemForm } from './form-state'
import type { MaterialInboundListGroup, MaterialInboundRecord, MaterialInboundType } from './types'
import { MATERIAL_INBOUND_TYPE_LABELS } from './types'

export function normalizeInboundType(value: string | null | undefined): MaterialInboundType {
  if (value === 'opening' || value === 'purchase' || value === 'supplied' || value === 'return') {
    return value
  }
  if (value === 'other') return 'supplied'
  return 'supplied'
}

export function getInboundTypeLabel(type: MaterialInboundType) {
  return MATERIAL_INBOUND_TYPE_LABELS[type]
}

export function mapInboundRecord(record: MaterialInboundRecord): MaterialInboundListGroup {
  const lines = [...(record.material_inbound_lines || [])].sort((a, b) => a.line_seq - b.line_seq)
  const items = lines.map((line) => ({
    lineId: line.id,
    materialId: line.material_id,
    purchaseOrderLineId: line.purchase_order_line_id,
    materialCode: line.materials?.id || line.material_id || '',
    materialName: line.materials?.material_name || '',
    specification: line.materials?.specification || '',
    mpn: line.materials?.mpn || '',
    quantity: Number(line.quantity) || 0,
  }))

  const inboundType = normalizeInboundType(record.inbound_type)

  return {
    inboundId: record.id,
    inboundNumber: record.id,
    inboundDate: formatMaterialPurchaseOrderDate(record.inbound_date),
    inboundType,
    purchaseOrderId: record.purchase_order_id,
    purchaseOrderNumber: record.purchase_order_id,
    note: record.note || '',
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: record.created_at,
  }
}

export function groupInboundsFromRecords(records: MaterialInboundRecord[]): MaterialInboundListGroup[] {
  return [...records]
    .map(mapInboundRecord)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function formatInboundMaterialSummary(group: MaterialInboundListGroup) {
  if (!group.items.length) return '-'
  const first = group.items[0]?.materialName.trim() || group.items[0]?.materialCode || '-'
  if (group.items.length === 1) return first
  return `${first} 외 ${group.items.length - 1}건`
}

export function aggregateOnHandByMaterialId(
  lines: { material_id: string; quantity: number }[],
): Map<string, number> {
  const totals = new Map<string, number>()

  for (const line of lines) {
    const materialId = line.material_id?.trim()
    if (!materialId) continue
    const quantity = Math.max(0, Number(line.quantity) || 0)
    if (quantity <= 0) continue
    totals.set(materialId, (totals.get(materialId) ?? 0) + quantity)
  }

  return totals
}

export type PurchaseInboundLineFormSeed = {
  purchaseOrderLineId: string
  materialId: string
  materialCode: string
  materialName: string
  specification: string
  mpn: string
  orderedQuantity: number
  receivedQuantity: number
  remainingQuantity: number
}

export function buildPurchaseInboundLineSeeds(order: MaterialPurchaseOrderListGroup): PurchaseInboundLineFormSeed[] {
  return order.items
    .map((item) => {
      const orderedQuantity = Number(item.quantity) || 0
      const receivedQuantity = Number(item.inboundQuantity) || 0
      const remainingQuantity = computePurchaseOrderRemainingQuantity(orderedQuantity, receivedQuantity)

      return {
        purchaseOrderLineId: item.lineId || '',
        materialId: item.materialId || '',
        materialCode: item.materialCode,
        materialName: item.materialName,
        specification: item.specification,
        mpn: item.mpn,
        orderedQuantity,
        receivedQuantity,
        remainingQuantity,
      }
    })
    .filter((item) => item.remainingQuantity > 0 && item.purchaseOrderLineId && item.materialId)
}

export function filterPurchaseOrdersWithRemaining(orders: MaterialPurchaseOrderListGroup[]) {
  return orders.filter((order) => buildPurchaseInboundLineSeeds(order).length > 0)
}

export function inboundPurchaseItemsFromDetail(
  order: MaterialPurchaseOrderListGroup,
  inbound: MaterialInboundListGroup,
): PurchaseInboundItemForm[] {
  const qtyByLineId = new Map(
    inbound.items
      .filter((item) => item.purchaseOrderLineId)
      .map((item) => [item.purchaseOrderLineId as string, item.quantity]),
  )

  return order.items
    .filter((item) => item.lineId && qtyByLineId.has(item.lineId))
    .map((item) => {
      const orderedQuantity = Number(item.quantity) || 0
      const receivedQuantity = Number(item.inboundQuantity) || 0
      const thisInboundQuantity = qtyByLineId.get(item.lineId) ?? 0
      const remainingQuantity = Math.max(0, orderedQuantity - receivedQuantity + thisInboundQuantity)

      return {
        purchaseOrderLineId: item.lineId,
        materialId: item.materialId || '',
        materialCode: item.materialCode,
        materialName: item.materialName,
        specification: item.specification,
        mpn: item.mpn,
        orderedQuantity,
        receivedQuantity,
        remainingQuantity,
        quantity: String(thisInboundQuantity),
      }
    })
}
