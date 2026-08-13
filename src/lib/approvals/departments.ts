export const APPROVAL_DEPARTMENTS = [
  { value: '관리부', label: '관리부' },
  { value: '구매자재', label: '구매자재' },
  { value: '생산1팀', label: '생산1팀' },
  { value: '생산2팀', label: '생산2팀' },
  { value: '생산3팀', label: '생산3팀' },
  { value: '생산4팀', label: '생산4팀' },
  { value: '품질관리', label: '품질관리' },
] as const

export type ApprovalDepartment = (typeof APPROVAL_DEPARTMENTS)[number]['value']

export const DEFAULT_APPROVAL_DEPARTMENT: ApprovalDepartment = '관리부'

const DEPARTMENT_BY_VALUE = new Map(APPROVAL_DEPARTMENTS.map((item) => [item.value, item]))

export function isApprovalDepartment(value: string): value is ApprovalDepartment {
  return DEPARTMENT_BY_VALUE.has(value as ApprovalDepartment)
}

export function normalizeApprovalDepartment(value: string) {
  const trimmed = value.trim()
  if (trimmed === '영업' || trimmed === '영업부') return DEFAULT_APPROVAL_DEPARTMENT
  if (isApprovalDepartment(trimmed)) return trimmed

  const byLabel = APPROVAL_DEPARTMENTS.find((item) => item.label === trimmed)
  if (byLabel) return byLabel.value

  return DEFAULT_APPROVAL_DEPARTMENT
}
