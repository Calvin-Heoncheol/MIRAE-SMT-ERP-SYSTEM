import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { resolveCreatedBySnapshot } from '@/lib/auth/created-by'
import type { AuthProfile } from '@/lib/auth/types'
import { createSupabaseClient } from '@/lib/supabase'
import type { QuoteRowPayload } from './build-quote-payload'
import type { QuoteDetailInfo, QuoteRecord, QuoteStatus, QuoteType } from './types'
import { mapQuoteRecord, sortQuotesNewestFirst } from './utils'

export type FetchQuotesResult =
  | { ok: true; quotes: ReturnType<typeof mapQuoteRecord>[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveQuoteResult =
  | { ok: true; quoteId: string; quoteNumber: string }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

export type DeleteQuotesResult =
  | { ok: true; deletedCount: number }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

function missingEnvResult(): SaveQuoteResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}

/** 등록자/수정자 스냅샷 — 세션 이름 없으면 권한 프로필 표시명 사용 */
async function resolveQuoteActor(profile: AuthProfile) {
  const snap = await resolveCreatedBySnapshot()
  const name =
    snap.createdByName.trim() ||
    profile.displayName.trim() ||
    profile.email.split('@')[0].trim() ||
    ''
  const fromSnap = snap.createdBy && isUuid(snap.createdBy) ? snap.createdBy : null
  const fromProfile = profile.id && isUuid(profile.id) ? profile.id : null
  return {
    userId: fromSnap || fromProfile,
    name,
  }
}

function isMissingUpdatedByColumn(message: string) {
  return (
    (message.includes('updated_by') || message.includes('updated_by_name')) &&
    (message.includes('column') || message.includes('schema cache') || message.includes('Could not find'))
  )
}

function isMissingStatusColumn(message: string) {
  return (
    message.includes('status') &&
    (message.includes('column') || message.includes('schema cache') || message.includes('Could not find'))
  )
}

function quoteStatusFromPayload(payload: QuoteRowPayload) {
  return payload.status === 'confirmed' || payload.detail_info.settings?.quoteStatus === 'confirmed'
    ? 'confirmed'
    : 'draft'
}

export async function fetchQuotes(): Promise<FetchQuotesResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('quotations')
      .select('*')
      .order('quote_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return {
        ok: false,
        reason: 'query',
        detail: error.message,
      }
    }

    const quotes = sortQuotesNewestFirst((data as QuoteRecord[]).map(mapQuoteRecord))
    return { ok: true, quotes }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createQuote(payload: QuoteRowPayload, _quoteType: QuoteType): Promise<SaveQuoteResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'sales', action: 'create' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    const actor = await resolveQuoteActor(gate.profile)
    const baseRow = {
      quote_date: payload.quote_date,
      customer: payload.customer,
      product_name: payload.product_name,
      board_qty: payload.board_qty,
      total_amount: payload.total_amount,
      detail_info: payload.detail_info,
      status: quoteStatusFromPayload(payload),
      created_by: actor.userId,
      created_by_name: actor.name,
      updated_by: actor.userId,
      updated_by_name: actor.name,
    }

    let { data, error } = await supabase.from('quotations').insert(baseRow).select('id').single()

    if (error && isMissingUpdatedByColumn(error.message)) {
      const { updated_by: _u, updated_by_name: _n, ...withoutUpdated } = baseRow
      ;({ data, error } = await supabase.from('quotations').insert(withoutUpdated).select('id').single())
    }

    if (error && isMissingStatusColumn(error.message)) {
      const { status: _s, ...withoutStatus } = baseRow
      ;({ data, error } = await supabase.from('quotations').insert(withoutStatus).select('id').single())
      if (error && isMissingUpdatedByColumn(error.message)) {
        const { updated_by: _u, updated_by_name: _n, ...withoutBoth } = withoutStatus
        ;({ data, error } = await supabase.from('quotations').insert(withoutBoth).select('id').single())
      }
    }

    if (error) {
      if (error.message.includes('created_by') || error.message.includes('created_by_name')) {
        return {
          ok: false,
          reason: 'query',
          detail:
            'quotations.created_by 컬럼이 없습니다. supabase/migrate-created-by-high-med.sql 을 Supabase에서 실행한 뒤 다시 저장해 주세요.',
        }
      }
      return { ok: false, reason: 'query', detail: error.message || '견적서 저장에 실패했습니다.' }
    }

    if (!data?.id) {
      return { ok: false, reason: 'query', detail: '견적서 저장에 실패했습니다.' }
    }

    return { ok: true, quoteId: data.id, quoteNumber: data.id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateQuote(
  quoteId: string,
  payload: QuoteRowPayload,
): Promise<SaveQuoteResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'sales', action: 'update' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    const actor = await resolveQuoteActor(gate.profile)
    const { data: beforeRow } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', quoteId)
      .maybeSingle()

    const before = beforeRow ? mapQuoteRecord(beforeRow as QuoteRecord) : null
    const patch: Record<string, unknown> = {
      quote_date: payload.quote_date,
      customer: payload.customer,
      product_name: payload.product_name,
      board_qty: payload.board_qty,
      total_amount: payload.total_amount,
      detail_info: payload.detail_info,
      status: quoteStatusFromPayload(payload),
      updated_at: new Date().toISOString(),
      updated_by: actor.userId,
      updated_by_name: actor.name,
    }

    // 예전 데이터처럼 등록자가 비어 있으면 이번 수정자로 채움
    if (before && !before.createdByName.trim()) {
      patch.created_by = before.createdBy || actor.userId
      patch.created_by_name = actor.name
    }

    let { error } = await supabase.from('quotations').update(patch).eq('id', quoteId)

    if (error && isMissingUpdatedByColumn(error.message)) {
      const { updated_by: _u, updated_by_name: _n, ...withoutUpdated } = patch
      // updated_by 컬럼 없으면 목록「등록자」에 최종 수정자가 보이도록 등록자명 갱신
      withoutUpdated.created_by_name = actor.name
      if (actor.userId) withoutUpdated.created_by = actor.userId
      ;({ error } = await supabase.from('quotations').update(withoutUpdated).eq('id', quoteId))
    }

    if (error && isMissingStatusColumn(error.message)) {
      const { status: _s, ...withoutStatus } = patch
      ;({ error } = await supabase.from('quotations').update(withoutStatus).eq('id', quoteId))
      if (error && isMissingUpdatedByColumn(error.message)) {
        const { updated_by: _u, updated_by_name: _n, ...withoutBoth } = withoutStatus
        withoutBoth.created_by_name = actor.name
        if (actor.userId) withoutBoth.created_by = actor.userId
        ;({ error } = await supabase.from('quotations').update(withoutBoth).eq('id', quoteId))
      }
    }

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, quoteId, quoteNumber: quoteId }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateQuoteStatus(
  quoteId: string,
  status: QuoteStatus,
  detailInfo: QuoteDetailInfo = {},
): Promise<SaveQuoteResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'sales', action: 'update' })
  if (!gate.ok) return gate

  const nextStatus = status === 'confirmed' ? 'confirmed' : 'draft'
  const nextDetail: QuoteDetailInfo = {
    ...detailInfo,
    settings: {
      ...detailInfo.settings,
      quoteStatus: nextStatus,
    },
  }

  try {
    const supabase = createSupabaseClient()
    const actor = await resolveQuoteActor(gate.profile)
    const patch: Record<string, unknown> = {
      status: nextStatus,
      detail_info: nextDetail,
      updated_at: new Date().toISOString(),
      updated_by: actor.userId,
      updated_by_name: actor.name,
    }

    let { error } = await supabase.from('quotations').update(patch).eq('id', quoteId)

    if (error && isMissingUpdatedByColumn(error.message)) {
      const { updated_by: _u, updated_by_name: _n, ...withoutUpdated } = patch
      ;({ error } = await supabase.from('quotations').update(withoutUpdated).eq('id', quoteId))
    }

    if (error && isMissingStatusColumn(error.message)) {
      const { status: _s, ...withoutStatus } = patch
      ;({ error } = await supabase.from('quotations').update(withoutStatus).eq('id', quoteId))
      if (error && isMissingUpdatedByColumn(error.message)) {
        const { updated_by: _u, updated_by_name: _n, ...withoutBoth } = withoutStatus
        ;({ error } = await supabase.from('quotations').update(withoutBoth).eq('id', quoteId))
      }
    }

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, quoteId, quoteNumber: quoteId }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteQuotes(quoteIds: string[]): Promise<DeleteQuotesResult> {
  if (!quoteIds.length) {
    return { ok: true, deletedCount: 0 }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const gate = await assertCanWrite({ module: 'sales', action: 'delete' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('quotations').delete().in('id', quoteIds)

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, deletedCount: quoteIds.length }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
