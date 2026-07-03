import type { Material, MaterialPayload, MaterialProcess, MaterialRecord, MaterialSupplyType } from './types'

export function normalizeMaterialProcess(value: string): MaterialProcess {
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

export function mapMaterialRecord(record: MaterialRecord): Material {
  return {
    id: record.id,
    customer: record.customer,
    materialName: record.material_name,
    specification: record.specification,
    process: record.process,
    cpn: record.cpn,
    mpn: record.mpn,
    mpn2: record.mpn2,
    spn: record.spn,
    spn2: record.spn2,
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
    process: normalizeMaterialProcess(payload.process),
    cpn: payload.cpn.trim(),
    mpn: payload.mpn.trim(),
    mpn2: payload.mpn2.trim(),
    spn: payload.spn.trim(),
    spn2: payload.spn2.trim(),
    supplier: payload.supplier.trim(),
    supply_type: normalizeMaterialSupplyType(payload.supplyType),
    moq: payload.moq,
    unit_price: payload.unitPrice,
  }
}

export function formatMaterialMoney(value: number) {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value)
}
