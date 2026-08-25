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

/** 1=원자재, 2=부자재, 3=반제품, 4=조립제품 */
export type ItemCategory = 1 | 2 | 3 | 4

export const ITEM_CATEGORIES: ItemCategory[] = [1, 2, 3, 4]

export const ITEM_CATEGORY_LABELS: Record<ItemCategory, string> = {
  1: '원자재',
  2: '부자재',
  3: '반제품',
  4: '조립제품',
}

/** 목록 배지용 pastel. 필터 칩은 ERP_FILTER_CHIP_IDLE_CLASS 사용 */
export const ITEM_CATEGORY_BADGE_CLASS: Record<ItemCategory, string> = {
  1: 'bg-sky-100 text-sky-800',
  2: 'bg-violet-100 text-violet-800',
  3: 'bg-amber-100 text-amber-800',
  4: 'bg-emerald-100 text-emerald-800',
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

/** 반제품 PCB 면 — single=단면, duo=더블(단면과 동일 생산), double=양면(TOP/BOT) */
export type ItemPcbSideMode = '' | 'single' | 'duo' | 'double'

export const ITEM_PCB_SIDE_MODES = ['single', 'duo', 'double'] as const

export type ItemPcbSideModeValue = (typeof ITEM_PCB_SIDE_MODES)[number]

export const ITEM_PCB_SIDE_MODE_LABELS: Record<ItemPcbSideModeValue, string> = {
  single: '단면',
  duo: '더블',
  double: '양면',
}

/** 양면만 TOP/BOT 분리 */
export function isSplitItemPcbSideMode(mode: string | null | undefined) {
  return mode === 'double'
}

/** 반제품 공정 — 품목에서 직접 선택 (smt=SMD, post=후공정, smt_post=SMD+후공정) */
export type ItemProcessType = '' | 'smt' | 'post' | 'smt_post'

export const ITEM_PROCESS_TYPES = ['smt', 'post', 'smt_post'] as const

export type ItemProcessTypeValue = (typeof ITEM_PROCESS_TYPES)[number]

export const ITEM_PROCESS_TYPE_LABELS: Record<ItemProcessType | '', string> = {
  '': '선택 안 함',
  smt: 'SMD',
  post: '후공정',
  smt_post: 'SMD+후공정',
}

/** SMD/DIP 단가 > 0 여부로 공정 판별 */
export function deriveItemProcessType(smdUnitPrice: number, dipUnitPrice: number): ItemProcessType {
  const hasSmd = smdUnitPrice > 0
  const hasDip = dipUnitPrice > 0
  if (hasSmd && hasDip) return 'smt_post'
  if (hasSmd) return 'smt'
  if (hasDip) return 'post'
  return ''
}

/** 원자재(1)·조립제품(4): 품목코드 필수 직접 입력. 반제품(3)은 비우면 품목명으로 자동 */
export function isManualItemCodeCategory(category: ItemCategory) {
  return category === 1 || category === 4
}

/** 반제품: 코드 직접 입력 가능, 비우면 저장 시 품목명으로 채움 */
export function isOptionalItemCodeCategory(category: ItemCategory) {
  return category === 3
}

/** 생성 시 품목코드 입력란 편집 가능 (원자재·반제품·조립제품) */
export function canEditItemCodeOnCreate(category: ItemCategory) {
  return category === 1 || category === 3 || category === 4
}

export const ITEM_CATEGORY_CODE_PREFIX: Record<ItemCategory, string | null> = {
  1: null,
  2: 'SUB-',
  3: 'SFG-',
  4: 'FG-',
}

export type Item = {
  /** 내부 PK. MR-00001 자동채번, 수정 불가 */
  id: string
  /** 표시용 품목코드 (버전 제외) */
  baseCode: string
  /** 버전 라벨 (A1, V2 등). 없으면 빈 문자열 */
  version: string
  name: string
  specification: string
  package: string
  mpn: string
  /** 같은 자재의 다른 메이커 품번. 다른 부품이 아님 */
  alternateMpns: string[]
  customerId: string
  customerName: string
  materialType: ItemMaterialType
  supplyType: ItemSupplyType
  supplier: string
  pcbSideMode: ItemPcbSideMode
  processType: ItemProcessType
  unitPrice: number
  smdUnitPrice: number
  dipUnitPrice: number
  materialUnitPrice: number
  otherUnitPrice: number
  itemCategory: ItemCategory
  safetyStock: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type ItemPayload = {
  id: string
  baseCode: string
  version: string
  name: string
  specification: string
  package: string
  mpn: string
  alternateMpns: string[]
  customerId: string
  materialType: ItemMaterialType
  supplyType: ItemSupplyType
  supplier: string
  pcbSideMode: ItemPcbSideMode
  processType: ItemProcessType
  unitPrice: number
  smdUnitPrice: number
  dipUnitPrice: number
  materialUnitPrice: number
  otherUnitPrice: number
  itemCategory: ItemCategory
  safetyStock: number
}

export type UpdateItemPayload = Omit<ItemPayload, 'id'>

export const ITEM_COLUMN_LABELS = {
  id: '품목ID',
  baseCode: '품목코드',
  customerName: '고객사명',
  version: '버전',
  name: '품목명',
  specification: '사양',
  package: '패키지',
  mpn: 'MPN',
  alternateMpns: '대체 MPN',
  materialType: '공정구분',
  supplyType: '도급/사급',
  supplier: '공급사',
  pcbSideMode: '면',
  processType: '공정구분',
  itemCategory: '품목구분',
  isActive: '사용여부',
} as const
