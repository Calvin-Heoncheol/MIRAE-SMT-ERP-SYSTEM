export const AUTH_ROLES = ['admin', 'manager', 'operator'] as const
export type AuthRole = (typeof AUTH_ROLES)[number]

export const AUTH_DEPARTMENTS = [
  'sales',
  'materials',
  'production1',
  'production2',
  'production3',
  'production4',
  'office',
] as const
export type AuthDepartment = (typeof AUTH_DEPARTMENTS)[number]

export type AuthProfile = {
  id: string
  email: string
  displayName: string
  role: AuthRole
  department: AuthDepartment | null
}

export function normalizeAuthRole(value: string | null | undefined): AuthRole {
  if (value === 'admin') return 'admin'
  if (value === 'manager') return 'manager'
  // 레거시 'user' 포함
  return 'operator'
}

export function formatAuthRoleLabel(role: AuthRole) {
  if (role === 'admin') return '관리자'
  if (role === 'manager') return '팀장'
  return '작업자'
}

export function isAuthDepartment(value: string | null | undefined): value is AuthDepartment {
  return (AUTH_DEPARTMENTS as readonly string[]).includes(String(value || ''))
}

export function normalizeAuthDepartment(value: string | null | undefined): AuthDepartment | null {
  const raw = String(value || '').trim()
  return isAuthDepartment(raw) ? raw : null
}

export function formatAuthDepartmentLabel(department: AuthDepartment | null) {
  if (!department) return '미지정'
  const labels: Record<AuthDepartment, string> = {
    sales: '영업',
    materials: '자재',
    production1: '생산1팀',
    production2: '생산2팀',
    production3: '생산3팀',
    production4: '생산4팀',
    office: '관리',
  }
  return labels[department]
}
