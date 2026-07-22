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

/** 유입경로 — 저장값과 라벨이 동일(한글) */
export const NEW_COMPANY_SOURCE_CHANNELS = [
  '웹사이트',
  '블로그',
  '지인소개',
  '박람회',
  '기타',
] as const

export type NewCompanySourceChannel = (typeof NEW_COMPANY_SOURCE_CHANNELS)[number]

export const NEW_COMPANY_SOURCE_CHANNEL_LABELS: Record<NewCompanySourceChannel, string> = {
  웹사이트: '웹사이트',
  블로그: '블로그',
  지인소개: '지인소개',
  박람회: '박람회',
  기타: '기타',
}

export function isNewCompanySourceChannel(value: string): value is NewCompanySourceChannel {
  return (NEW_COMPANY_SOURCE_CHANNELS as readonly string[]).includes(value)
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

/**
 * DB 저장용 상태값.
 * 구 CHECK(`consulting`/`quoting`…)만 있는 DB는 `in_progress`를 거부하거나
 * 구 트리거가 `in_progress`를 `received`로 바꿔 버림.
 * `consulting`으로 쓰면 구 스키마에서도 저장되고,
 * 신 스키마는 BEFORE 트리거가 `consulting` → `in_progress`로 정규화함.
 */
export function toDbNewCompanyStatus(status: NewCompanyStatus): string {
  if (status === 'in_progress') return 'consulting'
  return status
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
  /** 유입경로 (웹사이트, 블로그, 지인소개, 박람회, 기타) */
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
