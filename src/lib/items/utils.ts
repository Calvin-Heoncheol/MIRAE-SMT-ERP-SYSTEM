import type {
  Item,
  ItemCategory,
  ItemMaterialType,
  ItemPayload,
  ItemPcbSideMode,
  ItemProcessType,
  ItemSupplyType,
} from './types'
import { deriveItemProcessType, ITEM_CATEGORY_CODE_PREFIX } from './types'
import { normalizeVersionLabel, parseItemVersionCode } from './version-code'

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
  if (mode === 'single') return 'single'
  if (mode === 'duo') return 'duo'
  if (mode === 'double' || mode === 'dual') return 'double'
  return ''
}

function normalizeItemProcessType(value: string | null | undefined): ItemProcessType {
  const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '')
  if (raw === 'smt' || raw === 'smd') return 'smt'
  if (raw === 'post' || raw === 'dip' || raw === '후공정') return 'post'
  if (
    raw === 'smt_post' ||
    raw === 'smd_post' ||
    raw === 'smt+post' ||
    raw === 'smd+post' ||
    raw === 'smd+dip' ||
    raw === 'smt+dip' ||
    raw === 'smd+후공정' ||
    raw === 'smt+후공정'
  ) {
    return 'smt_post'
  }
  return ''
}

function resolveBaseCodeAndVersion(row: {
  id: string
  base_code?: string | null
  version?: string | null
}) {
  const fromColumnBase = String(row.base_code || '').trim()
  const fromColumnVersion = normalizeVersionLabel(row.version || '')
  if (fromColumnBase) {
    return { baseCode: fromColumnBase, version: fromColumnVersion }
  }
  const parsed = parseItemVersionCode(row.id || '')
  return {
    baseCode: parsed.base || row.id || '',
    version: normalizeVersionLabel(parsed.version || ''),
  }
}

export function mapItemRecord(row: {
  id: string
  base_code?: string | null
  version?: string | null
  name: string
  specification: string
  mpn: string
  material_type?: string | null
  supply_type?: string | null
  supplier?: string | null
  pcb_side_mode?: string | null
  process_type?: string | null
  unit_price?: number | null
  smd_unit_price?: number | null
  dip_unit_price?: number | null
  material_unit_price?: number | null
  safety_stock?: number | null
  item_category: number | string
  is_active: boolean
  created_at: string
  updated_at: string
}): Item {
  const itemCategory = normalizeItemCategory(row.item_category) ?? 1
  const unitPrice = Number(row.unit_price) || 0
  const smdUnitPrice = Number(row.smd_unit_price) || 0
  const dipUnitPrice = Number(row.dip_unit_price) || 0
  const materialUnitPrice = Number(row.material_unit_price) || 0
  const safetyStock = Math.max(0, Math.floor(Number(row.safety_stock) || 0))
  const isSemi = itemCategory === 3
  const hasBreakdown = smdUnitPrice > 0 || dipUnitPrice > 0 || materialUnitPrice > 0
  const resolvedSmd =
    isSemi && !hasBreakdown && unitPrice > 0
      ? row.process_type === 'post'
        ? 0
        : unitPrice
      : smdUnitPrice
  const resolvedDip =
    isSemi && !hasBreakdown && unitPrice > 0
      ? row.process_type === 'post'
        ? unitPrice
        : 0
      : dipUnitPrice
  const resolvedMaterial = isSemi ? materialUnitPrice : 0
  const { baseCode, version } = resolveBaseCodeAndVersion(row)

  return {
    id: row.id || '',
    baseCode,
    version: itemCategory === 1 ? '' : version,
    name: row.name || '',
    specification: row.specification || '',
    mpn: row.mpn || '',
    materialType: normalizeItemMaterialType(row.material_type),
    supplyType: normalizeItemSupplyType(row.supply_type),
    supplier: (row.supplier || '').trim(),
    pcbSideMode: normalizeItemPcbSideMode(row.pcb_side_mode),
    processType: isSemi
      ? deriveItemProcessType(resolvedSmd, resolvedDip)
      : normalizeItemProcessType(row.process_type),
    unitPrice: isSemi ? resolvedSmd + resolvedDip + resolvedMaterial : unitPrice,
    smdUnitPrice: isSemi ? resolvedSmd : 0,
    dipUnitPrice: isSemi ? resolvedDip : 0,
    materialUnitPrice: isSemi ? resolvedMaterial : 0,
    itemCategory,
    safetyStock,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toItemInsertRow(payload: ItemPayload) {
  const baseCode =
    payload.baseCode.trim() || parseItemVersionCode(payload.id).base || payload.id.trim()
  const version = normalizeVersionLabel(payload.version)
  return {
    id: payload.id.trim(),
    base_code: baseCode,
    version,
    name: payload.name.trim(),
    specification: payload.specification.trim(),
    mpn: payload.mpn.trim(),
    material_type: payload.materialType,
    supply_type: payload.supplyType,
    supplier: payload.supplier.trim(),
    pcb_side_mode: payload.pcbSideMode,
    process_type: payload.processType,
    unit_price: payload.unitPrice,
    smd_unit_price: payload.smdUnitPrice,
    dip_unit_price: payload.dipUnitPrice,
    material_unit_price: payload.materialUnitPrice,
    item_category: payload.itemCategory,
    safety_stock: Math.max(0, Math.floor(Number(payload.safetyStock) || 0)),
  }
}

export function toItemUpdateRow(payload: Omit<ItemPayload, 'id'>) {
  return {
    base_code: payload.baseCode.trim(),
    version: normalizeVersionLabel(payload.version),
    name: payload.name.trim(),
    specification: payload.specification.trim(),
    mpn: payload.mpn.trim(),
    material_type: payload.materialType,
    supply_type: payload.supplyType,
    supplier: payload.supplier.trim(),
    pcb_side_mode: payload.pcbSideMode,
    process_type: payload.processType,
    unit_price: payload.unitPrice,
    smd_unit_price: payload.smdUnitPrice,
    dip_unit_price: payload.dipUnitPrice,
    material_unit_price: payload.materialUnitPrice,
    item_category: payload.itemCategory,
    safety_stock: Math.max(0, Math.floor(Number(payload.safetyStock) || 0)),
  }
}

export function normalizeItemSearchText(value: string) {
  return value.trim().toLowerCase()
}

export function formatItemUnitPrice(value: number) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Math.round(value))
}

export function itemSearchHaystack(item: Item) {
  return [
    item.id,
    item.baseCode,
    item.version,
    item.name,
    item.specification,
    item.mpn,
    item.materialType,
    item.supplyType,
    item.supplier,
    item.pcbSideMode,
    item.processType,
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

export function findMaxItemCodeSequence(items: Pick<Item, 'id' | 'baseCode'>[], prefix: string) {
  let max = 0
  for (const item of items) {
    const seq =
      parseItemCodeSequence(prefix, item.baseCode) ?? parseItemCodeSequence(prefix, item.id)
    if (seq !== null && seq > max) max = seq
  }
  return max
}

export function nextItemCodeForCategory(
  items: Pick<Item, 'id' | 'baseCode'>[],
  category: ItemCategory,
) {
  const prefix = ITEM_CATEGORY_CODE_PREFIX[category]
  if (!prefix) return null
  return formatItemCode(prefix, findMaxItemCodeSequence(items, prefix) + 1)
}

export function nextItemCodeFromIds(ids: string[], category: ItemCategory) {
  return nextItemCodeForCategory(
    ids.map((id) => ({ id, baseCode: parseItemVersionCode(id).base || id })),
    category,
  )
}

/** 목록·주문서에 보여줄 품목코드 (버전 제외) */
export function formatItemDisplayCode(item: Pick<Item, 'id' | 'baseCode'>) {
  return item.baseCode.trim() || parseItemVersionCode(item.id).base || item.id
}
