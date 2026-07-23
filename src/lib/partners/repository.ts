import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { createSupabaseClient } from '@/lib/supabase'
import type { BusinessPartner, BusinessPartnerPayload } from './types'
import { mapBusinessPartnerRecord, normalizeBusinessRegNo, toBusinessPartnerRow } from './utils'

export type FetchBusinessPartnersResult =
  | { ok: true; partners: BusinessPartner[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveBusinessPartnerResult =
  | { ok: true; businessRegNo: string }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export type DeleteBusinessPartnerResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export function isMissingBusinessPartnersTable(detail: string) {
  return detail.includes('business_partners') || detail.includes('schema cache')
}

function missingEnvResult<T extends { ok: false; reason: 'env'; detail: string }>(): T {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  } as T
}

function mapDuplicateError(detail: string) {
  if (detail.includes('business_partners_pkey') || detail.includes('duplicate key')) {
    return '이미 등록된 사업자번호입니다.'
  }
  return detail
}

export async function fetchBusinessPartners(): Promise<FetchBusinessPartnersResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('business_partners')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return {
      ok: true,
      partners: (data || []).map((row) => mapBusinessPartnerRecord(row)),
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/** 주문서 등 매출 거래처 선택용 — trade_role 이 sales 또는 both 인 거래처만 */
export async function fetchSalesBusinessPartners(): Promise<FetchBusinessPartnersResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('business_partners')
      .select('*')
      .eq('is_active', true)
      .in('trade_role', ['sales', 'both'])
      .order('name', { ascending: true })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return {
      ok: true,
      partners: (data || []).map((row) => mapBusinessPartnerRecord(row)),
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/** 공급사·발주 등 매입 거래처 선택용 — trade_role 이 purchase 또는 both 인 거래처만 */
export async function fetchPurchaseBusinessPartners(): Promise<FetchBusinessPartnersResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('business_partners')
      .select('*')
      .eq('is_active', true)
      .in('trade_role', ['purchase', 'both'])
      .order('name', { ascending: true })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return {
      ok: true,
      partners: (data || []).map((row) => mapBusinessPartnerRecord(row)),
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createBusinessPartner(
  payload: BusinessPartnerPayload,
): Promise<SaveBusinessPartnerResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'master', action: 'create' })
  if (!gate.ok) return gate

  const businessRegNo = normalizeBusinessRegNo(payload.businessRegNo)
  if (!businessRegNo) {
    return { ok: false, reason: 'validation', detail: '사업자번호를 입력해 주세요.' }
  }
  if (!payload.name.trim()) {
    return { ok: false, reason: 'validation', detail: '거래처명을 입력해 주세요.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('business_partners')
      .insert(toBusinessPartnerRow(payload))
      .select('business_reg_no')
      .single()

    if (error) {
      return { ok: false, reason: 'query', detail: mapDuplicateError(error.message) }
    }

    return { ok: true, businessRegNo: data.business_reg_no }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateBusinessPartner(
  businessRegNo: string,
  payload: BusinessPartnerPayload,
): Promise<SaveBusinessPartnerResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'master', action: 'update' })
  if (!gate.ok) return gate

  const key = normalizeBusinessRegNo(businessRegNo)
  if (!key) {
    return { ok: false, reason: 'validation', detail: '사업자번호를 찾을 수 없습니다.' }
  }
  if (!payload.name.trim()) {
    return { ok: false, reason: 'validation', detail: '거래처명을 입력해 주세요.' }
  }

  try {
    const supabase = createSupabaseClient()
    const row = toBusinessPartnerRow({ ...payload, businessRegNo: key })
    const { business_reg_no: _pk, ...updates } = row

    const { error } = await supabase.from('business_partners').update(updates).eq('business_reg_no', key)

    if (error) {
      return { ok: false, reason: 'query', detail: mapDuplicateError(error.message) }
    }

    return { ok: true, businessRegNo: key }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteBusinessPartner(businessRegNo: string): Promise<DeleteBusinessPartnerResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'master', action: 'delete' })
  if (!gate.ok) return gate

  const key = normalizeBusinessRegNo(businessRegNo)
  if (!key) {
    return { ok: false, reason: 'validation', detail: '사업자번호를 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('business_partners').delete().eq('business_reg_no', key)

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
