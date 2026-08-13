import { createSupabaseClient } from '@/lib/supabase'
import type { BusinessPartner, PartnerPaymentTermType } from './types'
import { formatPartnerPaymentTermLabel, normalizePartnerPaymentTermType } from './utils'

export type PaymentTermSnapshot = {
  paymentTermType: PartnerPaymentTermType
  paymentDepositPercent: number
  paymentNetDays: number
  paymentMonthlyDay: number
}

export const EMPTY_PAYMENT_TERM_SNAPSHOT: PaymentTermSnapshot = {
  paymentTermType: '',
  paymentDepositPercent: 0,
  paymentNetDays: 0,
  paymentMonthlyDay: 0,
}

export type PaymentTermDbRow = {
  payment_term_type?: string | null
  payment_deposit_percent?: number | null
  payment_net_days?: number | null
  payment_monthly_day?: number | null
}

export function isEmptyPaymentTermSnapshot(snapshot: PaymentTermSnapshot | null | undefined) {
  return !snapshot?.paymentTermType
}

export function snapshotFromPartner(
  partner: Pick<
    BusinessPartner,
    'paymentTermType' | 'paymentDepositPercent' | 'paymentNetDays' | 'paymentMonthlyDay'
  > | null
  | undefined,
): PaymentTermSnapshot {
  if (!partner) return { ...EMPTY_PAYMENT_TERM_SNAPSHOT }
  return {
    paymentTermType: partner.paymentTermType,
    paymentDepositPercent: Math.max(0, Math.floor(Number(partner.paymentDepositPercent) || 0)),
    paymentNetDays: Math.max(0, Math.floor(Number(partner.paymentNetDays) || 0)),
    paymentMonthlyDay: Math.max(0, Math.floor(Number(partner.paymentMonthlyDay) || 0)),
  }
}

export function paymentTermSnapshotFromDbRow(row: PaymentTermDbRow | null | undefined): PaymentTermSnapshot {
  if (!row) return { ...EMPTY_PAYMENT_TERM_SNAPSHOT }
  return {
    paymentTermType: normalizePartnerPaymentTermType(row.payment_term_type),
    paymentDepositPercent: Math.max(0, Math.floor(Number(row.payment_deposit_percent) || 0)),
    paymentNetDays: Math.max(0, Math.floor(Number(row.payment_net_days) || 0)),
    paymentMonthlyDay: Math.max(0, Math.floor(Number(row.payment_monthly_day) || 0)),
  }
}

export function paymentTermSnapshotToDbRow(snapshot: PaymentTermSnapshot) {
  return {
    payment_term_type: snapshot.paymentTermType || '',
    payment_deposit_percent: Math.max(0, Math.floor(Number(snapshot.paymentDepositPercent) || 0)),
    payment_net_days: Math.max(0, Math.floor(Number(snapshot.paymentNetDays) || 0)),
    payment_monthly_day: Math.max(0, Math.floor(Number(snapshot.paymentMonthlyDay) || 0)),
  }
}

export function omitPaymentTermSnapshotFields<T extends Record<string, unknown>>(row: T) {
  const {
    payment_term_type: _type,
    payment_deposit_percent: _deposit,
    payment_net_days: _net,
    payment_monthly_day: _monthly,
    ...rest
  } = row
  return rest
}

export function isMissingPaymentTermSnapshotColumn(detail: string) {
  const message = String(detail || '').toLowerCase()
  const mentionsColumn =
    message.includes('payment_term_type') ||
    message.includes('payment_deposit_percent') ||
    message.includes('payment_net_days') ||
    message.includes('payment_monthly_day')
  return (
    mentionsColumn &&
    (message.includes('column') ||
      message.includes('schema cache') ||
      message.includes('could not find') ||
      message.includes('does not exist'))
  )
}

export function firstNonEmptyPaymentTermSnapshot(
  ...snapshots: Array<PaymentTermSnapshot | null | undefined>
): PaymentTermSnapshot {
  for (const snapshot of snapshots) {
    if (snapshot && !isEmptyPaymentTermSnapshot(snapshot)) return snapshot
  }
  return { ...EMPTY_PAYMENT_TERM_SNAPSHOT }
}

/** 고객사 변경 시 새 거래처 조건. 같은 고객이면 기존 스냅샷 유지, 비어 있으면 거래처에서 채움 */
export function resolvePaymentTermSnapshotForUpdate(input: {
  previousCustomer: string
  nextCustomer: string
  previousSnapshot: PaymentTermSnapshot
  partnerSnapshot: PaymentTermSnapshot
}): PaymentTermSnapshot {
  const previous = input.previousCustomer.trim()
  const next = input.nextCustomer.trim()
  if (previous !== next) return input.partnerSnapshot
  if (!isEmptyPaymentTermSnapshot(input.previousSnapshot)) return input.previousSnapshot
  return input.partnerSnapshot
}

export function formatPaymentTermSnapshotLabel(snapshot: PaymentTermSnapshot) {
  if (isEmptyPaymentTermSnapshot(snapshot)) return ''
  return formatPartnerPaymentTermLabel(snapshot)
}

export async function fetchPaymentTermSnapshotForCustomer(
  customer: string,
): Promise<PaymentTermSnapshot> {
  const name = String(customer || '').trim()
  if (!name) return { ...EMPTY_PAYMENT_TERM_SNAPSHOT }

  const supabase = createSupabaseClient()
  if (!supabase) return { ...EMPTY_PAYMENT_TERM_SNAPSHOT }

  const select =
    'name, payment_term_type, payment_deposit_percent, payment_net_days, payment_monthly_day'

  let { data, error } = await supabase
    .from('business_partners')
    .select(select)
    .eq('is_active', true)
    .eq('name', name)
    .limit(2)

  if (error) {
    if (isMissingPaymentTermSnapshotColumn(error.message)) {
      return { ...EMPTY_PAYMENT_TERM_SNAPSHOT }
    }
    return { ...EMPTY_PAYMENT_TERM_SNAPSHOT }
  }

  let rows = data || []
  if (!rows.length) {
    const safeName = name.replace(/[%_]/g, '')
    if (!safeName) return { ...EMPTY_PAYMENT_TERM_SNAPSHOT }
    const fallback = await supabase
      .from('business_partners')
      .select(select)
      .eq('is_active', true)
      .ilike('name', safeName)
      .limit(2)
    if (fallback.error) return { ...EMPTY_PAYMENT_TERM_SNAPSHOT }
    rows = fallback.data || []
  }

  if (rows.length !== 1) return { ...EMPTY_PAYMENT_TERM_SNAPSHOT }
  return paymentTermSnapshotFromDbRow(rows[0])
}

export async function persistPaymentTermSnapshot(
  table: 'quotations' | 'orders' | 'delivery_records',
  id: string,
  snapshot: PaymentTermSnapshot,
): Promise<{ ok: true } | { ok: false; missingColumn: boolean; detail: string }> {
  const rowId = String(id || '').trim()
  if (!rowId) return { ok: true }

  const supabase = createSupabaseClient()
  if (!supabase) return { ok: false, missingColumn: false, detail: 'Supabase 환경 변수가 없습니다.' }

  const { error } = await supabase.from(table).update(paymentTermSnapshotToDbRow(snapshot)).eq('id', rowId)
  if (!error) return { ok: true }
  if (isMissingPaymentTermSnapshotColumn(error.message)) {
    return { ok: false, missingColumn: true, detail: error.message }
  }
  return { ok: false, missingColumn: false, detail: error.message }
}
