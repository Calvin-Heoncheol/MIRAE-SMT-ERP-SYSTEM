import type {
  CreateMaterialPayload,
  Material,
  MaterialAlternateMpn,
  MaterialAlternateMpnRecord,
  MaterialPayload,
  MaterialRecord,
  MaterialSupplyType,
  MaterialType,
} from './types'

export function normalizeMaterialType(value: string): MaterialType {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const upper = trimmed.toUpperCase().replace(/\s+/g, '')
  if (upper === 'SMD' || upper.includes('SMD')) return 'SMD'
  if (upper === 'DIP' || upper.includes('DIP')) return 'DIP'
  return ''
}

export function normalizeMaterialSupplyType(value: string): MaterialSupplyType {
  const trimmed = value.trim()
  if (trimmed === '도급' || trimmed === '사급') return trimmed
  return ''
}

export function mapMaterialAlternateMpnRecord(record: MaterialAlternateMpnRecord): MaterialAlternateMpn {
  return {
    id: record.id,
    materialId: record.material_id,
    mpn: record.mpn || '',
    sortOrder: Math.max(0, Math.floor(Number(record.sort_order) || 0)),
    note: record.note || '',
    createdAt: record.created_at,
  }
}

function sortAlternateMpns(mpns: MaterialAlternateMpn[]) {
  return [...mpns].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export function formatAlternateMpnSummary(alternateMpns: string[]) {
  if (!alternateMpns.length) return ''
  if (alternateMpns.length === 1) return alternateMpns[0]
  return `${alternateMpns[0]} 외 ${alternateMpns.length - 1}건`
}

/** 한 칸에 `CC0402…   0402B104…` 처럼 여러 MPN이 공백·줄바꿈으로 붙어 있는 경우 분리 */
export function splitMpnTokens(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((token) => sanitizeBarcodeRawInput(token))
    .filter(Boolean)
}

/** 매칭·검색용 MPN 후보 (기본 mpn 칸 분리 + 대체 MPN) */
export function getMaterialMpnCandidates(material: Material) {
  const tokens = [
    ...splitMpnTokens(material.mpn),
    ...material.alternateMpns.flatMap((value) => splitMpnTokens(value)),
  ]
  return [...new Set(tokens)]
}

export function mapMaterialRecord(record: MaterialRecord): Material {
  const alternateMpnRows = sortAlternateMpns((record.material_mpns || []).map(mapMaterialAlternateMpnRecord))
  const alternateMpns = alternateMpnRows.map((item) => item.mpn.trim()).filter(Boolean)

  return {
    id: record.id,
    customer: record.customer,
    materialName: record.material_name,
    specification: record.specification,
    type: normalizeMaterialType(record.type),
    mpn: (record.mpn || '').trim(),
    alternateMpns,
    alternateMpnRows,
    supplier: record.supplier,
    supplyType: record.supply_type,
    moq: Number(record.moq) || 0,
    unitPrice: Number(record.unit_price) || 0,
    safetyStock: 0,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

export function mapItemRowToMaterial(row: {
  id: string
  name: string
  specification: string
  mpn: string
  material_type?: string | null
  supply_type?: string | null
  supplier?: string | null
  unit_price?: number | null
  safety_stock?: number | null
  item_category: number | string
  created_at: string
  updated_at: string
}): Material {
  const materialTypeRaw = String(row.material_type || '')
    .trim()
    .toUpperCase()
  const type = materialTypeRaw === 'SMD' || materialTypeRaw === 'DIP' ? materialTypeRaw : ''

  const supplyType = row.supply_type?.trim()
  const normalizedSupplyType =
    supplyType === '도급' || supplyType === '사급' ? supplyType : ''

  return {
    id: row.id,
    customer: '',
    materialName: row.name || '',
    specification: row.specification || '',
    type,
    mpn: (row.mpn || '').trim(),
    alternateMpns: [],
    alternateMpnRows: [],
    supplier: (row.supplier || '').trim(),
    supplyType: normalizedSupplyType,
    moq: 0,
    unitPrice: Number(row.unit_price) || 0,
    safetyStock: Math.max(0, Math.floor(Number(row.safety_stock) || 0)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toItemMaterialInsertRow(payload: CreateMaterialPayload) {
  return {
    id: payload.id.trim(),
    name: payload.materialName.trim(),
    specification: payload.specification.trim(),
    mpn: payload.mpn.trim(),
    material_type: payload.type,
    supply_type: payload.supplyType,
    supplier: payload.supplier.trim(),
    unit_price: payload.unitPrice,
    item_category: 1 as const,
  }
}

export function toItemMaterialUpdateRow(payload: MaterialPayload) {
  return {
    name: payload.materialName.trim(),
    specification: payload.specification.trim(),
    mpn: payload.mpn.trim(),
    material_type: payload.type,
    supply_type: payload.supplyType,
    supplier: payload.supplier.trim(),
    unit_price: payload.unitPrice,
  }
}

export function toMaterialInsertRow(payload: CreateMaterialPayload) {
  return {
    id: payload.id.trim(),
    ...toMaterialRow(payload),
  }
}

export function toMaterialRow(payload: MaterialPayload) {
  return {
    customer: payload.customer.trim(),
    material_name: payload.materialName.trim(),
    specification: payload.specification.trim(),
    type: normalizeMaterialType(payload.type),
    mpn: payload.mpn.trim(),
    supplier: payload.supplier.trim(),
    supply_type: normalizeMaterialSupplyType(payload.supplyType),
    moq: payload.moq,
    unit_price: payload.unitPrice,
  }
}

export function formatMaterialMoney(value: number) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value)
}

const GS1_FIELD_SEPARATOR = '\x1d'

/** 스캔값·DB 양쪽의 공백·제로폭 문자 제거 */
export function sanitizeBarcodeRawInput(value: string) {
  return value
    .replace(/\s+/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200d\ufeff]/g, '')
}

/** 릴 바코드에서 MPN 앞에 붙는 GS1·라벨 접두어 */
const BARCODE_MPN_WRAPPERS = ['1p', '30p', 'p'] as const

function peelBarcodeWrapperOnce(value: string) {
  const lower = value.toLowerCase()
  for (const wrapper of BARCODE_MPN_WRAPPERS) {
    if (lower.startsWith(wrapper) && value.length > wrapper.length + 2) {
      return value.slice(wrapper.length)
    }
  }
  return value
}

/**
 * 릴/부품 바코드(GS1·DigiKey Data Matrix)는 부품번호 앞에 식별자 접두어가 붙는다.
 * 예) `1PCC0402…`, `PGRM188…` (1 없이 P만), `30P` 대체 품번
 */
export function stripBarcodePartPrefix(value: string) {
  return peelBarcodeWrapperOnce(sanitizeBarcodeRawInput(value))
}

/**
 * 스캐너가 붙이는 심볼로지 접두어(]C1 등)·GS1 FNC1·1P/30P 필드를 정리한 부품번호를 반환한다.
 * 수동 입력(MPN 그대로)은 1P/30P만 제거하고, 단독 P는 바코드 매칭 단계에서만 처리한다.
 */
export function normalizeBarcodeScanInput(value: string) {
  let text = sanitizeBarcodeRawInput(value)
  if (!text) return ''

  text = text.replace(/^\][A-Za-z0-9]{2}/, '')

  const gs1PartMatch = new RegExp(
    `(?:^|${GS1_FIELD_SEPARATOR})(1p|30p)([^${GS1_FIELD_SEPARATOR}]+)`,
    'i',
  ).exec(text)
  if (gs1PartMatch) {
    return gs1PartMatch[2].trim()
  }

  const beforeSeparator = text.split(GS1_FIELD_SEPARATOR)[0] ?? text
  let peeled = beforeSeparator
  let changed = true
  while (changed) {
    const next = peelBarcodeWrapperOnce(peeled)
    changed = next !== peeled && /^(1p|30p)/i.test(peeled)
    peeled = next
  }
  return peeled
}

/** 스캔값에서 비교에 쓸 후보 문자열(원본·접두어 제거·심볼로지 제거) */
export function expandBarcodeScanVariants(value: string) {
  const variants = new Set<string>()
  let text = sanitizeBarcodeRawInput(value)
  if (!text) return []

  text = text.replace(/^\][A-Za-z0-9]{2}/, '')
  variants.add(text.toLowerCase())

  const gs1Regex = new RegExp(`(?:^|${GS1_FIELD_SEPARATOR})(1p|30p|p)([^${GS1_FIELD_SEPARATOR}]+)`, 'gi')
  for (const match of text.matchAll(gs1Regex)) {
    const segment = match[2]?.trim()
    if (segment) variants.add(segment.toLowerCase())
  }

  const firstSegment = text.split(GS1_FIELD_SEPARATOR)[0] ?? text
  variants.add(firstSegment.toLowerCase())

  let peeled = firstSegment
  for (let i = 0; i < 3; i += 1) {
    const next = peelBarcodeWrapperOnce(peeled)
    if (next === peeled) break
    peeled = next
    variants.add(peeled.toLowerCase())
  }

  return [...variants].filter((item) => item.length > 0)
}

function partEqualsOrHasReelSuffix(scan: string, part: string) {
  if (scan === part) return true
  if (!scan.startsWith(part) || part.length < 3) return false
  const boundary = scan.charAt(part.length)
  return /[^a-z0-9]/.test(boundary)
}

/** 스캔 문자열이 등록 부품번호(또는 접두어/릴 접미 포함)와 같은지 */
function scanEncodesPart(scanValue: string, partNumber: string) {
  const part = stripBarcodePartPrefix(partNumber).trim().toLowerCase()
  if (!part || part.length < 3) return false

  const scanVariants = expandBarcodeScanVariants(scanValue)
  for (const scan of scanVariants) {
    if (partEqualsOrHasReelSuffix(scan, part)) return true

    for (const wrapper of BARCODE_MPN_WRAPPERS) {
      const wrapped = `${wrapper}${part}`
      if (partEqualsOrHasReelSuffix(scan, wrapped)) return true
    }
  }

  return false
}

function barcodeMatchesSinglePart(scanValue: string, partNumber: string) {
  return scanEncodesPart(scanValue, partNumber)
}

/**
 * 스캔한 바코드가 등록된 부품번호와 일치하는지 판정한다.
 * partNumber 한 칸에 공백으로 여러 MPN이 있어도 각각 비교한다.
 */
export function barcodeMatchesPart(scanValue: string, partNumber: string) {
  const parts = splitMpnTokens(partNumber)
  if (!parts.length) return false
  return parts.some((part) => barcodeMatchesSinglePart(scanValue, part))
}

export function materialMatchesMpnValue(material: Material, mpn: string) {
  const target = normalizeBarcodeScanInput(mpn)
  if (!target) return false
  const mpns = getMaterialMpnCandidates(material)
  if (mpns.some((value) => sanitizeBarcodeRawInput(value).toLowerCase() === target.toLowerCase())) {
    return true
  }
  return mpns.some((value) => barcodeMatchesPart(mpn, value))
}

export function resolveMaterialById(materials: Material[], id: string) {
  const trimmed = id.trim()
  if (!trimmed) return null
  return materials.find((material) => material.id === trimmed) ?? null
}

function resolveMaterialByBarcodeScan(materials: Material[], code: string) {
  let best: Material | null = null
  let bestLength = -1

  for (const material of materials) {
    const candidates = [material.id, ...getMaterialMpnCandidates(material)]
    for (const candidate of candidates) {
      const trimmed = candidate.trim()
      if (trimmed.length > bestLength && barcodeMatchesPart(code, trimmed)) {
        bestLength = trimmed.length
        best = material
      }
    }
  }

  return best
}

/** 자재코드, MPN, 바코드 스캔값 인식 */
export function resolveMaterialByInventoryCode(
  materials: Material[],
  code: string,
  options: { supplier?: string | null } = {},
) {
  const raw = code.trim()
  if (!raw) return null
  const normalized = normalizeBarcodeScanInput(raw)

  const supplierTrim = String(options.supplier ?? '').trim()
  const scopedMaterials = supplierTrim
    ? materials.filter(
        (material) => !material.supplier.trim() || material.supplier.trim() === supplierTrim,
      )
    : materials

  const byId =
    resolveMaterialById(scopedMaterials, raw) ??
    (normalized !== raw ? resolveMaterialById(scopedMaterials, normalized) : null)
  if (byId) return byId

  const mpnMatches = scopedMaterials.filter((material) => materialMatchesMpnValue(material, raw))
  if (mpnMatches.length === 1) return mpnMatches[0]

  return resolveMaterialByBarcodeScan(scopedMaterials, raw)
}
