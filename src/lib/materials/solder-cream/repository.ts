import { createHash } from 'crypto'
import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { createSupabaseClient } from '@/lib/supabase'
import { parseSolderCreamLogText } from './parse-log-file'
import type {
  SolderCreamEditableLotStatus,
  SolderCreamEquipmentLog,
  SolderCreamLogImport,
  SolderCreamLogImportRow,
  SolderCreamLotStatusOverride,
} from './types'

export type FetchSolderCreamLogPageResult =
  | {
      ok: true
      logs: SolderCreamEquipmentLog[]
      statusOverrides: SolderCreamLotStatusOverride[]
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
  return rows.map((row, index) => ({
    import_id: importId,
    source_row: index + 1,
    recorded_at: row.recordedAt,
    equipment_type: row.equipmentType,
    equipment_id: row.equipmentId,
    lot_number: row.lotNumber,
    event_type: row.eventType,
    temperature: row.temperature,
    mix_seconds: row.mixSeconds,
    result: (row.result || '').slice(0, 200),
    note: (row.note || '').slice(0, 500),
  }))
}

async function insertLogRows(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
  importId: string,
  rows: SolderCreamLogImportRow[],
) {
  const payload = mapInsertRows(importId, rows)
  const chunkSize = 200
  for (let offset = 0; offset < payload.length; offset += chunkSize) {
    const chunk = payload.slice(offset, offset + chunkSize)
    const { error } = await supabase.from('solder_cream_equipment_logs').insert(chunk)
    if (error) return error
  }
  return null
}

async function fetchAllSolderCreamEquipmentLogs(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
) {
  const pageSize = 1000
  const logs: SolderCreamEquipmentLog[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('solder_cream_equipment_logs')
      .select(
        'id, import_id, source_row, recorded_at, equipment_type, equipment_id, lot_number, event_type, temperature, mix_seconds, result, note, created_at',
      )
      .order('recorded_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) return { ok: false as const, detail: error.message }
    const rows = data || []
    logs.push(...rows.map(mapLogRow))
    if (rows.length < pageSize) break
    from += pageSize
  }

  return { ok: true as const, logs }
}

function mapStatusOverride(row: {
  lot_number: string
  status: string
  note: string
  updated_at: string
}): SolderCreamLotStatusOverride | null {
  if (row.status !== 'cold' && row.status !== 'discarded' && row.status !== 'scrapped') {
    return null
  }
  return {
    lotNumber: row.lot_number || '',
    status: row.status,
    note: row.note || '',
    updatedAt: row.updated_at,
  }
}

async function fetchAllSolderCreamLotStatusOverrides(
  supabase: NonNullable<ReturnType<typeof createSupabaseClient>>,
) {
  const { data, error } = await supabase
    .from('solder_cream_lot_status')
    .select('lot_number, status, note, updated_at')
    .order('updated_at', { ascending: false })

  if (error) return { ok: false as const, detail: error.message }
  const overrides = (data || [])
    .map(mapStatusOverride)
    .filter((row): row is SolderCreamLotStatusOverride => Boolean(row?.lotNumber))
  return { ok: true as const, overrides }
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

  const [logsResult, overridesResult] = await Promise.all([
    fetchAllSolderCreamEquipmentLogs(supabase),
    fetchAllSolderCreamLotStatusOverrides(supabase),
  ])

  if (!logsResult.ok) {
    return { ok: false, reason: 'query', detail: logsResult.detail }
  }
  if (!overridesResult.ok) {
    const missingStatusTable =
      overridesResult.detail.includes('solder_cream_lot_status') ||
      overridesResult.detail.includes('schema cache')
    if (!missingStatusTable) {
      return { ok: false, reason: 'query', detail: overridesResult.detail }
    }
  }

  return {
    ok: true,
    logs: logsResult.logs,
    statusOverrides: overridesResult.ok ? overridesResult.overrides : [],
  }
}

export type FetchRecentSolderCreamLogImportsResult =
  | { ok: true; imports: SolderCreamLogImport[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export async function fetchRecentSolderCreamLogImports(
  limit = 10,
): Promise<FetchRecentSolderCreamLogImportsResult> {
  const supabase = createSupabaseClient()
  if (!supabase) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const take = Math.min(50, Math.max(1, Math.floor(Number(limit) || 10)))
  const { data, error } = await supabase
    .from('solder_cream_log_imports')
    .select('id, source_name, row_count, imported_at, note')
    .order('imported_at', { ascending: false })
    .limit(take)

  if (error) {
    return { ok: false, reason: 'query', detail: error.message }
  }

  return {
    ok: true,
    imports: (data || []).map((row) => ({
      id: String(row.id || ''),
      sourceName: String(row.source_name || '').trim() || '(이름 없음)',
      rowCount: Math.max(0, Math.floor(Number(row.row_count) || 0)),
      importedAt: String(row.imported_at || ''),
      note: String(row.note || ''),
    })),
  }
}

export type UpsertSolderCreamLotStatusResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'auth' | 'validation'; detail: string }

export async function upsertSolderCreamLotStatus(input: {
  lotNumber: string
  status: SolderCreamEditableLotStatus
  note?: string
}): Promise<UpsertSolderCreamLotStatusResult> {
  const auth = await assertCanWrite({ module: 'production_smt', action: 'update' })
  if (!auth.ok) {
    return { ok: false, reason: 'auth', detail: auth.detail }
  }

  const lotNumber = input.lotNumber.trim()
  if (!lotNumber) {
    return { ok: false, reason: 'validation', detail: 'LOT가 없습니다.' }
  }
  if (input.status !== 'cold' && input.status !== 'discarded' && input.status !== 'scrapped') {
    return { ok: false, reason: 'validation', detail: '상태를 확인해 주세요.' }
  }

  const supabase = createSupabaseClient()
  if (!supabase) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const { error } = await supabase.from('solder_cream_lot_status').upsert(
    {
      lot_number: lotNumber,
      status: input.status,
      note: (input.note || '').trim().slice(0, 500),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'lot_number' },
  )

  if (error) {
    return { ok: false, reason: 'query', detail: error.message }
  }

  return { ok: true }
}

export async function clearSolderCreamLotStatus(
  lotNumber: string,
): Promise<UpsertSolderCreamLotStatusResult> {
  const auth = await assertCanWrite({ module: 'production_smt', action: 'update' })
  if (!auth.ok) {
    return { ok: false, reason: 'auth', detail: auth.detail }
  }

  const lot = lotNumber.trim()
  if (!lot) {
    return { ok: false, reason: 'validation', detail: 'LOT가 없습니다.' }
  }

  const supabase = createSupabaseClient()
  if (!supabase) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const { error } = await supabase.from('solder_cream_lot_status').delete().eq('lot_number', lot)
  if (error) {
    return { ok: false, reason: 'query', detail: error.message }
  }

  return { ok: true }
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

export type DeleteSolderCreamLogResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'auth' | 'validation'; detail: string }

export async function deleteSolderCreamEquipmentLogs(
  logIds: string[],
): Promise<DeleteSolderCreamLogResult> {
  const auth = await assertCanWrite({ module: 'production_smt', action: 'delete' })
  if (!auth.ok) {
    return { ok: false, reason: 'auth', detail: auth.detail }
  }

  const ids = [...new Set(logIds.map((id) => id.trim()).filter(Boolean))]
  if (!ids.length) {
    return { ok: false, reason: 'validation', detail: '삭제할 이력을 선택해 주세요.' }
  }

  const supabase = createSupabaseClient()
  if (!supabase) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const { error } = await supabase.from('solder_cream_equipment_logs').delete().in('id', ids)
  if (error) {
    return { ok: false, reason: 'query', detail: error.message }
  }

  return { ok: true }
}

export type IngestSolderCreamLogResult =
  | { ok: true; skipped: true; rowCount: 0; detail: string }
  | { ok: true; skipped: false; importId: string; rowCount: number }
  | Extract<ImportSolderCreamLogResult, { ok: false }>

/** 수동 가져오기 공통 */
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

  const logsError = await insertLogRows(supabase, importRow.id, parsed.rows)

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
