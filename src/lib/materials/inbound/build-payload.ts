import type { DirectInboundItemForm, PurchaseInboundItemForm } from './form-state'
import type { MaterialInboundRowPayload, MaterialInboundType } from './types'
import type { Material } from '@/lib/materials/types'
import { resolveMaterialByInventoryCode } from '@/lib/materials/utils'

export function buildDirectInboundPayloadItems(items: DirectInboundItemForm[], materials: Material[]) {
  return items
    .map((item) => {
      const code = item.materialId.trim()
      const resolved = code ? resolveMaterialByInventoryCode(materials, code) : null
      return {
        material_id: resolved?.id ?? item.materialId.trim(),
        purchase_order_line_id: null as string | null,
        quantity: Math.max(0, Number(item.quantity) || 0),
      }
    })
    .filter((item) => item.material_id && item.quantity > 0)
}

export function buildPurchaseInboundPayloadItems(items: PurchaseInboundItemForm[]) {
  return items
    .map((item) => ({
      material_id: item.materialId.trim(),
      purchase_order_line_id: item.purchaseOrderLineId,
      quantity: Math.max(0, Number(item.quantity) || 0),
    }))
    .filter((item) => item.material_id && item.purchase_order_line_id && item.quantity > 0)
}

export function buildMaterialInboundPayload(input: {
  inboundDate: string
  inboundType: MaterialInboundType
  purchaseOrderId: string
  note: string
  directItems: DirectInboundItemForm[]
  purchaseItems: PurchaseInboundItemForm[]
  materials: Material[]
}): MaterialInboundRowPayload {
  const items =
    input.inboundType === 'purchase'
      ? buildPurchaseInboundPayloadItems(input.purchaseItems)
      : buildDirectInboundPayloadItems(input.directItems, input.materials)

  return {
    inbound_date: input.inboundDate,
    inbound_type: input.inboundType,
    purchase_order_id: input.inboundType === 'purchase' ? input.purchaseOrderId.trim() || null : null,
    note: input.note.trim(),
    items,
  }
}
