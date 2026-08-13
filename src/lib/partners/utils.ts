import type {
  BusinessPartner,
  BusinessPartnerPayload,
  PartnerPaymentTermType,
  PartnerTradeRole,
} from './types'
import { PARTNER_PAYMENT_TERM_TYPE_LABELS } from './types'

export function normalizeBusinessRegNo(value: string) {
  return String(value || '').replace(/[^\d]/g, '')
}

export function formatBusinessRegNo(value: string) {
  const digits = normalizeBusinessRegNo(value)
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
  }
  return digits
}

export function mapBusinessPartnerRecord(row: {
  id?: string | null
  business_reg_no: string
  name: string
  representative_name: string
  business_type: string
  address?: string | null
  phone: string
  trade_role: string
  payment_term_type?: string | null
  payment_deposit_percent?: number | null
  payment_net_days?: number | null
  payment_monthly_day?: number | null
  created_at: string
  updated_at: string
}): BusinessPartner {
  const tradeRole = row.trade_role
  const normalizedTradeRole: PartnerTradeRole =
    tradeRole === 'purchase' || tradeRole === 'sales' || tradeRole === 'both' ? tradeRole : 'both'

  return {
    id: String(row.id || '').trim(),
    businessRegNo: row.business_reg_no || '',
    name: row.name || '',
    representativeName: row.representative_name || '',
    businessType: row.business_type || '',
    address: String(row.address || '').trim(),
    phone: row.phone || '',
    tradeRole: normalizedTradeRole,
    paymentTermType: normalizePartnerPaymentTermType(row.payment_term_type),
    paymentDepositPercent: Math.max(0, Math.floor(Number(row.payment_deposit_percent) || 0)),
    paymentNetDays: Math.max(0, Math.floor(Number(row.payment_net_days) || 0)),
    paymentMonthlyDay: Math.max(0, Math.floor(Number(row.payment_monthly_day) || 0)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toBusinessPartnerRow(payload: BusinessPartnerPayload) {
  return {
    business_reg_no: normalizeBusinessRegNo(payload.businessRegNo),
    name: payload.name.trim(),
    representative_name: payload.representativeName.trim(),
    business_type: payload.businessType.trim(),
    address: payload.address.trim(),
    phone: payload.phone.trim(),
    trade_role: payload.tradeRole,
    payment_term_type: payload.paymentTermType,
    payment_deposit_percent: Math.max(0, Math.floor(Number(payload.paymentDepositPercent) || 0)),
    payment_net_days: Math.max(0, Math.floor(Number(payload.paymentNetDays) || 0)),
    payment_monthly_day: Math.max(0, Math.floor(Number(payload.paymentMonthlyDay) || 0)),
  }
}

export function normalizePartnerPaymentTermType(value: string | null | undefined): PartnerPaymentTermType {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'installment' || raw === 'net' || raw === 'monthly') return raw
  return ''
}

export function formatPartnerPaymentTermLabel(
  partner: Pick<
    BusinessPartner,
    'paymentTermType' | 'paymentDepositPercent' | 'paymentNetDays' | 'paymentMonthlyDay'
  >,
) {
  const type = partner.paymentTermType
  if (!type) return ''
  if (type === 'installment') {
    const deposit = Math.min(99, Math.max(1, Math.floor(Number(partner.paymentDepositPercent) || 30)))
    return `${PARTNER_PAYMENT_TERM_TYPE_LABELS.installment} (선금 ${deposit}% / 잔금 ${100 - deposit}%)`
  }
  if (type === 'net') {
    const days = Math.max(1, Math.floor(Number(partner.paymentNetDays) || 30))
    return `${PARTNER_PAYMENT_TERM_TYPE_LABELS.net} (Net ${days}일)`
  }
  const day = Math.min(31, Math.max(1, Math.floor(Number(partner.paymentMonthlyDay) || 15)))
  return `${PARTNER_PAYMENT_TERM_TYPE_LABELS.monthly} (익월 ${day}일)`
}

export function normalizePartnerSearchText(value: string) {
  return value.trim().toLowerCase()
}

export function partnerSearchHaystack(partner: BusinessPartner) {
  return [
    partner.id,
    partner.name,
    partner.businessRegNo,
    formatBusinessRegNo(partner.businessRegNo),
    partner.address,
    formatPartnerPaymentTermLabel(partner),
  ]
    .join(' ')
    .toLowerCase()
}

export function filterPartnersForSearch(partners: BusinessPartner[], query: string) {
  const q = normalizePartnerSearchText(query)
  if (!q) return partners
  return partners.filter((partner) => partnerSearchHaystack(partner).includes(q))
}

export function findPartnerByName(partners: BusinessPartner[], name: string) {
  const want = name.trim()
  if (!want) return null

  const exactMatches = partners.filter((partner) => partner.name === want)
  if (exactMatches.length === 1) return exactMatches[0]

  const lowered = want.toLowerCase()
  const caseInsensitiveMatches = partners.filter((partner) => partner.name.toLowerCase() === lowered)
  if (caseInsensitiveMatches.length === 1) return caseInsensitiveMatches[0]

  return null
}

export function findPartnerByRegNo(partners: BusinessPartner[], regNo: string) {
  const key = normalizeBusinessRegNo(regNo)
  if (!key) return null
  return partners.find((partner) => partner.businessRegNo === key) ?? null
}

export function resolvePartnerFromInput(partners: BusinessPartner[], raw: string): BusinessPartner | null {
  const text = raw.trim()
  if (!text) return null

  const byName = findPartnerByName(partners, text)
  if (byName) return byName

  const byRegNo = findPartnerByRegNo(partners, text)
  if (byRegNo) return byRegNo

  const matches = filterPartnersForSearch(partners, text)
  if (matches.length === 1) return matches[0]

  return null
}

export function formatPartnerOptionLabel(partner: BusinessPartner) {
  return partner.name
}
