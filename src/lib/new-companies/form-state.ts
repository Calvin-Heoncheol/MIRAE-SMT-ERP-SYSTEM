import type { NewCompanyInquiry, NewCompanyInquiryPayload, NewCompanyStatus } from './types'

export type NewCompanyInquiryFormState = {
  contactName: string
  companyName: string
  email: string
  phone: string
  product: string
  quantity: string
  note: string
  status: NewCompanyStatus
}

export function emptyNewCompanyInquiryForm(): NewCompanyInquiryFormState {
  return {
    contactName: '',
    companyName: '',
    email: '',
    phone: '',
    product: '',
    quantity: '',
    note: '',
    status: 'received',
  }
}

export function inquiryToForm(inquiry: NewCompanyInquiry): NewCompanyInquiryFormState {
  return {
    contactName: inquiry.contactName,
    companyName: inquiry.companyName,
    email: inquiry.email,
    phone: inquiry.phone,
    product: inquiry.product,
    quantity: inquiry.quantity == null ? '' : String(inquiry.quantity),
    note: inquiry.note,
    status: inquiry.status,
  }
}

export function formToInquiryPayload(form: NewCompanyInquiryFormState): NewCompanyInquiryPayload {
  const trimmedQty = form.quantity.trim()
  let quantity: number | null = null
  if (trimmedQty) {
    const parsed = Number(trimmedQty.replace(/,/g, ''))
    quantity = Number.isFinite(parsed) ? parsed : null
  }

  return {
    contactName: form.contactName.trim(),
    companyName: form.companyName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    product: form.product.trim(),
    quantity,
    note: form.note.trim(),
    status: form.status,
  }
}

export function validateNewCompanyInquiryForm(form: NewCompanyInquiryFormState): string | null {
  if (!form.contactName.trim()) return '담당자를 입력해 주세요.'
  if (!form.companyName.trim()) return '회사명을 입력해 주세요.'
  if (form.quantity.trim()) {
    const parsed = Number(form.quantity.trim().replace(/,/g, ''))
    if (!Number.isFinite(parsed) || parsed < 0) return '예상수량은 0 이상의 숫자로 입력해 주세요.'
  }
  return null
}
