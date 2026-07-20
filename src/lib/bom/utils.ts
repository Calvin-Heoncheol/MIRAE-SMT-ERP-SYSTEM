import type { Item, ItemCategory } from '@/lib/items/types'
import { ITEM_CATEGORY_LABELS, isProductItemCategory } from '@/lib/items/types'
import type { BomGroup, BomLine, BomListRow, BomParentFilter } from './types'

export function allowedChildCategories(parentCategory: ItemCategory): ItemCategory[] {
  if (parentCategory === 4) return [3]
  if (parentCategory === 3) return [1, 2]
  return []
}

export function describeBomRule(parentCategory: ItemCategory) {
  if (parentCategory === 4) return '완제품 BOM → 자식은 반제품만 등록할 수 있습니다.'
  if (parentCategory === 3) return '반제품 BOM → 자식은 원자재·부자재만 등록할 수 있습니다.'
  return '부모 품목은 반제품 또는 완제품만 선택할 수 있습니다.'
}

export function isValidBomPair(parentCategory: ItemCategory, childCategory: ItemCategory) {
  return allowedChildCategories(parentCategory).includes(childCategory)
}

export function groupBomLines(lines: BomLine[]): BomGroup[] {
  const map = new Map<string, BomGroup>()

  for (const line of lines) {
    const existing = map.get(line.parentProductId)
    if (existing) {
      existing.lines.push(line)
      continue
    }
    map.set(line.parentProductId, {
      parentProductId: line.parentProductId,
      parentProductName: line.parentProductName,
      parentItemCategory: line.parentItemCategory,
      lines: [line],
    })
  }

  return [...map.values()].sort((a, b) => {
    const categoryCompare = b.parentItemCategory - a.parentItemCategory
    if (categoryCompare !== 0) return categoryCompare
    return a.parentProductId.localeCompare(b.parentProductId, 'ko')
  })
}

/** 품목등록된 반제품·완제품 + BOM 유무 */
export function buildBomListRows(items: Item[], bomGroups: BomGroup[]): BomListRow[] {
  const bomByParent = new Map(bomGroups.map((group) => [group.parentProductId, group]))

  return parentItemsForBom(items).map((item) => {
    const existing = bomByParent.get(item.id)
    if (existing) {
      return { ...existing, bomRegistered: true }
    }
    return {
      parentProductId: item.id,
      parentProductName: item.name,
      parentItemCategory: item.itemCategory,
      lines: [],
      bomRegistered: false,
    }
  })
}

export function filterBomListRows(rows: BomListRow[], query: string, parentFilter: BomParentFilter) {
  const q = query.trim().toLowerCase()

  return rows.filter((row) => {
    if (parentFilter !== 'all' && row.parentItemCategory !== parentFilter) return false
    if (!q) return true

    const statusLabel = row.bomRegistered ? '등록완료' : '미등록'
    const haystack = [
      row.parentProductId,
      row.parentProductName,
      ITEM_CATEGORY_LABELS[row.parentItemCategory],
      statusLabel,
      ...row.lines.flatMap((line) => [
        line.childProductId,
        line.childProductName,
        line.childMpn,
        ITEM_CATEGORY_LABELS[line.childItemCategory],
      ]),
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(q)
  })
}

export function filterBomGroups(groups: BomGroup[], query: string, parentFilter: BomParentFilter) {
  return filterBomListRows(
    groups.map((group) => ({ ...group, bomRegistered: group.lines.length > 0 })),
    query,
    parentFilter,
  )
}

export function parentItemsForBom(items: Item[]) {
  return items
    .filter((item) => isProductItemCategory(item.itemCategory))
    .sort((a, b) => {
      const categoryCompare = b.itemCategory - a.itemCategory
      if (categoryCompare !== 0) return categoryCompare
      return a.id.localeCompare(b.id, 'ko')
    })
}

export function childItemsForParent(items: Item[], parentCategory: ItemCategory) {
  const allowed = new Set(allowedChildCategories(parentCategory))
  return items
    .filter((item) => allowed.has(item.itemCategory))
    .sort((a, b) => a.id.localeCompare(b.id, 'ko'))
}

export function formatItemOptionLabel(item: Pick<Item, 'id' | 'name' | 'itemCategory'>) {
  return `${item.id} · ${item.name || '—'} (${ITEM_CATEGORY_LABELS[item.itemCategory]})`
}

/** 구성 품목 단가 × 소요량 합산 (원 단위 반올림) */
export function sumBomComponentUnitPrices(
  lines: Array<{ quantityPer: number; childUnitPrice: number }>,
) {
  const sum = lines.reduce((total, line) => {
    const quantityPer = Math.max(0, Number(line.quantityPer) || 0)
    const childUnitPrice = Math.max(0, Number(line.childUnitPrice) || 0)
    return total + quantityPer * childUnitPrice
  }, 0)
  return Math.round(sum)
}
