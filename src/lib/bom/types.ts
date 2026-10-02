import type { ItemCategory } from '@/lib/items/types'

/** BOM 구성 공정 — SMD / DIP */
export type BomProcess = '' | 'smd' | 'dip'

export const BOM_PROCESS_LABELS: Record<BomProcess, string> = {
  '': '—',
  smd: 'SMD',
  dip: 'DIP',
}

export type BomLine = {
  parentProductId: string
  childProductId: string
  quantityPer: number
  note: string
  process: BomProcess
  designators: string
  sourceMpn: string
  sourcePartCode: string
  sourceName: string
  sourceSpec: string
  /** 대체 열 원문 */
  sourceAlternates: string
  /** 이 줄에서 주자재 대신 쓸 수 있는 품목 ID */
  alternateChildProductIds: string[]
  parentProductName: string
  parentItemCategory: ItemCategory
  childProductName: string
  childItemCategory: ItemCategory
  childMpn: string
}

export type BomGroup = {
  parentProductId: string
  parentProductName: string
  parentItemCategory: ItemCategory
  /** 표시용 품목코드 (버전 제외) */
  parentBaseCode?: string
  parentVersion?: string
  lines: BomLine[]
}

/** 목록 행 — BOM 미등록 품목도 포함 */
export type BomListRow = BomGroup & {
  bomRegistered: boolean
}

export type BomLinePayload = {
  childProductId: string
  quantityPer: number
  note: string
  process?: BomProcess
  designators?: string
  sourceMpn?: string
  sourcePartCode?: string
  sourceName?: string
  sourceSpec?: string
  sourceAlternates?: string
  alternateChildProductIds?: string[]
}

export type BomParentFilter = 'all' | 3 | 4

export function normalizeBomProcess(value: unknown): BomProcess {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
  if (!raw) return ''
  if (
    raw === 'smd' ||
    raw === 'smt' ||
    raw === 'sm' ||
    raw.includes('smd') ||
    raw.includes('smt')
  ) {
    return 'smd'
  }
  if (
    raw === 'dip' ||
    raw === 'tht' ||
    raw === 'th' ||
    raw.includes('dip') ||
    raw.includes('수삽') ||
    raw.includes('through')
  ) {
    return 'dip'
  }
  return ''
}
