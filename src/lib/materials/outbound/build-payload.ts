import type { OutboundLineForm } from './form-state'
import type { MaterialOutboundRowPayload, MaterialOutboundType } from './types'
import type { Material } from '@/lib/materials/types'
import { resolveMaterialByInventoryCode } from '@/lib/materials/utils'

export function buildMaterialOutboundPayload(input: {
  outboundDate: string
  outboundType: MaterialOutboundType
  orderId: string
  note: string
  lines: OutboundLineForm[]
  materials: Material[]
}): MaterialOutboundRowPayload {
  const items = input.lines
    .map((line) => {
      const code = line.materialId.trim()
      const resolved = code ? resolveMaterialByInventoryCode(input.materials, code) : null
      return {
        material_id: resolved?.id ?? line.materialId.trim(),
        quantity: Math.max(0, Number(line.quantity) || 0),
      }
    })
    .filter((item) => item.material_id && item.quantity > 0)

  return {
    outbound_date: input.outboundDate,
    outbound_type: input.outboundType,
    order_id: input.orderId.trim() || null,
    note: input.note.trim(),
    items,
  }
}
