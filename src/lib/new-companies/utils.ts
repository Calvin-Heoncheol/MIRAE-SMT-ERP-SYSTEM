import {
  normalizeNewCompanyStatus,
  toDbNewCompanyStatus,
  type NewCompanyInquiry,
  type NewCompanyInquiryPayload,
} from './types'

export type NewCompanyInquiryRow = {
  id: string
  contact_name: string
  company_name: string
  region?: string | null
  email: string
  phone: string
  product: string
  quantity: number | string | null
  note?: string | null
  inquiry_content?: string | null
  status?: string | null
  source_channel?: string | null
  close_reason?: string | null
  created_by?: string | null
  created_by_name?: string | null
  created_at: string
  updated_at: string
}

export function mapNewCompanyInquiryRecord(row: NewCompanyInquiryRow): NewCompanyInquiry {
  const quantity =
    row.quantity == null || row.quantity === ''
      ? null
      : typeof row.quantity === 'number'
        ? row.quantity
        : Number(row.quantity)

  return {
    id: row.id,
    contactName: row.contact_name ?? '',
    companyName: row.company_name ?? '',
    region: row.region ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    product: row.product ?? '',
    quantity: Number.isFinite(quantity) ? quantity : null,
    note: row.note ?? row.inquiry_content ?? '',
    status: normalizeNewCompanyStatus(row.status),
    sourceChannel: row.source_channel ?? '',
    closeReason: row.close_reason ?? '',
    createdByName: String(row.created_by_name || '').trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toNewCompanyInquiryRow(payload: NewCompanyInquiryPayload) {
  return {
    contact_name: payload.contactName.trim(),
    company_name: payload.companyName.trim(),
    region: payload.region.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    product: payload.product.trim(),
    quantity: payload.quantity,
    note: payload.note.trim(),
    status: toDbNewCompanyStatus(payload.status),
    source_channel: payload.sourceChannel.trim(),
    close_reason: payload.closeReason.trim(),
  }
}

export function formatInquiryQuantity(value: number | null) {
  if (value == null) return '-'
  return value.toLocaleString('ko-KR')
}
