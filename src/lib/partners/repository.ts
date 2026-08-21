import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { createSupabaseClient } from '@/lib/supabase'
import { validatePartnerForm, type PartnerFormState } from './form-state'
import type { BusinessPartner, BusinessPartnerPayload } from './types'
import { mapBusinessPartnerRecord, toBusinessPartnerRow } from './utils'

export type FetchBusinessPartnersResult =
  | { ok: true; partners: BusinessPartner[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveBusinessPartnerResult =
  | { ok: true; id: string; businessRegNo: string }
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
  if (
    detail.includes('business_partners_business_reg_no_uidx') ||
    detail.includes('business_partners_pkey') ||
    detail.includes('duplicate key')
  ) {
    return '이미 등록된 사업자번호입니다.'
  }
  if (detail.includes('payment_term') || detail.includes('payment_deposit') || detail.includes('payment_net') || detail.includes('payment_monthly')) {
    return '결제조건 컬럼이 없습니다. supabase/migrate-partners-payment-terms.sql 을 실행해 주세요.'
  }
  return detail
}

function validatePartnerPayload(payload: BusinessPartnerPayload) {
  return validatePartnerForm({
    businessRegNo: payload.businessRegNo,
    name: payload.name,
    representativeName: payload.representativeName,
    businessType: payload.businessType,
    address: payload.address,
    phone: payload.phone,
    tradeRole: payload.tradeRole,
    paymentTermType: payload.paymentTermType,
    paymentDepositPercent: String(payload.paymentDepositPercent || ''),
    paymentNetDays: String(payload.paymentNetDays || ''),
    paymentMonthlyDay: String(payload.paymentMonthlyDay || ''),
  } satisfies PartnerFormState)
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

/** 발주서 등 거래처 선택용 */
export async function fetchSalesBusinessPartners(): Promise<FetchBusinessPartnersResult> {
  return fetchBusinessPartners()
}

/** 거래명세서 등 — 상호명으로 활성 거래처 1건 조회 */
export async function findActiveBusinessPartnerByName(
  name: string,
): Promise<BusinessPartner | null> {
  const want = String(name || '').trim()
  if (!want) return null
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('business_partners')
      .select('*')
      .eq('is_active', true)
      .eq('name', want)
      .limit(1)

    if (error || !data?.[0]) return null
    return mapBusinessPartnerRecord(data[0])
  } catch {
    return null
  }
}

/** 공급사·발주 등 거래처 선택용 */
export async function fetchPurchaseBusinessPartners(): Promise<FetchBusinessPartnersResult> {
  return fetchBusinessPartners()
}

export async function createBusinessPartner(
  payload: BusinessPartnerPayload,
): Promise<SaveBusinessPartnerResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'master', action: 'create' })
  if (!gate.ok) return gate

  const invalid = validatePartnerPayload(payload)
  if (invalid) {
    return { ok: false, reason: 'validation', detail: invalid }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('business_partners')
      .insert(toBusinessPartnerRow(payload))
      .select('id, business_reg_no')
      .single()

    if (error) {
      return { ok: false, reason: 'query', detail: mapDuplicateError(error.message) }
    }

    return { ok: true, id: data.id, businessRegNo: data.business_reg_no }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateBusinessPartner(
  partnerId: string,
  payload: BusinessPartnerPayload,
): Promise<SaveBusinessPartnerResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'master', action: 'update' })
  if (!gate.ok) return gate

  const id = String(partnerId || '').trim()
  if (!id) {
    return {
      ok: false,
      reason: 'validation',
      detail: '거래처ID가 없습니다. Supabase에서 migrate-partners-internal-id.sql 을 실행해 주세요.',
    }
  }
  const invalid = validatePartnerPayload(payload)
  if (invalid) {
    return { ok: false, reason: 'validation', detail: invalid }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('business_partners')
      .update(toBusinessPartnerRow(payload))
      .eq('id', id)
      .select('id, business_reg_no')
      .single()

    if (error) {
      return { ok: false, reason: 'query', detail: mapDuplicateError(error.message) }
    }

    return { ok: true, id: data.id, businessRegNo: data.business_reg_no }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteBusinessPartner(partnerId: string): Promise<DeleteBusinessPartnerResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'master', action: 'delete' })
  if (!gate.ok) return gate

  const id = String(partnerId || '').trim()
  if (!id) {
    return { ok: false, reason: 'validation', detail: '거래처를 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('business_partners').delete().eq('id', id)

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
