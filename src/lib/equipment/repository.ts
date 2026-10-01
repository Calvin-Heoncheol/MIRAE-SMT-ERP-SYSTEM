import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { createSupabaseClient } from '@/lib/supabase'
import {
  EQUIPMENT_TYPE_LABELS,
  isEquipmentType,
  SMT_LINE_NO_MAX,
  SMT_LINE_NO_MIN,
  type SmtEquipment,
  type SmtEquipmentPayload,
  type SmtLine,
  type SmtLinePayload,
} from './types'

export type FetchSmtLinesResult =
  | { ok: true; lines: SmtLine[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveEquipmentResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export type DeleteEquipmentResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

type SmtLineRow = {
  id: string
  line_no: number
  name: string | null
  is_active: boolean | null
  note: string | null
}

type SmtEquipmentRow = {
  id: string
  line_id: string
  equipment_type: string | null
  unit_no: number
  maker: string | null
  model: string | null
  serial_no: string | null
  rated_cph: number | null
  effective_cph: number | null
  installed_at: string | null
  is_active: boolean | null
  note: string | null
}

export function isMissingSmtEquipmentTable(detail: string) {
  return (
    detail.includes('smt_lines') || detail.includes('smt_equipment') || detail.includes('schema cache')
  )
}

function missingEnvResult<T extends { ok: false; reason: 'env'; detail: string }>(): T {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  } as T
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

function errorDetail(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function mapDuplicateError(detail: string) {
  if (detail.includes('smt_lines_line_no_unique')) return '이미 등록된 라인 번호입니다.'
  if (detail.includes('smt_equipment_line_type_unit_unique')) {
    return '같은 라인에 같은 설비 종류·호기가 이미 있습니다.'
  }
  return detail
}

function mapEquipmentRow(row: SmtEquipmentRow): SmtEquipment {
  return {
    id: row.id,
    lineId: row.line_id,
    equipmentType: isEquipmentType(row.equipment_type) ? row.equipment_type : 'other',
    unitNo: Number(row.unit_no) || 1,
    maker: row.maker ?? '',
    model: row.model ?? '',
    serialNo: row.serial_no ?? '',
    ratedCph: row.rated_cph ?? null,
    effectiveCph: row.effective_cph ?? null,
    installedAt: row.installed_at ?? '',
    isActive: row.is_active ?? true,
    note: row.note ?? '',
  }
}

function validateLinePayload(payload: SmtLinePayload) {
  const lineNo = Math.floor(Number(payload.lineNo))
  if (!Number.isFinite(lineNo) || lineNo < SMT_LINE_NO_MIN || lineNo > SMT_LINE_NO_MAX) {
    return `라인 번호는 ${SMT_LINE_NO_MIN}~${SMT_LINE_NO_MAX} 사이로 입력해 주세요.`
  }
  return null
}

function validateEquipmentPayload(payload: SmtEquipmentPayload) {
  if (!payload.lineId.trim()) return '라인을 선택해 주세요.'
  if (!isEquipmentType(payload.equipmentType)) return '설비 종류를 선택해 주세요.'
  const unitNo = Math.floor(Number(payload.unitNo))
  if (!Number.isFinite(unitNo) || unitNo < 1) return '호기는 1 이상으로 입력해 주세요.'
  for (const value of [payload.ratedCph, payload.effectiveCph]) {
    if (value != null && (!Number.isFinite(value) || value <= 0)) {
      return 'CPH 는 0보다 큰 숫자로 입력해 주세요.'
    }
  }
  return null
}

function toLineRow(payload: SmtLinePayload) {
  return {
    line_no: Math.floor(Number(payload.lineNo)),
    name: payload.name.trim(),
    is_active: payload.isActive,
    note: payload.note.trim(),
    updated_at: new Date().toISOString(),
  }
}

function toEquipmentRow(payload: SmtEquipmentPayload) {
  const isMounter = payload.equipmentType === 'mounter'
  return {
    line_id: payload.lineId,
    equipment_type: payload.equipmentType,
    unit_no: Math.floor(Number(payload.unitNo)),
    maker: payload.maker.trim(),
    model: payload.model.trim(),
    serial_no: payload.serialNo.trim(),
    rated_cph: isMounter && payload.ratedCph ? Math.floor(payload.ratedCph) : null,
    effective_cph: isMounter && payload.effectiveCph ? Math.floor(payload.effectiveCph) : null,
    installed_at: payload.installedAt.trim() || null,
    is_active: payload.isActive,
    note: payload.note.trim(),
    updated_at: new Date().toISOString(),
  }
}

export async function fetchSmtLinesWithEquipment(): Promise<FetchSmtLinesResult> {
  if (!hasSupabaseEnv()) return missingEnvResult()

  try {
    const supabase = createSupabaseClient()
    const [linesResult, equipmentResult] = await Promise.all([
      supabase.from('smt_lines').select('id, line_no, name, is_active, note').order('line_no'),
      supabase
        .from('smt_equipment')
        .select(
          'id, line_id, equipment_type, unit_no, maker, model, serial_no, rated_cph, effective_cph, installed_at, is_active, note',
        )
        .order('unit_no'),
    ])

    if (linesResult.error) return { ok: false, reason: 'query', detail: linesResult.error.message }
    if (equipmentResult.error) {
      return { ok: false, reason: 'query', detail: equipmentResult.error.message }
    }

    const equipmentByLine = new Map<string, SmtEquipment[]>()
    for (const row of (equipmentResult.data || []) as SmtEquipmentRow[]) {
      const list = equipmentByLine.get(row.line_id) ?? []
      list.push(mapEquipmentRow(row))
      equipmentByLine.set(row.line_id, list)
    }

    const lines = ((linesResult.data || []) as SmtLineRow[]).map((row) => ({
      id: row.id,
      lineNo: Number(row.line_no) || 1,
      name: row.name ?? '',
      isActive: row.is_active ?? true,
      note: row.note ?? '',
      equipment: equipmentByLine.get(row.id) ?? [],
    }))

    return { ok: true, lines }
  } catch (error) {
    return { ok: false, reason: 'query', detail: errorDetail(error) }
  }
}

/** 설비 한 행 — id 가 없으면 신규 */
export type SmtEquipmentDraftPayload = Omit<SmtEquipmentPayload, 'lineId'> & { id: string | null }

function findDuplicateUnit(equipment: SmtEquipmentDraftPayload[]) {
  const seen = new Set<string>()
  for (const item of equipment) {
    const key = `${item.equipmentType}:${Math.floor(Number(item.unitNo))}`
    if (seen.has(key)) return item
    seen.add(key)
  }
  return null
}

/** 라인 + 설비 목록 일괄 저장 (removedEquipmentIds 는 삭제) */
export async function saveSmtLineWithEquipment(
  lineId: string | null,
  payload: SmtLinePayload,
  equipment: SmtEquipmentDraftPayload[],
  removedEquipmentIds: string[],
): Promise<SaveEquipmentResult> {
  if (!hasSupabaseEnv()) return missingEnvResult()

  const gate = await assertCanWrite({ module: 'master', action: lineId ? 'update' : 'create' })
  if (!gate.ok) return gate
  if (removedEquipmentIds.length > 0) {
    const deleteGate = await assertCanWrite({ module: 'master', action: 'delete' })
    if (!deleteGate.ok) return deleteGate
  }

  const invalidLine = validateLinePayload(payload)
  if (invalidLine) return { ok: false, reason: 'validation', detail: invalidLine }
  for (const item of equipment) {
    const invalid = validateEquipmentPayload({ ...item, lineId: lineId ?? 'new' })
    if (invalid) return { ok: false, reason: 'validation', detail: invalid }
  }
  const duplicate = findDuplicateUnit(equipment)
  if (duplicate) {
    return {
      ok: false,
      reason: 'validation',
      detail: `${EQUIPMENT_TYPE_LABELS[duplicate.equipmentType]} ${duplicate.unitNo}호기가 중복됩니다.`,
    }
  }

  try {
    const supabase = createSupabaseClient()
    const lineQuery = lineId
      ? supabase.from('smt_lines').update(toLineRow(payload)).eq('id', lineId)
      : supabase.from('smt_lines').insert(toLineRow(payload))
    const { data, error } = await lineQuery.select('id').single()
    if (error) return { ok: false, reason: 'query', detail: mapDuplicateError(error.message) }
    const savedLineId = String(data.id)

    if (removedEquipmentIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('smt_equipment')
        .delete()
        .in('id', removedEquipmentIds)
      if (deleteError) return { ok: false, reason: 'query', detail: deleteError.message }
    }

    for (const item of equipment) {
      const row = toEquipmentRow({ ...item, lineId: savedLineId })
      const { error: equipmentError } = item.id
        ? await supabase.from('smt_equipment').update(row).eq('id', item.id)
        : await supabase.from('smt_equipment').insert(row)
      if (equipmentError) {
        return { ok: false, reason: 'query', detail: mapDuplicateError(equipmentError.message) }
      }
    }

    return { ok: true, id: savedLineId }
  } catch (error) {
    return { ok: false, reason: 'query', detail: errorDetail(error) }
  }
}

export async function deleteSmtLine(lineId: string): Promise<DeleteEquipmentResult> {
  if (!hasSupabaseEnv()) return missingEnvResult()

  const gate = await assertCanWrite({ module: 'master', action: 'delete' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('smt_lines').delete().eq('id', lineId)
    if (error) return { ok: false, reason: 'query', detail: error.message }
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: 'query', detail: errorDetail(error) }
  }
}