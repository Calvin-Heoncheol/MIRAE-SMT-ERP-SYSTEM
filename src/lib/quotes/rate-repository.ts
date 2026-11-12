import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { resolveCreatedBySnapshot } from '@/lib/auth/created-by'
import { createSupabaseClient } from '@/lib/supabase'
import { DEFAULT_QUOTE_RATES, normalizeQuoteRates, type QuoteRates } from './constants'

export type QuoteRateVersion = {
  id: string
  rates: QuoteRates
  note: string
  createdAt: string
  createdByName: string
}

export type CurrentQuoteRates = {
  rates: QuoteRates
  /** null = 등록된 버전 없음(코드 기본값) */
  versionId: string | null
  /** quote_rate_versions 테이블 미생성 */
  tableMissing: boolean
}

export type FetchQuoteRateHistoryResult =
  | { ok: true; versions: QuoteRateVersion[]; tableMissing: boolean }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveQuoteRatesResult =
  | { ok: true; version: QuoteRateVersion }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

type QuoteRateVersionRow = {
  id: string
  rates: unknown
  note: string | null
  created_at: string
  created_by_name: string | null
}

const SELECT_COLUMNS = 'id, rates, note, created_at, created_by_name'

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function isMissingQuoteRateTable(message: string) {
  return (
    message.includes('quote_rate_versions') &&
    (message.includes('does not exist') || message.includes('schema cache') || message.includes('Could not find'))
  )
}

function mapVersion(row: QuoteRateVersionRow): QuoteRateVersion {
  return {
    id: row.id,
    rates: normalizeQuoteRates(row.rates),
    note: row.note || '',
    createdAt: row.created_at,
    createdByName: row.created_by_name || '',
  }
}

/** 신규 견적에 적용할 현재 단가표. 실패·미등록이면 코드 기본값 */
export async function fetchCurrentQuoteRates(): Promise<CurrentQuoteRates> {
  const fallback: CurrentQuoteRates = { rates: DEFAULT_QUOTE_RATES, versionId: null, tableMissing: false }
  if (!hasSupabaseEnv()) return fallback

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('quote_rate_versions')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return { ...fallback, tableMissing: isMissingQuoteRateTable(error.message) }
    }
    if (!data) return fallback

    const version = mapVersion(data as QuoteRateVersionRow)
    return { rates: version.rates, versionId: version.id, tableMissing: false }
  } catch {
    return fallback
  }
}

export async function fetchQuoteRateHistory(limit = 30): Promise<FetchQuoteRateHistoryResult> {
  if (!hasSupabaseEnv()) {
    return { ok: false, reason: 'env', detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('quote_rate_versions')
      .select(SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      if (isMissingQuoteRateTable(error.message)) return { ok: true, versions: [], tableMissing: true }
      return { ok: false, reason: 'query', detail: error.message }
    }

    return {
      ok: true,
      versions: ((data || []) as QuoteRateVersionRow[]).map(mapVersion),
      tableMissing: false,
    }
  } catch (error) {
    return { ok: false, reason: 'query', detail: error instanceof Error ? error.message : String(error) }
  }
}

/** 새 단가표 버전 등록 (관리자만). 기존 버전은 수정하지 않음 */
export async function saveQuoteRates(rates: QuoteRates, note: string): Promise<SaveQuoteRatesResult> {
  if (!hasSupabaseEnv()) {
    return { ok: false, reason: 'env', detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.' }
  }

  const gate = await assertCanWrite({ module: 'sales', action: 'update' })
  if (!gate.ok) return gate
  if (gate.profile.role !== 'admin') {
    return { ok: false, reason: 'auth', detail: '관리자만 견적 단가를 변경할 수 있습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const actor = await resolveCreatedBySnapshot()
    const isUuid = /^[0-9a-f-]{36}$/i.test(actor.createdBy || '')
    const { data, error } = await supabase
      .from('quote_rate_versions')
      .insert({
        rates: normalizeQuoteRates(rates),
        note: note.trim(),
        created_by: isUuid ? actor.createdBy : null,
        created_by_name: actor.createdByName.trim() || gate.profile.displayName.trim(),
      })
      .select(SELECT_COLUMNS)
      .single()

    if (error) {
      return {
        ok: false,
        reason: 'query',
        detail: isMissingQuoteRateTable(error.message)
          ? 'quote_rate_versions 테이블이 없습니다. supabase/migrate-quote-rate-versions.sql 을 Supabase에서 실행해 주세요.'
          : error.message,
      }
    }

    return { ok: true, version: mapVersion(data as QuoteRateVersionRow) }
  } catch (error) {
    return { ok: false, reason: 'query', detail: error instanceof Error ? error.message : String(error) }
  }
}
