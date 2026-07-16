import type { ItemCategory } from '@/lib/items/types'

export type BomLine = {
  parentProductId: string
  childProductId: string
  quantityPer: number
  note: string
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
}

export type BomParentFilter = 'all' | 3 | 4
