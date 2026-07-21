export const MATERIAL_OUTBOUND_TYPES = ['production', 'scrap', 'adjustment'] as const
export type MaterialOutboundType = (typeof MATERIAL_OUTBOUND_TYPES)[number]

export const MATERIAL_OUTBOUND_TYPE_LABELS: Record<MaterialOutboundType, string> = {
  production: '생산',
  scrap: '폐기',
  adjustment: '조정',
}

export type MaterialOutboundLineItem = {
  lineId: string
  materialId: string
  materialCode: string
  materialName: string
  specification: string
  mpn: string
  quantity: number
}

export type MaterialOutboundListGroup = {
  outboundId: string
  outboundNumber: string
  outboundDate: string
  outboundType: MaterialOutboundType
  orderId: string | null
  orderNumber: string | null
  customer: string
  note: string
  items: MaterialOutboundLineItem[]
  totalQuantity: number
  createdAt: string
}

export type MaterialOutboundLineRecord = {
  id: string
  outbound_id: string
  line_seq: number
  material_id: string
  quantity: number
  items?: {
    id: string
    name: string
    specification: string
    mpn: string
  } | null
}

export type MaterialOutboundRecord = {
  id: string
  outbound_date: string
  outbound_type: string
  order_id: string | null
  note: string
  created_at: string
  updated_at: string
  material_outbound_lines: MaterialOutboundLineRecord[]
}

export type MaterialOutboundRowPayload = {
  outbound_date: string
  outbound_type: MaterialOutboundType
  order_id: string | null
  note: string
  items: {
    material_id: string
    quantity: number
  }[]
}

/**
 * 불출 자재 구분: SMD(→생산1팀) / DIP(→생산2·3·4팀) / ETC(구분 미지정).
 * 자재 마스터(items.material_type) 기준
 */
export const OUTBOUND_MATERIAL_BUCKETS = ['SMD', 'DIP', 'ETC'] as const
export type OutboundMaterialBucket = (typeof OUTBOUND_MATERIAL_BUCKETS)[number]

export const OUTBOUND_MATERIAL_BUCKET_LABELS: Record<OutboundMaterialBucket, string> = {
  SMD: 'SMD 불출',
  DIP: 'DIP 불출',
  ETC: '기타 불출',
}

/** 주문·BOM 기준 미불출 행 */
export type MaterialOutboundNeedRow = {
  orderId: string
  orderNumber: string
  customer: string
  deliveryDate: string
  productId: string
  productName: string
  productQuantity: number
  materialId: string
  materialCode: string
  materialName: string
  materialBucket: OutboundMaterialBucket
  requiredQuantity: number
  issuedQuantity: number
  remainingQuantity: number
}

/** 미불출 주문·품목·자재구분 카드 */
export type MaterialOutboundNeedCard = {
  key: string
  orderId: string
  orderNumber: string
  customer: string
  deliveryDate: string
  productId: string
  productName: string
  productQuantity: number
  materialBucket: OutboundMaterialBucket
  remainingProductQuantity: number
  issuableQuantity: number
  lines: MaterialOutboundNeedRow[]
}


export type BomEdge = {
  parentProductId: string
  childProductId: string
  quantityPer: number
  childItemCategory: number
}
