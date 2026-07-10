export const MATERIAL_INBOUND_TYPES = ['opening', 'purchase', 'supplied', 'return'] as const
export type MaterialInboundType = (typeof MATERIAL_INBOUND_TYPES)[number]

export const MATERIAL_INBOUND_TYPE_LABELS: Record<MaterialInboundType, string> = {
  opening: '기초',
  purchase: '발주',
  supplied: '사급',
  return: '반품',
}

export type MaterialInboundLineItem = {
  lineId: string
  materialId: string
  purchaseOrderLineId: string | null
  materialCode: string
  materialName: string
  specification: string
  mpn: string
  quantity: number
}

export type MaterialInboundListGroup = {
  inboundId: string
  inboundNumber: string
  inboundDate: string
  inboundType: MaterialInboundType
  purchaseOrderId: string | null
  purchaseOrderNumber: string | null
  note: string
  items: MaterialInboundLineItem[]
  totalQuantity: number
  createdAt: string
}

export type MaterialInboundLineRecord = {
  id: string
  inbound_id: string
  line_seq: number
  material_id: string
  purchase_order_line_id: string | null
  quantity: number
  items?: {
    id: string
    name: string
    specification: string
    mpn: string
  } | null
}

export type MaterialInboundRecord = {
  id: string
  inbound_date: string
  inbound_type: string
  purchase_order_id: string | null
  note: string
  created_at: string
  updated_at: string
  material_inbound_lines: MaterialInboundLineRecord[]
}

export type MaterialInboundRowPayload = {
  inbound_date: string
  inbound_type: MaterialInboundType
  purchase_order_id: string | null
  note: string
  items: {
    material_id: string
    purchase_order_line_id: string | null
    quantity: number
  }[]
}

export type MaterialInboundQuantityAggregateRecord = {
  material_id: string
  quantity: number
}
