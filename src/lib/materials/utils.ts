import type {
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

export function mapMaterialRecord(record: MaterialRecord): Material {
  const alternateMpnRows = sortAlternateMpns((record.material_mpns || []).map(mapMaterialAlternateMpnRecord))
  const alternateMpns = alternateMpnRows.map((item) => item.mpn.trim()).filter(Boolean)

  return {
    id: record.id,
    customer: record.customer,
    materialName: record.material_name,
    specification: record.specification,
    type: normalizeMaterialType(record.type),
    cpn: record.cpn,
    mpn: record.mpn || '',
    alternateMpns,
    alternateMpnRows,
    supplier: record.supplier,
    supplyType: record.supply_type,
    moq: Number(record.moq) || 0,
    unitPrice: Number(record.unit_price) || 0,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

export function toMaterialRow(payload: MaterialPayload) {
  return {
    customer: payload.customer.trim(),
    material_name: payload.materialName.trim(),
    specification: payload.specification.trim(),
    type: normalizeMaterialType(payload.type),
    cpn: payload.cpn.trim(),
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

/**
 * 릴/부품 바코드(GS1·DigiKey Data Matrix)는 부품번호 앞에 식별자 접두어가 붙는다.
 * 예) MPN `CC0402JRNPO9BN101` → 스캔값 `1PCC0402JRNPO9BN101`
 * `1P`(제조사 부품번호), `30P`(대체 부품번호) 접두어를 제거한 값을 반환한다.
 * 일반 검색어 오인식을 막기 위해 `P` 단독 접두어는 처리하지 않는다.
 */
export function stripBarcodePartPrefix(value: string) {
  const trimmed = value.trim()
  const match = /^(1p|30p)(.+)$/i.exec(trimmed)
  return match ? match[2] : trimmed
}

/**
 * 스캔한 바코드가 등록된 부품번호(CPN/MPN)와 일치하는지 판정한다.
 * - 앞의 `1P`/`30P` 접두어는 무시한다.
 * - 스캔값 뒤에 패키지/릴 코드가 붙는 경우(예: MPN `UT2327G` → 스캔 `UT2327G-SC59.3R-TG`)도
 *   등록 부품번호가 스캔값의 앞부분이고 그 뒤가 구분자(`-`, `.`, 공백 등)로 이어지면 일치로 본다.
 */
export function barcodeMatchesPart(scanValue: string, partNumber: string) {
  const scan = stripBarcodePartPrefix(scanValue).trim().toLowerCase()
  // 저장된 부품번호에도 1P/30P 접두어가 포함될 수 있어 동일하게 제거
  const part = stripBarcodePartPrefix(partNumber).trim().toLowerCase()
  // 너무 짧은 부품번호는 접두 매칭 시 오인식 위험이 커서 제외
  if (!scan || part.length < 3) return false
  if (scan === part) return true
  if (scan.startsWith(part)) {
    const boundary = scan.charAt(part.length)
    return /[^a-z0-9]/.test(boundary)
  }
  return false
}
