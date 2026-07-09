export const MATERIAL_TYPES = ['', 'SMD', 'DIP'] as const
export type MaterialType = (typeof MATERIAL_TYPES)[number]

export const MATERIAL_SUPPLY_TYPES = ['', '도급', '사급'] as const
export type MaterialSupplyType = (typeof MATERIAL_SUPPLY_TYPES)[number]

export type MaterialAlternateMpnRecord = {
  id: string
  material_id: string
  mpn: string
  sort_order: number
  note: string
  created_at: string
}

export type MaterialAlternateMpn = {
  id: string
  materialId: string
  mpn: string
  sortOrder: number
  note: string
  createdAt: string
}

export type MaterialRecord = {
  id: string
  customer: string
  material_name: string
  specification: string
  type: MaterialType
  mpn: string
  supplier: string
  supply_type: MaterialSupplyType
  moq: number
  unit_price: number
  created_at: string
  updated_at: string
  material_mpns?: MaterialAlternateMpnRecord[]
}

export type Material = {
  id: string
  customer: string
  materialName: string
  specification: string
  type: MaterialType
  mpn: string
  alternateMpns: string[]
  alternateMpnRows: MaterialAlternateMpn[]
  supplier: string
  supplyType: MaterialSupplyType
  moq: number
  unitPrice: number
  createdAt: string
  updatedAt: string
}

export type CreateMaterialPayload = MaterialPayload & {
  id: string
}

export type MaterialPayload = {
  customer: string
  materialName: string
  specification: string
  type: MaterialType
  mpn: string
  supplier: string
  supplyType: MaterialSupplyType
  moq: number
  unitPrice: number
}

export const MATERIAL_COLUMN_LABELS = {
  id: '자재코드',
  customer: '고객사',
  materialName: '자재명',
  specification: '규격',
  type: '구분',
  mpn: 'MPN',
  alternateMpns: '대체 MPN',
  supplier: '공급업체',
  supplyType: '도급/사급',
  moq: 'MOQ',
  unitPrice: '단가',
} as const
