import type { ApprovalDetailItem } from './types'

export const APPROVAL_CATEGORIES = [
  { slug: 'raw-materials', label: '원자재', href: '/approvals/raw-materials' },
  { slug: 'sub-materials', label: '부자재', href: '/approvals/sub-materials' },
  { slug: 'equipment', label: '장비', href: '/approvals/equipment' },
  { slug: 'facilities', label: '설비', href: '/approvals/facilities' },
  { slug: 'misc', label: '기타', href: '/approvals/misc' },
] as const

export type ApprovalCategory = (typeof APPROVAL_CATEGORIES)[number]['slug']

export const DEFAULT_APPROVAL_CATEGORY: ApprovalCategory = 'raw-materials'

export function isApprovalCategory(value: string): value is ApprovalCategory {
  return APPROVAL_CATEGORIES.some((category) => category.slug === value)
}

export function getApprovalCategory(slug: string) {
  return APPROVAL_CATEGORIES.find((category) => category.slug === slug)
}

export function getApprovalCategoryLabel(slug: ApprovalCategory) {
  return getApprovalCategory(slug)?.label ?? slug
}

export type ApprovalDetailColumn = {
  key: keyof ApprovalDetailItem
  label: string
  computed?: boolean
}

const APPROVAL_DETAIL_COLUMNS: ApprovalDetailColumn[] = [
  { key: 'name', label: '품명' },
  { key: 'model', label: '규격/모델' },
  { key: 'qty', label: '수량' },
  { key: 'unitPrice', label: '단가' },
  { key: 'amount', label: '합계금액', computed: true },
  { key: 'note', label: '비고' },
]

export function getApprovalDetailColumns(_category: ApprovalCategory): ApprovalDetailColumn[] {
  return APPROVAL_DETAIL_COLUMNS
}
