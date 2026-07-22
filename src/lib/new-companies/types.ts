export type NewCompanyStatus = 'received' | 'in_progress' | 'converted' | 'closed'

export const NEW_COMPANY_STATUSES: NewCompanyStatus[] = [
  'received',
  'in_progress',
  'converted',
  'closed',
]

export const NEW_COMPANY_STATUS_LABELS: Record<NewCompanyStatus, string> = {
  received: '문의',
  in_progress: '진행중',
  converted: '거래전환',
  closed: '종료',
}

/** 뱃지/칩 색 — 모듈 악센트와 별개로 상태만 구분 */
export const NEW_COMPANY_STATUS_BADGE_CLASS: Record<NewCompanyStatus, string> = {
  received: 'bg-slate-100 text-slate-700 ring-slate-200',
  in_progress: 'bg-sky-50 text-sky-800 ring-sky-200',
  converted: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  closed: 'bg-rose-50 text-rose-700 ring-rose-200',
}

/** 구 상태값 → 신규 4단계 */
export function normalizeNewCompanyStatus(value: string | null | undefined): NewCompanyStatus {
  const raw = String(value || 'received').toLowerCase().trim()
  if (raw === 'in_progress' || raw === 'consulting' || raw === 'quoting') return 'in_progress'
  if (raw === 'converted') return 'converted'
  if (raw === 'closed' || raw === 'on_hold') return 'closed'
  if (raw === 'received') return 'received'
  return 'received'
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
  /** 유입경로 (홈페이지, 소개, 박람회 등) */
  sourceChannel: string
  /** 종료 사유 (상태=closed) */
  closeReason: string
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
  sourceChannel: string
  closeReason: string
}

export function isNewCompanyStatus(value: string): value is NewCompanyStatus {
  return (NEW_COMPANY_STATUSES as string[]).includes(value)
}
