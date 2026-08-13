import type { Item, ItemCategory } from '@/lib/items/types'
import { ITEM_CATEGORY_LABELS, isProductItemCategory } from '@/lib/items/types'
import type { BomGroup, BomLine, BomListRow, BomParentFilter } from './types'

export function allowedChildCategories(parentCategory: ItemCategory): ItemCategory[] {
  if (parentCategory === 4) return [3]
  if (parentCategory === 3) return [1, 2]
  return []
}

export function describeBomRule(parentCategory: ItemCategory) {
  if (parentCategory === 4) return '조립제품 BOM → 자식은 반제품만 등록할 수 있습니다.'
  if (parentCategory === 3) return '반제품 BOM → 자식은 원자재·부자재만 등록할 수 있습니다.'
  return '부모 품목은 반제품 또는 조립제품만 선택할 수 있습니다.'
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

/** 품목등록된 반제품·조립제품 + BOM 유무 — item.id 기준이라 같은 품목코드라도 행이 분리됨 */
export function buildBomListRows(items: Item[], bomGroups: BomGroup[]): BomListRow[] {
  const bomByParent = new Map(bomGroups.map((group) => [group.parentProductId, group]))
  const seenIds = new Set<string>()
  const rows: BomListRow[] = []

  for (const item of parentItemsForBom(items)) {
    const id = String(item.id || '').trim()
    if (!id || seenIds.has(id)) continue
    seenIds.add(id)

    const existing = bomByParent.get(id)
    const baseCode = item.baseCode?.trim() || id
    const version = item.version?.trim() || ''
    if (existing) {
      rows.push({
        ...existing,
        parentProductId: id,
        parentProductName: item.name || existing.parentProductName,
        parentItemCategory: item.itemCategory,
        parentBaseCode: baseCode,
        parentVersion: version,
        bomRegistered: true,
      })
      continue
    }
    rows.push({
      parentProductId: id,
      parentProductName: item.name,
      parentItemCategory: item.itemCategory,
      parentBaseCode: baseCode,
      parentVersion: version,
      lines: [],
      bomRegistered: false,
    })
  }

  return rows
}

export function filterBomListRows(rows: BomListRow[], query: string, parentFilter: BomParentFilter) {
  const q = query.trim().toLowerCase()

  return rows.filter((row) => {
    if (parentFilter !== 'all' && row.parentItemCategory !== parentFilter) return false
    if (!q) return true

    const statusLabel = row.bomRegistered ? '등록완료' : '미등록'
    const haystack = [
      row.parentProductId,
      row.parentBaseCode,
      row.parentVersion,
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
  // 품목등록에 있는 반제품·조립제품은 BOM 목록에 모두 표시 (활성만 — 사용중지 제외)
  return items
    .filter((item) => isProductItemCategory(item.itemCategory) && item.isActive !== false)
    .sort((a, b) => {
      const categoryCompare = b.itemCategory - a.itemCategory
      if (categoryCompare !== 0) return categoryCompare
      const codeCompare = (a.baseCode || a.id).localeCompare(b.baseCode || b.id, 'ko')
      if (codeCompare !== 0) return codeCompare
      const versionCompare = (a.version || '').localeCompare(b.version || '', 'ko')
      if (versionCompare !== 0) return versionCompare
      const nameCompare = a.name.localeCompare(b.name, 'ko')
      if (nameCompare !== 0) return nameCompare
      return a.id.localeCompare(b.id, 'ko')
    })
}

export function childItemsForParent(items: Item[], parentCategory: ItemCategory) {
  // 반제품은 여러 조립제품 BOM에서 공용 가능 — 같은 코드라도 id가 다르면 각각 선택 가능
  const allowed = new Set(allowedChildCategories(parentCategory))
  return items
    .filter((item) => allowed.has(item.itemCategory) && item.isActive !== false)
    .sort((a, b) => {
      const codeCompare = (a.baseCode || a.id).localeCompare(b.baseCode || b.id, 'ko')
      if (codeCompare !== 0) return codeCompare
      const versionCompare = (a.version || '').localeCompare(b.version || '', 'ko')
      if (versionCompare !== 0) return versionCompare
      return a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id, 'ko')
    })
}

export function formatItemOptionLabel(
  item: Pick<Item, 'id' | 'baseCode' | 'version' | 'name' | 'itemCategory'>,
) {
  const code = item.baseCode?.trim() || item.id
  const version = item.version?.trim()
  const codeLabel = version ? `${code} · ${version}` : code
  return `${codeLabel} · ${item.name || '—'} (${ITEM_CATEGORY_LABELS[item.itemCategory]})`
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
