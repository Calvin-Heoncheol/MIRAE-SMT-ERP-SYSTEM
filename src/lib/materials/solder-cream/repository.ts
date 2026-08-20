import { createHash } from 'crypto'
import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { createSupabaseClient } from '@/lib/supabase'
import { parseSolderCreamLogText } from './parse-log-file'
import type {
  SolderCreamEquipmentLog,
  SolderCreamLogImport,
  SolderCreamLogImportRow,
} from './types'

export type FetchSolderCreamLogPageResult =
  | {
      ok: true
      imports: SolderCreamLogImport[]
      logs: SolderCreamEquipmentLog[]
    }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type ImportSolderCreamLogResult =
  | { ok: true; importId: string; rowCount: number }
  | {
      ok: false
      reason: 'env' | 'query' | 'validation' | 'auth' | 'duplicate'
      detail: string
    }

function hashText(text: string) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function mapImportRow(row: {
  id: string
  source_name: string
  row_count: number
  imported_at: string
  note: string
}): SolderCreamLogImport {
  return {
    id: row.id,
    sourceName: row.source_name || '',
    rowCount: row.row_count ?? 0,
    importedAt: row.imported_at,
    note: row.note || '',
  }
}

function mapLogRow(row: {
  id: string
  import_id: string
  source_row: number
  recorded_at: string
  equipment_type: string
  equipment_id: string
  lot_number: string
  event_type: string
  temperature: number | null
  mix_seconds: number | null
  result: string
  note: string
  created_at: string
}): SolderCreamEquipmentLog {
  return {
    id: row.id,
    importId: row.import_id,
    sourceRow: row.source_row ?? 0,
    recordedAt: row.recorded_at,
    equipmentType:
      row.equipment_type === 'fridge' || row.equipment_type === 'mixer'
        ? row.equipment_type
        : 'unknown',
    equipmentId: row.equipment_id || '',
    lotNumber: row.lot_number || '',
    eventType:
      row.event_type === 'store' ||
      row.event_type === 'open' ||
      row.event_type === 'mix_start' ||
      row.event_type === 'mix_complete' ||
      row.event_type === 'alarm' ||
      row.event_type === 'discard'
        ? row.event_type
        : 'unknown',
    temperature: row.temperature ?? null,
    mixSeconds: row.mix_seconds ?? null,
    result: row.result || '',
    note: row.note || '',
    createdAt: row.created_at,
  }
}

function mapInsertRows(importId: string, rows: SolderCreamLogImportRow[]) {
  return rows.map((row) => ({
    import_id: importId,
    source_row: row.sourceRow,
    recorded_at: row.recordedAt,
    equipment_type: row.equipmentType,
    equipment_id: row.equipmentId,
    lot_number: row.lotNumber,
    event_type: row.eventType,
    temperature: row.temperature,
    mix_seconds: row.mixSeconds,
    result: row.result,
    note: row.note,
  }))
}

export async function fetchSolderCreamLogPageData(): Promise<FetchSolderCreamLogPageResult> {
  const supabase = createSupabaseClient()
  if (!supabase) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const [importsResult, logsResult] = await Promise.all([
    supabase
      .from('solder_cream_log_imports')
      .select('id, source_name, row_count, imported_at, note')
      .order('imported_at', { ascending: false })
      .limit(20),
    supabase
      .from('solder_cream_equipment_logs')
      .select(
        'id, import_id, source_row, recorded_at, equipment_type, equipment_id, lot_number, event_type, temperature, mix_seconds, result, note, created_at',
      )
      .order('recorded_at', { ascending: false })
      .limit(500),
  ])

  if (importsResult.error) {
    return { ok: false, reason: 'query', detail: importsResult.error.message }
  }
  if (logsResult.error) {
    return { ok: false, reason: 'query', detail: logsResult.error.message }
  }

  return {
    ok: true,
    imports: (importsResult.data || []).map(mapImportRow),
    logs: (logsResult.data || []).map(mapLogRow),
  }
}

export async function importSolderCreamLogFile(input: {
  sourceName: string
  text: string
  note?: string
}): Promise<ImportSolderCreamLogResult> {
  const auth = await assertCanWrite({ module: 'production_smt', action: 'create' })
  if (!auth.ok) {
    return { ok: false, reason: 'auth', detail: auth.detail }
  }

  const result = await ingestSolderCreamLogFile({
    sourceName: input.sourceName,
    text: input.text,
    note: input.note,
    replaceSameSource: false,
  })

  if (!result.ok) return result
  if (result.skipped) {
    return {
      ok: false,
      reason: 'duplicate',
      detail: result.detail,
    }
  }

  return {
    ok: true,
    importId: result.importId,
    rowCount: result.rowCount,
  }
}

export type IngestSolderCreamLogResult =
  | { ok: true; skipped: true; rowCount: 0; detail: string }
  | { ok: true; skipped: false; importId: string; rowCount: number }
  | Extract<ImportSolderCreamLogResult, { ok: false }>

/** 설비 PC 에이전트·수동 가져오기 공통 */
export async function ingestSolderCreamLogFile(input: {
  sourceName: string
  text: string
  note?: string
  replaceSameSource?: boolean
}): Promise<IngestSolderCreamLogResult> {
  const supabase = createSupabaseClient()
  if (!supabase) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const parsed = parseSolderCreamLogText(input.text)
  if (!parsed.ok) {
    return { ok: false, reason: 'validation', detail: parsed.detail }
  }

  const sourceName = input.sourceName.trim() || 'paste.txt'
  const sourceHash = hashText(input.text.trim())

  const { data: sameHash, error: sameHashError } = await supabase
    .from('solder_cream_log_imports')
    .select('id, source_name')
    .eq('source_hash', sourceHash)
    .maybeSingle()

  if (sameHashError) {
    return { ok: false, reason: 'query', detail: sameHashError.message }
  }
  if (sameHash) {
    if (input.replaceSameSource) {
      return {
        ok: true,
        skipped: true,
        rowCount: 0,
        detail: '변경 없음(이미 동기화됨)',
      }
    }
    return {
      ok: false,
      reason: 'duplicate',
      detail: '같은 내용의 파일이 이미 가져와졌습니다.',
    }
  }

  if (input.replaceSameSource) {
    const { error: deleteError } = await supabase
      .from('solder_cream_log_imports')
      .delete()
      .eq('source_name', sourceName)

    if (deleteError) {
      return { ok: false, reason: 'query', detail: deleteError.message }
    }
  }

  const { data: importRow, error: importError } = await supabase
    .from('solder_cream_log_imports')
    .insert({
      source_name: sourceName,
      source_hash: sourceHash,
      row_count: parsed.rows.length,
      note: input.note?.trim() || '',
    })
    .select('id')
    .single()

  if (importError || !importRow) {
    return {
      ok: false,
      reason: 'query',
      detail: importError?.message || '임포트 배치를 만들지 못했습니다.',
    }
  }

  const { error: logsError } = await supabase
    .from('solder_cream_equipment_logs')
    .insert(mapInsertRows(importRow.id, parsed.rows))

  if (logsError) {
    await supabase.from('solder_cream_log_imports').delete().eq('id', importRow.id)
    return { ok: false, reason: 'query', detail: logsError.message }
  }

  return {
    ok: true,
    skipped: false,
    importId: importRow.id,
    rowCount: parsed.rows.length,
  }
}
