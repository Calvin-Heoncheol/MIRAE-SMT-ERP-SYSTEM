import { assertCanWrite } from '@/lib/auth/assert-can-write'
import {
  isMissingCreatedByColumn,
  resolveCreatedBySnapshot,
  stripCreatedByFields,
} from '@/lib/auth/created-by'
import { createSupabaseClient } from '@/lib/supabase'
import type { ExpenseReportRecord, ExpenseReportRowPayload } from './types'
import { mapExpenseReportRecord, sortExpenseReportsNewestFirst } from './utils'

export type FetchExpenseReportsResult =
  | { ok: true; reports: ReturnType<typeof mapExpenseReportRecord>[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveExpenseReportResult =
  | { ok: true; id: string; docNumber: string }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

export type DeleteExpenseReportsResult =
  | { ok: true; deletedCount: number }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

function missingEnvResult(): SaveExpenseReportResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

export async function fetchExpenseReports(): Promise<FetchExpenseReportsResult> {
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
      .from('expense_reports')
      .select('*')
      .order('written_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const reports = sortExpenseReportsNewestFirst((data as ExpenseReportRecord[]).map(mapExpenseReportRecord))
    return { ok: true, reports }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createExpenseReport(payload: ExpenseReportRowPayload): Promise<SaveExpenseReportResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'approvals', action: 'create' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    const snap = await resolveCreatedBySnapshot()
    let insertPayload: Record<string, unknown> = {
      ...payload,
      author: payload.author.trim() || snap.createdByName,
      created_by: snap.createdBy,
      created_by_name: snap.createdByName,
    }

    let { data, error } = await supabase
      .from('expense_reports')
      .insert(insertPayload)
      .select('id, doc_number')
      .single()

    if (error && isMissingCreatedByColumn(error.message)) {
      insertPayload = stripCreatedByFields(insertPayload)
      ;({ data, error } = await supabase
        .from('expense_reports')
        .insert(insertPayload)
        .select('id, doc_number')
        .single())
    }

    if (error || !data) {
      return { ok: false, reason: 'query', detail: error?.message || '저장에 실패했습니다.' }
    }

    return { ok: true, id: data.id, docNumber: data.doc_number }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateExpenseReport(id: string, payload: ExpenseReportRowPayload): Promise<SaveExpenseReportResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'approvals', action: 'update' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('expense_reports')
      .update(payload)
      .eq('id', id)
      .select('id, doc_number')
      .single()

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, id: data.id, docNumber: data.doc_number }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteExpenseReports(ids: string[]): Promise<DeleteExpenseReportsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { ok: false, reason: 'env', detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.' }
  }

  if (!ids.length) {
    return { ok: true, deletedCount: 0 }
  }

  const gate = await assertCanWrite({ module: 'approvals', action: 'delete' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    const { error, count } = await supabase.from('expense_reports').delete({ count: 'exact' }).in('id', ids)

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, deletedCount: count ?? ids.length }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
