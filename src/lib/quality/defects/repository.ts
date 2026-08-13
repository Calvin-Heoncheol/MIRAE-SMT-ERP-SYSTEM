import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { resolveCreatedBySnapshot } from '@/lib/auth/created-by'
import { fetchProductionHistory } from '@/lib/production-history/repository'
import { createSupabaseClient } from '@/lib/supabase'
import type {
  DefectActionType,
  DefectHandlingListItem,
  DefectHandlingRecord,
  DefectHandlingStatus,
  DefectSourceModule,
  UpsertDefectHandlingInput,
} from './types'
import { DEFECT_ACTION_TYPES } from './types'
import { statusFromActionType } from './utils'

export type FetchDefectHandlingsResult =
  | { ok: true; rows: DefectHandlingListItem[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type UpsertDefectHandlingResult =
  | { ok: true; handling: DefectHandlingRecord }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

function missingEnvResult(): { ok: false; reason: 'env'; detail: string } {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

export function isMissingQualityDefectHandlingsTable(detail: string) {
  return (
    detail.includes('quality_defect_handlings') ||
    (detail.includes('schema cache') && detail.toLowerCase().includes('quality'))
  )
}

function schemaErrorDetail(message: string): string | null {
  if (isMissingQualityDefectHandlingsTable(message)) {
    return 'quality_defect_handlings 테이블이 없습니다. setup-quality-defect-handlings.sql 을 실행하세요.'
  }
  return null
}

function isDefectActionType(value: string): value is DefectActionType {
  return (DEFECT_ACTION_TYPES as string[]).includes(value)
}

function isHandlingStatus(value: string): value is DefectHandlingStatus {
  return value === 'pending' || value === 'hold' || value === 'completed'
}

function mapHandlingRow(row: {
  id: string
  source_module: string
  production_record_id: string
  status: string
  action_type: string | null
  action_note: string | null
  handled_by_name: string | null
  handled_at: string | null
  updated_at: string
}): DefectHandlingRecord | null {
  if (row.source_module !== 'smt' && row.source_module !== 'post_process') return null
  if (!isHandlingStatus(row.status)) return null
  const actionType =
    row.action_type && isDefectActionType(row.action_type) ? row.action_type : null
  return {
    id: row.id,
    sourceModule: row.source_module,
    productionRecordId: row.production_record_id,
    status: row.status,
    actionType,
    actionNote: String(row.action_note || ''),
    handledByName: String(row.handled_by_name || ''),
    handledAt: row.handled_at,
    updatedAt: row.updated_at,
  }
}

async function fetchHandlingsByRecordIds(
  ids: string[],
): Promise<
  | { ok: true; byKey: Map<string, DefectHandlingRecord> }
  | { ok: false; reason: 'env' | 'query'; detail: string }
> {
  if (!ids.length) return { ok: true, byKey: new Map() }

  const supabase = createSupabaseClient()
  if (!supabase) return missingEnvResult()

  const { data, error } = await supabase
    .from('quality_defect_handlings')
    .select(
      'id, source_module, production_record_id, status, action_type, action_note, handled_by_name, handled_at, updated_at',
    )
    .in('production_record_id', ids)

  if (error) {
    return {
      ok: false,
      reason: 'query',
      detail: schemaErrorDetail(error.message) ?? error.message,
    }
  }

  const byKey = new Map<string, DefectHandlingRecord>()
  for (const raw of data ?? []) {
    const mapped = mapHandlingRow(raw as Parameters<typeof mapHandlingRow>[0])
    if (!mapped) continue
    byKey.set(`${mapped.sourceModule}:${mapped.productionRecordId}`, mapped)
  }
  return { ok: true, byKey }
}

export async function fetchDefectHandlings(): Promise<FetchDefectHandlingsResult> {
  const history = await fetchProductionHistory()
  if (!history.ok) return history

  const defectRows = history.rows.filter((row) => row.defectQuantity > 0)
  const handlingResult = await fetchHandlingsByRecordIds(defectRows.map((row) => row.id))
  if (!handlingResult.ok) {
    // 테이블 미적용 환경에서도 목록은 미대처로 보이게
    if (isMissingQualityDefectHandlingsTable(handlingResult.detail)) {
      return {
        ok: true,
        rows: defectRows.map((row) => ({
          key: `${row.module}:${row.id}`,
          sourceModule: row.module,
          productionRecordId: row.id,
          recordDate: row.recordDate,
          createdAt: row.createdAt,
          team: row.team,
          orderNumber: row.orderNumber,
          customer: row.customer,
          productName: row.productName,
          productCode: row.productCode,
          defectQuantity: row.defectQuantity,
          note: row.note,
          createdByName: row.createdByName,
          lineNo: row.lineNo,
          pcbSide: row.pcbSide,
          status: 'pending' as const,
          actionType: null,
          actionNote: '',
          handledByName: '',
          handledAt: null,
          handlingId: null,
        })),
      }
    }
    return handlingResult
  }

  const rows: DefectHandlingListItem[] = defectRows.map((row) => {
    const key = `${row.module}:${row.id}`
    const handling = handlingResult.byKey.get(key)
    return {
      key,
      sourceModule: row.module,
      productionRecordId: row.id,
      recordDate: row.recordDate,
      createdAt: row.createdAt,
      team: row.team,
      orderNumber: row.orderNumber,
      customer: row.customer,
      productName: row.productName,
      productCode: row.productCode,
      defectQuantity: row.defectQuantity,
      note: row.note,
      createdByName: row.createdByName,
      lineNo: row.lineNo,
      pcbSide: row.pcbSide,
      status: handling?.status ?? 'pending',
      actionType: handling?.actionType ?? null,
      actionNote: handling?.actionNote ?? '',
      handledByName: handling?.handledByName ?? '',
      handledAt: handling?.handledAt ?? null,
      handlingId: handling?.id ?? null,
    }
  })

  rows.sort((a, b) => {
    const statusRank = (status: DefectHandlingStatus) =>
      status === 'pending' ? 0 : status === 'hold' ? 1 : 2
    const rankCompare = statusRank(a.status) - statusRank(b.status)
    if (rankCompare !== 0) return rankCompare
    return b.createdAt.localeCompare(a.createdAt)
  })

  return { ok: true, rows }
}

export async function upsertDefectHandling(
  input: UpsertDefectHandlingInput,
): Promise<UpsertDefectHandlingResult> {
  const auth = await assertCanWrite({ module: 'quality_defects', action: 'update' })
  if (!auth.ok) return auth

  const sourceModule = input.sourceModule
  if (sourceModule !== 'smt' && sourceModule !== 'post_process') {
    return { ok: false, reason: 'validation', detail: '불량 출처가 올바르지 않습니다.' }
  }
  const productionRecordId = String(input.productionRecordId || '').trim()
  if (!productionRecordId) {
    return { ok: false, reason: 'validation', detail: '생산실적 ID가 필요합니다.' }
  }
  if (!isDefectActionType(input.actionType)) {
    return { ok: false, reason: 'validation', detail: '대처 구분을 선택하세요.' }
  }

  const supabase = createSupabaseClient()
  if (!supabase) return missingEnvResult()

  const snap = await resolveCreatedBySnapshot()
  const now = new Date().toISOString()
  const status = statusFromActionType(input.actionType)
  const actionNote = String(input.actionNote || '').trim()

  const payload = {
    source_module: sourceModule as DefectSourceModule,
    production_record_id: productionRecordId,
    status,
    action_type: input.actionType,
    action_note: actionNote,
    handled_by: snap.createdBy || auth.profile.id,
    handled_by_name: snap.createdByName || auth.profile.displayName || '',
    handled_at: now,
    updated_at: now,
  }

  const { data, error } = await supabase
    .from('quality_defect_handlings')
    .upsert(payload, { onConflict: 'source_module,production_record_id' })
    .select(
      'id, source_module, production_record_id, status, action_type, action_note, handled_by_name, handled_at, updated_at',
    )
    .single()

  if (error) {
    return {
      ok: false,
      reason: 'query',
      detail: schemaErrorDetail(error.message) ?? error.message,
    }
  }

  const mapped = mapHandlingRow(data as Parameters<typeof mapHandlingRow>[0])
  if (!mapped) {
    return { ok: false, reason: 'query', detail: '대처 저장 결과를 해석하지 못했습니다.' }
  }
  return { ok: true, handling: mapped }
}
