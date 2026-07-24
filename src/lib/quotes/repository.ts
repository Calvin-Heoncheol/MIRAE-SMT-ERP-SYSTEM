import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { isMissingCreatedByColumn, withCreatedByFields } from '@/lib/auth/created-by'
import { createSupabaseClient } from '@/lib/supabase'
import type { QuoteRowPayload } from './build-quote-payload'
import type { QuoteRecord, QuoteType } from './types'
import { mapQuoteRecord, isLegacyQuoteDetail, sortQuotesNewestFirst } from './utils'

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

    const quotes = sortQuotesNewestFirst(
      (data as QuoteRecord[])
        .map(mapQuoteRecord)
        .filter((quote) => !isLegacyQuoteDetail(quote.detailInfo)),
    )
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
    const insertRow = await withCreatedByFields({
      quote_date: payload.quote_date,
      customer: payload.customer,
      product_name: payload.product_name,
      board_qty: payload.board_qty,
      total_amount: payload.total_amount,
      detail_info: payload.detail_info,
    })
    const { data, error } = await supabase.from('quotations').insert(insertRow).select('id').single()

    if (error) {
      if (isMissingCreatedByColumn(error.message)) {
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

export async function updateQuote(quoteId: string, payload: QuoteRowPayload): Promise<SaveQuoteResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'sales', action: 'update' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase
      .from('quotations')
      .update({
        quote_date: payload.quote_date,
        customer: payload.customer,
        product_name: payload.product_name,
        board_qty: payload.board_qty,
        total_amount: payload.total_amount,
        detail_info: payload.detail_info,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)

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
