export const MATERIAL_PROCESSES = ['', 'SMD', 'DIP'] as const
export type MaterialProcess = (typeof MATERIAL_PROCESSES)[number]

export const MATERIAL_SUPPLY_TYPES = ['', '도급', '사급'] as const
export type MaterialSupplyType = (typeof MATERIAL_SUPPLY_TYPES)[number]

export type MaterialRecord = {
  id: string
  customer: string
  material_name: string
  specification: string
  process: MaterialProcess
  cpn: string
  mpn: string
  mpn2: string
  spn: string
  spn2: string
  supplier: string
  supply_type: MaterialSupplyType
  moq: number
  unit_price: number
  created_at: string
  updated_at: string
}

export type Material = {
  id: string
  customer: string
  materialName: string
  specification: string
  process: MaterialProcess
  cpn: string
  mpn: string
  mpn2: string
  spn: string
  spn2: string
  supplier: string
  supplyType: MaterialSupplyType
  moq: number
  unitPrice: number
  createdAt: string
  updatedAt: string
}

export type MaterialPayload = {
  customer: string
  materialName: string
  specification: string
  process: MaterialProcess
  cpn: string
  mpn: string
  mpn2: string
  spn: string
  spn2: string
  supplier: string
  supplyType: MaterialSupplyType
  moq: number
  unitPrice: number
}

export const MATERIAL_COLUMN_LABELS = {
  customer: '고객사',
  materialName: '자재명',
  specification: '규격',
  process: '공정',
  cpn: 'CPN',
  mpn: 'MPN',
  mpn2: 'MPN2',
  spn: 'SPN',
  spn2: 'SPN2',
  supplier: '공급업체',
  supplyType: '도급/사급',
  moq: 'MOQ',
  unitPrice: '단가',
} as const
