import type { Item, ItemCategory, ItemMaterialType, ItemPayload, ItemPcbSideMode, ItemSupplyType } from './types'
import { ITEM_CATEGORY_CODE_PREFIX } from './types'

const LEGACY_CATEGORY_MAP: Record<string, ItemCategory> = {
  raw_material: 1,
  sub_material: 2,
  semi_finished: 3,
  finished_product: 4,
}

export function normalizeItemCategory(value: unknown): ItemCategory | null {
  const num = Number(value)
  if (num === 1 || num === 2 || num === 3 || num === 4) {
    return num as ItemCategory
  }
  if (typeof value === 'string') {
    const legacy = LEGACY_CATEGORY_MAP[value.trim().toLowerCase()]
    if (legacy) return legacy
  }
  return null
}

function normalizeItemMaterialType(value: string | null | undefined): ItemMaterialType {
  const upper = String(value || '')
    .trim()
    .toUpperCase()
  if (upper === 'SMD' || upper === 'DIP') return upper
  return ''
}

function normalizeItemSupplyType(value: string | null | undefined): ItemSupplyType {
  const trimmed = String(value || '').trim()
  if (trimmed === '도급' || trimmed === '사급') return trimmed
  return ''
}

function normalizeItemPcbSideMode(value: string | null | undefined): ItemPcbSideMode {
  const mode = String(value || '').trim().toLowerCase()
  if (mode === 'dual') return 'dual'
  if (mode === 'single') return 'single'
  return ''
}

export function mapItemRecord(row: {
  id: string
  name: string
  specification: string
  mpn: string
  material_type?: string | null
  supply_type?: string | null
  supplier?: string | null
  pcb_side_mode?: string | null
  unit_price?: number | null
  item_category: number | string
  is_active: boolean
  created_at: string
  updated_at: string
}): Item {
  const itemCategory = normalizeItemCategory(row.item_category) ?? 1

  return {
    id: row.id || '',
    name: row.name || '',
    specification: row.specification || '',
    mpn: row.mpn || '',
    materialType: normalizeItemMaterialType(row.material_type),
    supplyType: normalizeItemSupplyType(row.supply_type),
    supplier: (row.supplier || '').trim(),
    pcbSideMode: normalizeItemPcbSideMode(row.pcb_side_mode),
    unitPrice: Number(row.unit_price) || 0,
    itemCategory,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toItemInsertRow(payload: ItemPayload) {
  return {
    id: payload.id.trim(),
    name: payload.name.trim(),
    specification: payload.specification.trim(),
    mpn: payload.mpn.trim(),
    material_type: payload.materialType,
    supply_type: payload.supplyType,
    supplier: payload.supplier.trim(),
    pcb_side_mode: payload.pcbSideMode,
    unit_price: payload.unitPrice,
    item_category: payload.itemCategory,
  }
}

export function toItemUpdateRow(payload: Omit<ItemPayload, 'id'>) {
  return {
    name: payload.name.trim(),
    specification: payload.specification.trim(),
    mpn: payload.mpn.trim(),
    material_type: payload.materialType,
    supply_type: payload.supplyType,
    supplier: payload.supplier.trim(),
    pcb_side_mode: payload.pcbSideMode,
    unit_price: payload.unitPrice,
    item_category: payload.itemCategory,
  }
}

export function normalizeItemSearchText(value: string) {
  return value.trim().toLowerCase()
}

export function formatItemUnitPrice(value: number) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value)
}

export function itemSearchHaystack(item: Item) {
  return [
    item.id,
    item.name,
    item.specification,
    item.mpn,
    item.materialType,
    item.supplyType,
    item.supplier,
    item.pcbSideMode,
  ]
    .join(' ')
    .toLowerCase()
}

export function filterItemsForSearch(items: Item[], query: string) {
  const q = normalizeItemSearchText(query)
  if (!q) return items
  return items.filter((item) => itemSearchHaystack(item).includes(q))
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseItemCodeSequence(prefix: string, id: string): number | null {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`, 'i')
  const match = id.trim().match(pattern)
  if (!match) return null
  const num = Number(match[1])
  return Number.isFinite(num) && num > 0 ? num : null
}

export function formatItemCode(prefix: string, sequence: number, padLength = 3) {
  return `${prefix}${String(sequence).padStart(padLength, '0')}`
}

export function findMaxItemCodeSequence(items: Pick<Item, 'id'>[], prefix: string) {
  let max = 0
  for (const item of items) {
    const seq = parseItemCodeSequence(prefix, item.id)
    if (seq !== null && seq > max) max = seq
  }
  return max
}

export function nextItemCodeForCategory(items: Pick<Item, 'id'>[], category: ItemCategory) {
  const prefix = ITEM_CATEGORY_CODE_PREFIX[category]
  if (!prefix) return null
  return formatItemCode(prefix, findMaxItemCodeSequence(items, prefix) + 1)
}

export function nextItemCodeFromIds(ids: string[], category: ItemCategory) {
  return nextItemCodeForCategory(ids.map((id) => ({ id })), category)
}
