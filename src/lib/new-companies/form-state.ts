import type { NewCompanyInquiry, NewCompanyInquiryPayload, NewCompanyStatus } from './types'

const LEADING_INDEX_RE = /^\d+\.\s*/

/** DB note(줄바꿈 구분) → 편집용 진행사항 행 */
export function parseProgressLines(note: string): string[] {
  const lines = note
    .split(/\r?\n/)
    .map((line) => line.replace(LEADING_INDEX_RE, '').trim())
    .filter(Boolean)
  return lines.length ? lines : ['']
}

/** 편집 행 → DB note (번호 없이 한 줄씩 저장) */
export function serializeProgressLines(lines: string[]): string {
  return lines
    .map((line) => line.replace(LEADING_INDEX_RE, '').trim())
    .filter(Boolean)
    .join('\n')
}

/** 목록/툴팁용 표시 (1. … / 2. …) */
export function formatProgressLinesDisplay(note: string, separator = ' · '): string {
  const lines = note
    .split(/\r?\n/)
    .map((line) => line.replace(LEADING_INDEX_RE, '').trim())
    .filter(Boolean)
  if (!lines.length) return ''
  return lines.map((line, index) => `${index + 1}. ${line}`).join(separator)
}

/** 목록 행용 — 가장 최근(마지막) 진행사항만 (번호 없이) */
export function formatLatestProgressLineDisplay(note: string): string {
  const lines = note
    .split(/\r?\n/)
    .map((line) => line.replace(LEADING_INDEX_RE, '').trim())
    .filter(Boolean)
  if (!lines.length) return ''
  return lines[lines.length - 1]
}

export type NewCompanyInquiryFormState = {
  contactName: string
  companyName: string
  email: string
  phone: string
  product: string
  quantity: string
  progressLines: string[]
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
    progressLines: [''],
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
    progressLines: parseProgressLines(inquiry.note),
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
    note: serializeProgressLines(form.progressLines),
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
