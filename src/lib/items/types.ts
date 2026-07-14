export type ItemMaterialType = '' | 'SMD' | 'DIP'

export const ITEM_MATERIAL_TYPES: ItemMaterialType[] = ['', 'SMD', 'DIP']

/** 입력용 — 빈 값(선택 안 함) 제외 */
export const ITEM_MATERIAL_TYPE_OPTIONS: Exclude<ItemMaterialType, ''>[] = ['SMD', 'DIP']

export const ITEM_MATERIAL_TYPE_LABELS: Record<ItemMaterialType, string> = {
  '': '선택 안 함',
  SMD: 'SMD',
  DIP: 'DIP',
}

export type ItemSupplyType = '' | '도급' | '사급'

export const ITEM_SUPPLY_TYPES: ItemSupplyType[] = ['', '도급', '사급']

/** 입력용 — 빈 값(선택 안 함) 제외 */
export const ITEM_SUPPLY_TYPE_OPTIONS: Exclude<ItemSupplyType, ''>[] = ['도급', '사급']

export const ITEM_SUPPLY_TYPE_LABELS: Record<ItemSupplyType, string> = {
  '': '선택 안 함',
  도급: '도급',
  사급: '사급',
}

/** 1=원자재, 2=부자재, 3=반제품, 4=완제품 */
export type ItemCategory = 1 | 2 | 3 | 4

export const ITEM_CATEGORIES: ItemCategory[] = [1, 2, 3, 4]

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  1: '원자재',
  2: '부자재',
  3: '반제품',
  4: '완제품',
}

export function isMaterialItemCategory(category: ItemCategory) {
  return category === 1 || category === 2
}

export function isRawMaterialItemCategory(category: ItemCategory) {
  return category === 1
}

export function isSubMaterialItemCategory(category: ItemCategory) {
  return category === 2
}

export function isProductItemCategory(category: ItemCategory) {
  return category === 3 || category === 4
}

export function isSemiFinishedItemCategory(category: ItemCategory) {
  return category === 3
}

export function isFinishedItemCategory(category: ItemCategory) {
  return category === 4
}

/** 반제품 PCB 면 — single=단면, dual=양면 */
export type ItemPcbSideMode = '' | 'single' | 'dual'

export const ITEM_PCB_SIDE_MODES = ['single', 'dual'] as const

export type ItemPcbSideModeValue = (typeof ITEM_PCB_SIDE_MODES)[number]

export const ITEM_PCB_SIDE_MODE_LABELS: Record<ItemPcbSideModeValue, string> = {
  single: '단면',
  dual: '양면',
}

/** 반제품 공정 — smt=SMD, post=후공정, smt_post=SMD+후공정 */
export type ItemProcessType = '' | 'smt' | 'post' | 'smt_post'

export const ITEM_PROCESS_TYPES = ['smt', 'post', 'smt_post'] as const

export type ItemProcessTypeValue = (typeof ITEM_PROCESS_TYPES)[number]

export const ITEM_PROCESS_TYPE_LABELS: Record<ItemProcessTypeValue, string> = {
  smt: 'SMD',
  post: '후공정',
  smt_post: 'SMD+후공정',
}

/** 원자재(1)만 직접 입력, 나머지는 접두사+일련번호 자동 생성 */
export function isManualItemCodeCategory(category: ItemCategory) {
  return category === 1
}

export const ITEM_CATEGORY_CODE_PREFIX: Record<ItemCategory, string | null> = {
  1: null,
  2: 'SUB-',
  3: 'SFG-',
  4: 'FG-',
}

export type Item = {
  id: string
  name: string
  specification: string
  mpn: string
  materialType: ItemMaterialType
  supplyType: ItemSupplyType
  supplier: string
  pcbSideMode: ItemPcbSideMode
  processType: ItemProcessType
  unitPrice: number
  itemCategory: ItemCategory
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type ItemPayload = {
  id: string
  name: string
  specification: string
  mpn: string
  materialType: ItemMaterialType
  supplyType: ItemSupplyType
  supplier: string
  pcbSideMode: ItemPcbSideMode
  processType: ItemProcessType
  unitPrice: number
  itemCategory: ItemCategory
}

export type UpdateItemPayload = Omit<ItemPayload, 'id'>

export const ITEM_COLUMN_LABELS = {
  id: '품목코드',
  name: '품목명',
  specification: '규격',
  mpn: 'MPN',
  materialType: '구분',
  supplyType: '도급/사급',
  supplier: '공급사',
  pcbSideMode: '단면/양면',
  processType: '공정',
  unitPrice: '단가',
  itemCategory: '품목구분',
} as const
