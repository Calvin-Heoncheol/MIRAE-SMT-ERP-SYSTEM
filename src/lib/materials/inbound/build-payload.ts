import type { DirectInboundItemForm, PurchaseInboundItemForm } from './form-state'
import type { MaterialInboundRowPayload, MaterialInboundType } from './types'

export function buildDirectInboundPayloadItems(items: DirectInboundItemForm[]) {
  return items
    .map((item) => ({
      material_id: item.materialId.trim(),
      purchase_order_line_id: null as string | null,
      quantity: Math.max(0, Number(item.quantity) || 0),
    }))
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
}): MaterialInboundRowPayload {
  const items =
    input.inboundType === 'purchase'
      ? buildPurchaseInboundPayloadItems(input.purchaseItems)
      : buildDirectInboundPayloadItems(input.directItems)

  return {
    inbound_date: input.inboundDate,
    inbound_type: input.inboundType,
    purchase_order_id: input.inboundType === 'purchase' ? input.purchaseOrderId.trim() || null : null,
    note: input.note.trim(),
    items,
  }
}
