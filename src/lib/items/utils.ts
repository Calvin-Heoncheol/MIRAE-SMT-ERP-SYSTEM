import type {
  Item,
  ItemCategory,
  ItemMaterialType,
  ItemPayload,
  ItemPcbSideMode,
  ItemProcessType,
  ItemSupplyType,
} from './types'
import {
  deriveItemProcessType,
  ITEM_CATEGORY_CODE_PAD,
  ITEM_CATEGORY_CODE_PREFIX,
  ITEM_PCB_SIDE_MODE_LABELS,
  ITEM_PROCESS_TYPE_LABELS,
  type ItemPcbSideModeValue,
} from './types'
import { normalizeVersionLabel, parseItemVersionCode } from './version-code'
import { EMPTY_SMT_QUOTE_PARTS, normalizeItemSmtQuoteParts, itemSmtQuotePartsToJson } from './smt-quote-parts'

export const ITEM_INTERNAL_ID_PREFIX = 'MR-'
export const ITEM_INTERNAL_ID_PAD = 5
const ITEM_INTERNAL_ID_RE = /^MR-\d{5,}$/i

export function isCanonicalItemInternalId(id: string) {
  return ITEM_INTERNAL_ID_RE.test(id.trim())
}

export function splitItemMpnTokens(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

export function normalizeAlternateMpns(values: unknown, primaryMpn = '') {
  const primary = primaryMpn.trim().toLowerCase()
  const seen = new Set<string>()
  const result: string[] = []
  const list = Array.isArray(values) ? values : []
  for (const raw of list) {
    const token = String(raw || '').trim()
    if (!token) continue
    const key = token.toLowerCase()
    if (key === primary || seen.has(key)) continue
    seen.add(key)
    result.push(token)
  }
  return result
}

/** 기본 MPN + 대체 MPN. 컬럼이 없거나 비어 있으면 mpn 칸의 공백 구분 값을 사용 */
export function parseItemMpnFields(mpn: string, alternateMpns?: unknown) {
  const raw = String(mpn || '').trim()
  const tokens = splitItemMpnTokens(raw)
  const fromColumn = Array.isArray(alternateMpns)
    ? normalizeAlternateMpns(alternateMpns, tokens[0] || raw)
    : null

  if (fromColumn && fromColumn.length > 0) {
    return {
      mpn: tokens[0] || raw,
      alternateMpns: fromColumn,
    }
  }

  if (tokens.length > 1) {
    return {
      mpn: tokens[0],
      alternateMpns: normalizeAlternateMpns(tokens.slice(1), tokens[0]),
    }
  }

  return {
    mpn: raw,
    alternateMpns: fromColumn || [],
  }
}

export function isMissingAlternateMpnsColumn(detail: string) {
  return detail.includes('alternate_mpns')
}

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
  package?: string | null
  mpn: string
  alternate_mpns?: string[] | null
  customer_id?: string | null
  customer_reg_no?: string | null
  customer_name?: string | null
  material_type?: string | null
  supply_type?: string | null
  supplier?: string | null
  pcb_side_mode?: string | null
  process_type?: string | null
  unit_price?: number | null
  setup_unit_price?: number | null
  smd_unit_price?: number | null
  dip_unit_price?: number | null
  material_unit_price?: number | null
  other_unit_price?: number | null
  smt_quote_parts?: unknown
  baseline_quote_id?: string | null
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
  const otherUnitPrice = Number(row.other_unit_price) || 0
  const setupRaw = row.setup_unit_price
  const setupUnitPrice =
    setupRaw === null || setupRaw === undefined
      ? otherUnitPrice
      : Math.max(0, Math.round(Number(setupRaw) || 0))
  const safetyStock = Math.max(0, Math.floor(Number(row.safety_stock) || 0))
  const isProduct = itemCategory === 3 || itemCategory === 4
  const resolvedSetup = isProduct ? setupUnitPrice : 0
  const resolvedSmd = isProduct ? smdUnitPrice : 0
  const resolvedDip = isProduct ? dipUnitPrice : 0
  const resolvedMaterial = isProduct ? materialUnitPrice : 0
  const resolvedOther = isProduct ? otherUnitPrice : 0
  const perUnitBreakdown = resolvedSmd + resolvedDip
  const { baseCode, version } = resolveBaseCodeAndVersion(row)
  const mpns = parseItemMpnFields(row.mpn || '', row.alternate_mpns)

  return {
    id: row.id || '',
    baseCode,
    version: itemCategory === 1 ? '' : version,
    name: row.name || '',
    specification: row.specification || '',
    package: (row.package || '').trim(),
    mpn: mpns.mpn,
    alternateMpns: mpns.alternateMpns,
    customerId: (row.customer_id || '').trim(),
    customerName: (row.customer_name || '').trim(),
    materialType: normalizeItemMaterialType(row.material_type),
    supplyType: normalizeItemSupplyType(row.supply_type),
    supplier: (row.supplier || '').trim(),
    pcbSideMode: normalizeItemPcbSideMode(row.pcb_side_mode),
    processType:
      normalizeItemProcessType(row.process_type) ||
      (isProduct ? deriveItemProcessType(resolvedSmd, resolvedDip) : ''),
    unitPrice: isProduct
      ? perUnitBreakdown > 0
        ? perUnitBreakdown
        : unitPrice
      : unitPrice,
    setupUnitPrice: resolvedSetup,
    smdUnitPrice: resolvedSmd,
    dipUnitPrice: resolvedDip,
    materialUnitPrice: resolvedMaterial,
    otherUnitPrice: resolvedOther,
    smtQuoteParts: isProduct
      ? normalizeItemSmtQuoteParts(row.smt_quote_parts)
      : { ...EMPTY_SMT_QUOTE_PARTS },
    baselineQuoteId: isProduct ? String(row.baseline_quote_id || '').trim() : '',
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
  const id = payload.id.trim()
  const row = {
    base_code: baseCode,
    version,
    name: payload.name.trim(),
    specification: payload.specification.trim(),
    package: payload.package.trim(),
    mpn: [payload.mpn.trim(), ...normalizeAlternateMpns(payload.alternateMpns, payload.mpn)].filter(Boolean).join('\n'),
    customer_id: payload.customerId.trim() || null,
    material_type: payload.materialType,
    supply_type: payload.supplyType,
    supplier: payload.supplier.trim(),
    pcb_side_mode: payload.pcbSideMode,
    process_type: payload.processType,
    unit_price: payload.unitPrice,
    setup_unit_price: payload.setupUnitPrice,
    smd_unit_price: payload.smdUnitPrice,
    dip_unit_price: payload.dipUnitPrice,
    material_unit_price: payload.materialUnitPrice,
    other_unit_price: payload.setupUnitPrice,
    smt_quote_parts: itemSmtQuotePartsToJson(payload.smtQuoteParts),
    baseline_quote_id: payload.baselineQuoteId.trim() || null,
    item_category: payload.itemCategory,
    safety_stock: Math.max(0, Math.floor(Number(payload.safetyStock) || 0)),
  }
  if (isCanonicalItemInternalId(id)) {
    return { id, ...row }
  }
  return row
}

export function toItemUpdateRow(payload: Omit<ItemPayload, 'id'>) {
  return {
    base_code: payload.baseCode.trim(),
    version: normalizeVersionLabel(payload.version),
    name: payload.name.trim(),
    specification: payload.specification.trim(),
    package: payload.package.trim(),
    mpn: [payload.mpn.trim(), ...normalizeAlternateMpns(payload.alternateMpns, payload.mpn)].filter(Boolean).join('\n'),
    customer_id: payload.customerId.trim() || null,
    material_type: payload.materialType,
    supply_type: payload.supplyType,
    supplier: payload.supplier.trim(),
    pcb_side_mode: payload.pcbSideMode,
    process_type: payload.processType,
    unit_price: payload.unitPrice,
    setup_unit_price: payload.setupUnitPrice,
    smd_unit_price: payload.smdUnitPrice,
    dip_unit_price: payload.dipUnitPrice,
    material_unit_price: payload.materialUnitPrice,
    other_unit_price: payload.setupUnitPrice,
    smt_quote_parts: itemSmtQuotePartsToJson(payload.smtQuoteParts),
    baseline_quote_id: payload.baselineQuoteId.trim() || null,
    item_category: payload.itemCategory,
  }
}

export function normalizeItemSearchText(value: string) {
  return value.trim().toLowerCase()
}

export function formatItemUnitPrice(value: number) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(Math.round(value))
}

/** 기본 단가 = SMD+후공정 (대당). SET-UP·자재는 제외 */
export function displayItemUnitPrice(
  item: Pick<
    Item,
    'unitPrice' | 'setupUnitPrice' | 'smdUnitPrice' | 'dipUnitPrice' | 'materialUnitPrice' | 'otherUnitPrice'
  >,
) {
  const perUnit =
    Math.round(Number(item.smdUnitPrice) || 0) + Math.round(Number(item.dipUnitPrice) || 0)
  if (perUnit > 0) return perUnit
  return Math.round(Number(item.unitPrice) || 0)
}

/** 반제품 기본단가 — 세부 단가 합계가 있으면 합계, 없으면 unit_price(레거시) */
export function displayItemBaselineUnitPrice(
  item: Pick<
    Item,
    'setupUnitPrice' | 'smdUnitPrice' | 'dipUnitPrice' | 'materialUnitPrice' | 'unitPrice'
  > & { otherUnitPrice?: number },
) {
  const breakdownTotal =
    Math.round(Number(item.setupUnitPrice) || 0) +
    Math.round(Number(item.smdUnitPrice) || 0) +
    Math.round(Number(item.dipUnitPrice) || 0) +
    Math.round(Number(item.materialUnitPrice) || 0)
  if (breakdownTotal > 0) return breakdownTotal

  const unitPrice = Math.round(Number(item.unitPrice) || 0)
  if (unitPrice > 0) return unitPrice

  return Math.round(Number(item.otherUnitPrice) || 0)
}

/** 저장 직후 UI에 바로 반영할 때 — 서버 round-trip 없이 payload로 Item 구성 */
export function itemFromPayload(
  payload: ItemPayload,
  options?: {
    createdAt?: string
    updatedAt?: string
    isActive?: boolean
    customerName?: string
  },
): Item {
  const now = new Date().toISOString()
  return {
    id: payload.id,
    baseCode: payload.baseCode,
    version: payload.version,
    name: payload.name,
    specification: payload.specification,
    package: payload.package,
    mpn: payload.mpn,
    alternateMpns: payload.alternateMpns || [],
    customerId: payload.customerId,
    customerName: (options?.customerName || '').trim(),
    materialType: payload.materialType,
    supplyType: payload.supplyType,
    supplier: payload.supplier,
    pcbSideMode: payload.pcbSideMode,
    processType: payload.processType,
    unitPrice: payload.unitPrice,
    setupUnitPrice: payload.setupUnitPrice,
    smdUnitPrice: payload.smdUnitPrice,
    dipUnitPrice: payload.dipUnitPrice,
    materialUnitPrice: payload.materialUnitPrice,
    otherUnitPrice: payload.setupUnitPrice,
    smtQuoteParts: normalizeItemSmtQuoteParts(payload.smtQuoteParts),
    baselineQuoteId: String(payload.baselineQuoteId || '').trim(),
    itemCategory: payload.itemCategory,
    safetyStock: payload.safetyStock,
    isActive: options?.isActive !== false,
    createdAt: options?.createdAt || now,
    updatedAt: options?.updatedAt || now,
  }
}

export function itemSearchHaystack(item: Item) {
  return [
    item.id,
    item.baseCode,
    item.customerName,
    item.customerId,
    item.version,
    item.name,
    item.specification,
    item.package,
    item.mpn,
    ...(item.alternateMpns || []),
    item.processType,
    item.pcbSideMode,
    item.pcbSideMode ? ITEM_PCB_SIDE_MODE_LABELS[item.pcbSideMode as ItemPcbSideModeValue] : '',
    item.materialType,
    item.supplyType,
    item.isActive !== false ? '사용중' : '사용중지',
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

export function formatItemCode(
  prefix: string,
  sequence: number,
  padLength = ITEM_CATEGORY_CODE_PAD,
) {
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

/** 목록·발주서에 보여줄 품목코드 (버전 제외) */
export function formatItemDisplayCode(item: Pick<Item, 'id' | 'baseCode'>) {
  return item.baseCode.trim() || parseItemVersionCode(item.id).base || item.id
}

export function formatItemPcbSideModeLabel(mode: Item['pcbSideMode'] | string | null | undefined) {
  const value = String(mode || '').trim().toLowerCase()
  if (value === 'single' || value === 'duo' || value === 'double') {
    return ITEM_PCB_SIDE_MODE_LABELS[value]
  }
  return ''
}

/** 반제품·조립제품 생산 공정 표시 (SMD / 후공정 / SMD+후공정) */
export function formatItemProductionProcessLabel(
  item: Pick<Item, 'itemCategory' | 'processType' | 'smdUnitPrice' | 'dipUnitPrice'>,
) {
  if (item.itemCategory !== 3 && item.itemCategory !== 4) return ''
  const process =
    item.processType || deriveItemProcessType(item.smdUnitPrice, item.dipUnitPrice)
  const label = ITEM_PROCESS_TYPE_LABELS[process]
  return label && label !== '선택 안 함' ? label : ''
}
