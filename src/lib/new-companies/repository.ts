import { createSupabaseClient } from '@/lib/supabase'
import type { NewCompanyInquiry, NewCompanyInquiryPayload } from './types'
import {
  mapNewCompanyInquiryRecord,
  toNewCompanyInquiryRow,
  type NewCompanyInquiryRow,
} from './utils'

export type FetchNewCompanyInquiriesResult =
  | { ok: true; inquiries: NewCompanyInquiry[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveNewCompanyInquiryResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export type DeleteNewCompanyInquiryResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export function isMissingNewCompanyInquiriesTable(detail: string) {
  return detail.includes('new_company_inquiries') || detail.includes('schema cache')
}

function missingEnvResult<T extends { ok: false; reason: 'env'; detail: string }>(): T {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  } as T
}

export async function fetchNewCompanyInquiries(): Promise<FetchNewCompanyInquiriesResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('new_company_inquiries')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return {
      ok: true,
      inquiries: ((data || []) as NewCompanyInquiryRow[]).map(mapNewCompanyInquiryRecord),
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createNewCompanyInquiry(
  payload: NewCompanyInquiryPayload,
): Promise<SaveNewCompanyInquiryResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  if (!payload.contactName.trim()) {
    return { ok: false, reason: 'validation', detail: '담당자는 필수입니다.' }
  }
  if (!payload.companyName.trim()) {
    return { ok: false, reason: 'validation', detail: '회사명은 필수입니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    let row: Record<string, unknown> = toNewCompanyInquiryRow(payload)
    let { data, error } = await supabase
      .from('new_company_inquiries')
      .insert(row)
      .select('id')
      .single()

    if (error && error.message.includes('close_reason')) {
      const { close_reason: _removed, ...withoutCloseReason } = row
      row = withoutCloseReason
      ;({ data, error } = await supabase
        .from('new_company_inquiries')
        .insert(row)
        .select('id')
        .single())
    }

    if (error && error.message.includes('source_channel')) {
      const { source_channel: _removed, ...withoutChannel } = row
      row = withoutChannel
      ;({ data, error } = await supabase
        .from('new_company_inquiries')
        .insert(row)
        .select('id')
        .single())
    }

    if (error || !data?.id) {
      return { ok: false, reason: 'query', detail: error?.message || '저장에 실패했습니다.' }
    }

    return { ok: true, id: data.id as string }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateNewCompanyInquiry(
  id: string,
  payload: NewCompanyInquiryPayload,
): Promise<SaveNewCompanyInquiryResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  if (!id.trim()) {
    return { ok: false, reason: 'validation', detail: '수정할 항목이 없습니다.' }
  }
  if (!payload.contactName.trim()) {
    return { ok: false, reason: 'validation', detail: '담당자는 필수입니다.' }
  }
  if (!payload.companyName.trim()) {
    return { ok: false, reason: 'validation', detail: '회사명은 필수입니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    let row: Record<string, unknown> = toNewCompanyInquiryRow(payload)
    let { error } = await supabase.from('new_company_inquiries').update(row).eq('id', id)

    if (error && error.message.includes('close_reason')) {
      const { close_reason: _removed, ...withoutCloseReason } = row
      row = withoutCloseReason
      ;({ error } = await supabase.from('new_company_inquiries').update(row).eq('id', id))
    }

    if (error && error.message.includes('source_channel')) {
      const { source_channel: _removed, ...withoutChannel } = row
      row = withoutChannel
      ;({ error } = await supabase.from('new_company_inquiries').update(row).eq('id', id))
    }

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteNewCompanyInquiry(id: string): Promise<DeleteNewCompanyInquiryResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  if (!id.trim()) {
    return { ok: false, reason: 'validation', detail: '삭제할 항목이 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('new_company_inquiries').delete().eq('id', id)

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
