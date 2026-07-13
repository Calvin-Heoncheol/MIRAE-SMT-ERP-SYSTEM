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

export type BomLinePayload = {
  childProductId: string
  quantityPer: number
  note: string
}

export type BomParentFilter = 'all' | 3 | 4
