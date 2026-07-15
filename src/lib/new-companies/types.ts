export type NewCompanyStatus =
  | 'received'
  | 'consulting'
  | 'quoting'
  | 'converted'
  | 'on_hold'
  | 'closed'

export const NEW_COMPANY_STATUSES: NewCompanyStatus[] = [
  'received',
  'consulting',
  'quoting',
  'converted',
  'on_hold',
  'closed',
]

export const NEW_COMPANY_STATUS_LABELS: Record<NewCompanyStatus, string> = {
  received: '접수',
  consulting: '상담중',
  quoting: '견적중',
  converted: '거래전환',
  on_hold: '보류',
  closed: '종료',
}

/** 뱃지/칩 색 — 모듈 악센트와 별개로 상태만 구분 */
export const NEW_COMPANY_STATUS_BADGE_CLASS: Record<NewCompanyStatus, string> = {
  received: 'bg-slate-100 text-slate-700 ring-slate-200',
  consulting: 'bg-sky-50 text-sky-800 ring-sky-200',
  quoting: 'bg-violet-50 text-violet-800 ring-violet-200',
  converted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  on_hold: 'bg-amber-50 text-amber-800 ring-amber-200',
  closed: 'bg-rose-50 text-rose-700 ring-rose-200',
}

export type NewCompanyInquiry = {
  id: string
  contactName: string
  companyName: string
  email: string
  phone: string
  product: string
  quantity: number | null
  note: string
  status: NewCompanyStatus
  createdAt: string
  updatedAt: string
}

export type NewCompanyInquiryPayload = {
  contactName: string
  companyName: string
  email: string
  phone: string
  product: string
  quantity: number | null
  note: string
  status: NewCompanyStatus
}

export function isNewCompanyStatus(value: string): value is NewCompanyStatus {
  return (NEW_COMPANY_STATUSES as string[]).includes(value)
}
