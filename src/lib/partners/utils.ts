import type { BusinessPartner, BusinessPartnerPayload, PartnerTradeRole } from './types'

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
  business_reg_no: string
  name: string
  representative_name: string
  business_type: string
  phone: string
  trade_role: string
  created_at: string
  updated_at: string
}): BusinessPartner {
  const tradeRole = row.trade_role
  const normalizedTradeRole: PartnerTradeRole =
    tradeRole === 'purchase' || tradeRole === 'sales' || tradeRole === 'both' ? tradeRole : 'both'

  return {
    businessRegNo: row.business_reg_no || '',
    name: row.name || '',
    representativeName: row.representative_name || '',
    businessType: row.business_type || '',
    phone: row.phone || '',
    tradeRole: normalizedTradeRole,
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
    phone: payload.phone.trim(),
    trade_role: payload.tradeRole,
  }
}

export function normalizePartnerSearchText(value: string) {
  return value.trim().toLowerCase()
}

export function partnerSearchHaystack(partner: BusinessPartner) {
  return [partner.name, partner.businessRegNo, formatBusinessRegNo(partner.businessRegNo)]
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
