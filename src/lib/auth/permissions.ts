import type { AuthDepartment, AuthProfile, AuthRole } from '@/lib/auth/types'

/** 권한 검사에 쓰는 기능 영역 */
export type AuthAccessModule =
  | 'dashboard'
  | 'sales'
  | 'master'
  | 'approvals'
  | 'materials'
  | 'production_smt'
  | 'production_post_2'
  | 'production_post_3'
  | 'production_post_4'
  | 'production_history'
  | 'reports_production'
  | 'reports_sales'

const DEPARTMENT_MODULES: Record<AuthDepartment, AuthAccessModule[]> = {
  sales: ['dashboard', 'sales', 'approvals', 'reports_sales'],
  materials: ['dashboard', 'materials', 'approvals'],
  production1: ['dashboard', 'production_smt', 'production_history', 'approvals'],
  production2: ['dashboard', 'production_post_2', 'production_history', 'approvals'],
  production3: ['dashboard', 'production_post_3', 'production_history', 'approvals'],
  production4: ['dashboard', 'production_post_4', 'production_history', 'approvals'],
  office: ['dashboard', 'approvals', 'reports_production', 'reports_sales'],
}

/** 관리자 전용 모듈 — 부서와 무관하게 admin만 */
const ADMIN_ONLY_MODULES: AuthAccessModule[] = ['master']

const ALL_MODULES: AuthAccessModule[] = [
  'dashboard',
  'sales',
  'master',
  'approvals',
  'materials',
  'production_smt',
  'production_post_2',
  'production_post_3',
  'production_post_4',
  'production_history',
  'reports_production',
  'reports_sales',
]

export function resolveAccessModule(
  pathname: string,
  searchParams?: { get(name: string): string | null } | null,
): AuthAccessModule | null {
  if (pathname === '/') return 'dashboard'
  if (
    pathname.startsWith('/new-companies') ||
    pathname.startsWith('/quotations') ||
    pathname.startsWith('/orders') ||
    pathname.startsWith('/production/status') ||
    pathname.startsWith('/delivery')
  ) {
    return 'sales'
  }
  if (pathname.startsWith('/master')) return 'master'
  if (
    pathname.startsWith('/approvals') ||
    pathname.startsWith('/expense-reports') ||
    pathname.startsWith('/leave-requests')
  ) {
    return 'approvals'
  }
  if (pathname.startsWith('/materials')) return 'materials'
  if (pathname.startsWith('/smt')) return 'production_smt'
  if (pathname.startsWith('/post-process')) {
    const team = searchParams?.get('team') || ''
    if (team === '생산3팀') return 'production_post_3'
    if (team === '생산4팀') return 'production_post_4'
    return 'production_post_2'
  }
  if (pathname.startsWith('/production/history')) return 'production_history'
  if (pathname.startsWith('/reports/production')) return 'reports_production'
  if (pathname.startsWith('/reports/sales')) return 'reports_sales'
  return null
}

export function getAllowedModules(input: {
  role: AuthRole
  department: AuthDepartment | null
}): AuthAccessModule[] {
  if (input.role === 'admin') return ALL_MODULES

  const withoutAdminOnly = (modules: AuthAccessModule[]) =>
    modules.filter((module) => !ADMIN_ONLY_MODULES.includes(module))

  // 부서 미지정: 과도기 — 관리자 전용 제외한 전체
  if (!input.department) return withoutAdminOnly(ALL_MODULES)
  return withoutAdminOnly(DEPARTMENT_MODULES[input.department])
}

export function canAccessPath(
  profile: Pick<AuthProfile, 'role' | 'department'> | null | undefined,
  pathname: string,
  searchParams?: { get(name: string): string | null } | null,
) {
  // 로그인·권한없음 페이지는 항상 허용
  if (pathname === '/login' || pathname.startsWith('/login/')) return true
  if (pathname === '/forbidden' || pathname.startsWith('/forbidden/')) return true

  if (!profile) return false

  const accessModule = resolveAccessModule(pathname, searchParams)
  // 매핑 안 된 경로·관리자 전용 모듈은 admin만
  if (!accessModule) return profile.role === 'admin'
  if (ADMIN_ONLY_MODULES.includes(accessModule)) return profile.role === 'admin'

  return getAllowedModules(profile).includes(accessModule)
}
