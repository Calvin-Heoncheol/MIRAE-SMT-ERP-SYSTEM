import {
  isNewCompanyStatus,
  type NewCompanyInquiry,
  type NewCompanyInquiryPayload,
  type NewCompanyStatus,
} from './types'

export type NewCompanyInquiryRow = {
  id: string
  contact_name: string
  company_name: string
  email: string
  phone: string
  product: string
  quantity: number | string | null
  note?: string | null
  inquiry_content?: string | null
  status?: string | null
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

  const statusRaw = (row.status || 'received').toLowerCase()
  const status: NewCompanyStatus = isNewCompanyStatus(statusRaw) ? statusRaw : 'received'

  return {
    id: row.id,
    contactName: row.contact_name ?? '',
    companyName: row.company_name ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    product: row.product ?? '',
    quantity: Number.isFinite(quantity) ? quantity : null,
    note: row.note ?? row.inquiry_content ?? '',
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toNewCompanyInquiryRow(payload: NewCompanyInquiryPayload) {
  return {
    contact_name: payload.contactName.trim(),
    company_name: payload.companyName.trim(),
    email: payload.email.trim(),
    phone: payload.phone.trim(),
    product: payload.product.trim(),
    quantity: payload.quantity,
    note: payload.note.trim(),
    status: payload.status,
  }
}

export function formatInquiryQuantity(value: number | null) {
  if (value == null) return '-'
  return value.toLocaleString('ko-KR')
}
