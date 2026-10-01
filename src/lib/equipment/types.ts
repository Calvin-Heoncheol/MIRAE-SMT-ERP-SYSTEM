export const EQUIPMENT_TYPES = ['mounter', 'printer', 'spi', 'reflow', 'aoi', 'other'] as const

export type EquipmentType = (typeof EQUIPMENT_TYPES)[number]

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  mounter: '마운터',
  printer: '인쇄기',
  spi: 'SPI',
  reflow: '리플로우',
  aoi: 'AOI',
  other: '기타',
}

/** 생산계획·생산등록이 쓰는 라인 번호 범위 */
export const SMT_LINE_NO_MIN = 1
export const SMT_LINE_NO_MAX = 7

export type SmtEquipment = {
  id: string
  lineId: string
  equipmentType: EquipmentType
  unitNo: number
  maker: string
  model: string
  serialNo: string
  ratedCph: number | null
  effectiveCph: number | null
  installedAt: string
  isActive: boolean
  note: string
}

export type SmtLine = {
  id: string
  lineNo: number
  name: string
  isActive: boolean
  note: string
  equipment: SmtEquipment[]
}

export type SmtLinePayload = {
  lineNo: number
  name: string
  isActive: boolean
  note: string
}

export type SmtEquipmentPayload = {
  lineId: string
  equipmentType: EquipmentType
  unitNo: number
  maker: string
  model: string
  serialNo: string
  ratedCph: number | null
  effectiveCph: number | null
  installedAt: string
  isActive: boolean
  note: string
}

export function isEquipmentType(value: unknown): value is EquipmentType {
  return EQUIPMENT_TYPES.includes(value as EquipmentType)
}

export function smtLineDisplayName(line: Pick<SmtLine, 'lineNo' | 'name'>) {
  return line.name.trim() || `LINE ${line.lineNo}`
}

export function equipmentDisplayName(equipment: Pick<SmtEquipment, 'equipmentType' | 'unitNo'>) {
  return `${EQUIPMENT_TYPE_LABELS[equipment.equipmentType]} ${equipment.unitNo}호기`
}

/** 실제 CPH / 사양 CPH (%) */
export function equipmentEfficiencyPercent(equipment: Pick<SmtEquipment, 'ratedCph' | 'effectiveCph'>) {
  if (!equipment.ratedCph || !equipment.effectiveCph) return null
  return Math.round((equipment.effectiveCph / equipment.ratedCph) * 100)
}

export type SmtLineCapacitySummary = {
  mounterCount: number
  ratedCphTotal: number
  effectiveCphTotal: number
  /** 실제 CPH 가 비어 있는 사용중 마운터 수 */
  missingEffectiveCount: number
}

/** 사용중 마운터 기준 라인 CPH 합계 */
export function summarizeSmtLineCapacity(line: Pick<SmtLine, 'equipment'>): SmtLineCapacitySummary {
  const mounters = line.equipment.filter(
    (equipment) => equipment.isActive && equipment.equipmentType === 'mounter',
  )
  return {
    mounterCount: mounters.length,
    ratedCphTotal: mounters.reduce((sum, equipment) => sum + (equipment.ratedCph ?? 0), 0),
    effectiveCphTotal: mounters.reduce((sum, equipment) => sum + (equipment.effectiveCph ?? 0), 0),
    missingEffectiveCount: mounters.filter((equipment) => !equipment.effectiveCph).length,
  }
}
