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

function mapMaterialAlternateMpnRecord(record: MaterialAlternateMpnRecord): MaterialAlternateMpn {
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
