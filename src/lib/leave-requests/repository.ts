import { assertCanWrite } from '@/lib/auth/assert-can-write'
import {
  isMissingCreatedByColumn,
  resolveCreatedBySnapshot,
  stripCreatedByFields,
} from '@/lib/auth/created-by'
import { createSupabaseClient } from '@/lib/supabase'
import type { LeaveRequestRecord, LeaveRequestRowPayload } from './types'
import { mapLeaveRequestRecord, sortLeaveRequestsNewestFirst } from './utils'

export type FetchLeaveRequestsResult =
  | { ok: true; requests: ReturnType<typeof mapLeaveRequestRecord>[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveLeaveRequestResult =
  | { ok: true; id: string; docNumber: string }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

export type DeleteLeaveRequestsResult =
  | { ok: true; deletedCount: number }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

function missingEnvResult(): SaveLeaveRequestResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

export async function fetchLeaveRequests(): Promise<FetchLeaveRequestsResult> {
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
      .from('leave_requests')
      .select('*')
      .order('written_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const requests = sortLeaveRequestsNewestFirst((data as LeaveRequestRecord[]).map(mapLeaveRequestRecord))
    return { ok: true, requests }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createLeaveRequest(payload: LeaveRequestRowPayload): Promise<SaveLeaveRequestResult> {
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
      .from('leave_requests')
      .insert(insertPayload)
      .select('id, doc_number')
      .single()

    if (error && isMissingCreatedByColumn(error.message)) {
      insertPayload = stripCreatedByFields(insertPayload)
      ;({ data, error } = await supabase
        .from('leave_requests')
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

export async function updateLeaveRequest(id: string, payload: LeaveRequestRowPayload): Promise<SaveLeaveRequestResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'approvals', action: 'update' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('leave_requests')
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

export async function deleteLeaveRequests(ids: string[]): Promise<DeleteLeaveRequestsResult> {
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
    const { error, count } = await supabase.from('leave_requests').delete({ count: 'exact' }).in('id', ids)

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

export function formatLeaveRequestSaveError(detail: string) {
  if (/Could not find the table.*leave_requests/i.test(detail) || /relation.*leave_requests.*does not exist/i.test(detail)) {
    return 'leave_requests 테이블이 없습니다. Supabase SQL Editor에서 supabase/setup-leave-requests.sql 을 실행한 뒤, 다시 시도해 주세요.'
  }
  return detail
}
