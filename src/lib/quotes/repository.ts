import { createSupabaseClient } from '@/lib/supabase'
import type { QuoteRowPayload } from './build-quote-payload'
import type { QuoteRecord, QuoteType } from './types'
import { mapQuoteRecord, sortQuotesNewestFirst } from './utils'

export type FetchQuotesResult =
  | { ok: true; quotes: ReturnType<typeof mapQuoteRecord>[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveQuoteResult =
  | { ok: true; quoteNumber: string }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type DeleteQuotesResult =
  | { ok: true; deletedCount: number }
  | { ok: false; reason: 'env' | 'query'; detail: string }

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
      .order('quote_number', { ascending: false })

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

export async function createQuote(payload: QuoteRowPayload, quoteType: QuoteType): Promise<SaveQuoteResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data: quoteNumber, error: rpcError } = await supabase.rpc('generate_quote_number', {
      p_quote_type: quoteType,
    })

    if (rpcError) {
      return { ok: false, reason: 'query', detail: rpcError.message }
    }

    if (!quoteNumber || typeof quoteNumber !== 'string') {
      return { ok: false, reason: 'query', detail: '견적서 번호를 생성하지 못했습니다.' }
    }

    const { error } = await supabase.from('quotations').insert({
      quote_date: payload.quote_date,
      quote_number: quoteNumber,
      customer: payload.customer,
      product_name: payload.product_name,
      board_qty: payload.board_qty,
      total_amount: payload.total_amount,
      detail_info: payload.detail_info,
    })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, quoteNumber }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateQuote(quoteNumber: string, payload: QuoteRowPayload): Promise<SaveQuoteResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

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
      .eq('quote_number', quoteNumber)

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, quoteNumber }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteQuotes(quoteNumbers: string[]): Promise<DeleteQuotesResult> {
  if (!quoteNumbers.length) {
    return { ok: true, deletedCount: 0 }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('quotations').delete().in('quote_number', quoteNumbers)

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, deletedCount: quoteNumbers.length }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
