import type { DirectInboundItemForm, PurchaseInboundItemForm } from './form-state'
import type { MaterialInboundRowPayload, MaterialInboundType } from './types'
import type { Material } from '@/lib/materials/types'
import { resolveMaterialByInventoryCode } from '@/lib/materials/utils'
import { assignReelLotNumber } from './reel-lot'

function fillMissingLots<T extends { lot_number?: string }>(items: T[], inboundDate: string) {
  const used: string[] = items.map((item) => String(item.lot_number || '').trim()).filter(Boolean)
  return items.map((item) => {
    const current = String(item.lot_number || '').trim()
    if (current) return { ...item, lot_number: current }
    const lot_number = assignReelLotNumber(inboundDate, used)
    used.push(lot_number)
    return { ...item, lot_number }
  })
}

export function buildDirectInboundPayloadItems(items: DirectInboundItemForm[], materials: Material[]) {
  return items
    .map((item) => {
      const code = item.materialId.trim()
      const resolved = code ? resolveMaterialByInventoryCode(materials, code) : null
      return {
        material_id: resolved?.id ?? item.materialId.trim(),
        purchase_order_line_id: null as string | null,
        quantity: Math.max(0, Number(item.quantity) || 0),
        lot_number: item.lotNumber.trim(),
        scan_fingerprint: item.scanFingerprint.trim(),
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
      lot_number: item.lotNumber.trim(),
      scan_fingerprint: item.scanFingerprint.trim(),
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
      ? fillMissingLots(buildPurchaseInboundPayloadItems(input.purchaseItems), input.inboundDate)
      : fillMissingLots(buildDirectInboundPayloadItems(input.directItems, input.materials), input.inboundDate)

  return {
    inbound_date: input.inboundDate,
    inbound_type: input.inboundType,
    purchase_order_id: input.inboundType === 'purchase' ? input.purchaseOrderId.trim() || null : null,
    note: input.note.trim(),
    items,
  }
}
