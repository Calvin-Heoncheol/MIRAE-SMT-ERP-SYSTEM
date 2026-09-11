import { createSupabaseClient } from '@/lib/supabase'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseAdminClient, hasSupabaseServiceRoleKey } from '@/lib/supabase/admin'
import { isAuthDisabled } from '@/lib/auth/config'
import type { CompanyNotice, UpsertCompanyNoticeInput } from './types'
import { NOTICE_BODY_MAX, NOTICE_HOME_LIMIT, NOTICE_TITLE_MAX } from './types'

export type FetchNoticesResult =
  | { ok: true; rows: CompanyNotice[] }
  | { ok: false; reason: 'env' | 'query' | 'missing_table'; detail: string }

export type MutateNoticeResult =
  | { ok: true; notice: CompanyNotice }
  | { ok: false; reason: 'env' | 'query' | 'missing_table' | 'validation'; detail: string }

export type DeleteNoticeResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'missing_table' | 'validation'; detail: string }

export function isMissingNoticesTable(detail: string) {
  return (
    detail.includes('company_notices') ||
    detail.includes('schema cache') ||
    detail.includes('does not exist')
  )
}

function mapRow(row: {
  id: string
  title: string | null
  body: string | null
  is_pinned: boolean | null
  created_by_name?: string | null
  created_at: string
  updated_at?: string | null
}): CompanyNotice {
  return {
    id: row.id,
    title: (row.title || '').trim(),
    body: (row.body || '').trim(),
    isPinned: Boolean(row.is_pinned),
    createdByName: (row.created_by_name || '').trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  }
}

function validateInput(input: UpsertCompanyNoticeInput):
  | { ok: true; title: string; body: string; isPinned: boolean }
  | { ok: false; detail: string } {
  const title = String(input.title || '').trim()
  const body = String(input.body || '').trim()
  if (!title) return { ok: false, detail: '제목을 입력하세요.' }
  if (title.length > NOTICE_TITLE_MAX) {
    return { ok: false, detail: `제목은 ${NOTICE_TITLE_MAX}자 이내로 입력하세요.` }
  }
  if (!body) return { ok: false, detail: '본문을 입력하세요.' }
  if (body.length > NOTICE_BODY_MAX) {
    return { ok: false, detail: `본문은 ${NOTICE_BODY_MAX}자 이내로 입력하세요.` }
  }
  return { ok: true, title, body, isPinned: Boolean(input.isPinned) }
}

async function getWriteClient() {
  if (isAuthDisabled() && hasSupabaseServiceRoleKey()) {
    return createSupabaseAdminClient()
  }
  try {
    return await createSupabaseServerClient()
  } catch {
    return createSupabaseClient()
  }
}

/** 대시보드용 최근 공지 (고정 우선) */
export async function fetchRecentNotices(limit = NOTICE_HOME_LIMIT): Promise<FetchNoticesResult> {
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
      .from('company_notices')
      .select('id, title, body, is_pinned, created_by_name, created_at, updated_at')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Math.min(100, limit)))

    if (error) {
      if (isMissingNoticesTable(error.message)) {
        return {
          ok: false,
          reason: 'missing_table',
          detail: 'company_notices 테이블이 없습니다. migrate-company-notices.sql 을 실행하세요.',
        }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, rows: (data || []).map(mapRow) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : '공지 조회 실패',
    }
  }
}

export async function upsertCompanyNotice(
  input: UpsertCompanyNoticeInput,
  author: { id: string | null; name: string },
): Promise<MutateNoticeResult> {
  const validated = validateInput(input)
  if (!validated.ok) {
    return { ok: false, reason: 'validation', detail: validated.detail }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    const supabase = await getWriteClient()
    const now = new Date().toISOString()
    const id = String(input.id || '').trim()

    if (id) {
      const { data, error } = await supabase
        .from('company_notices')
        .update({
          title: validated.title,
          body: validated.body,
          is_pinned: validated.isPinned,
          updated_at: now,
        })
        .eq('id', id)
        .select('id, title, body, is_pinned, created_by_name, created_at, updated_at')
        .maybeSingle()

      if (error) {
        if (isMissingNoticesTable(error.message)) {
          return {
            ok: false,
            reason: 'missing_table',
            detail: 'company_notices 테이블이 없습니다. migrate-company-notices.sql 을 실행하세요.',
          }
        }
        return { ok: false, reason: 'query', detail: error.message }
      }
      if (!data) {
        return { ok: false, reason: 'validation', detail: '공지를 찾을 수 없습니다.' }
      }
      return { ok: true, notice: mapRow(data) }
    }

    const { data, error } = await supabase
      .from('company_notices')
      .insert({
        title: validated.title,
        body: validated.body,
        is_pinned: validated.isPinned,
        created_by: author.id,
        created_by_name: author.name,
        created_at: now,
        updated_at: now,
      })
      .select('id, title, body, is_pinned, created_by_name, created_at, updated_at')
      .maybeSingle()

    if (error) {
      if (isMissingNoticesTable(error.message)) {
        return {
          ok: false,
          reason: 'missing_table',
          detail: 'company_notices 테이블이 없습니다. migrate-company-notices.sql 을 실행하세요.',
        }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }
    if (!data) {
      return { ok: false, reason: 'query', detail: '공지 저장 결과를 확인할 수 없습니다.' }
    }
    return { ok: true, notice: mapRow(data) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : '공지 저장 실패',
    }
  }
}

export async function deleteCompanyNotice(id: string): Promise<DeleteNoticeResult> {
  const noticeId = String(id || '').trim()
  if (!noticeId) {
    return { ok: false, reason: 'validation', detail: '공지 ID가 없습니다.' }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    const supabase = await getWriteClient()
    const { error } = await supabase.from('company_notices').delete().eq('id', noticeId)

    if (error) {
      if (isMissingNoticesTable(error.message)) {
        return {
          ok: false,
          reason: 'missing_table',
          detail: 'company_notices 테이블이 없습니다. migrate-company-notices.sql 을 실행하세요.',
        }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : '공지 삭제 실패',
    }
  }
}
