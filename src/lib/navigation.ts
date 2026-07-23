import { canAccessPath } from '@/lib/auth/permissions'
import type { AuthDepartment, AuthRole } from '@/lib/auth/types'
import { normalizePostProcessTeam } from '@/lib/post-process/teams'

export type NavChildItem = {
  label: string
  href: string
  /** true면 메뉴는 보이지만 접근 권한 없음 (클릭 시 /forbidden) */
  locked?: boolean
}

/** useSearchParams()의 ReadonlyURLSearchParams 호환 최소 타입 */
export type NavSearch = { get(name: string): string | null }

export type NavItem = {
  label: string
  href: string
  children?: NavChildItem[]
  /** true면 admin만 사이드바에 표시(잠금 없이 숨김) — 기초등록·사용자 */
  adminOnly?: boolean
  locked?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: '대시보드',
    href: '/',
    children: [
      { label: 'KPI', href: '/' },
      { label: '주문별 현황', href: '/production/status' },
      { label: '생산실적', href: '/reports/production' },
      { label: '영업/매출', href: '/reports/sales' },
    ],
  },
  {
    label: 'ERP 관리',
    href: '/master/customers',
    adminOnly: true,
    children: [
      { label: '거래처등록', href: '/master/customers' },
      { label: '품목등록', href: '/master/products' },
      { label: 'BOM등록', href: '/master/bom' },
      { label: '사용자등록', href: '/master/users' },
    ],
  },
  {
    label: '영업관리',
    href: '/quotations',
    children: [
      { label: '문의업체', href: '/new-companies' },
      { label: '견적서', href: '/quotations' },
      { label: '주문서', href: '/orders' },
      { label: '출하', href: '/delivery/input' },
      { label: '출하이력', href: '/delivery/history' },
    ],
  },
  {
    label: '생산관리',
    href: '/smt',
    children: [
      { label: '생산1: SMT', href: '/smt' },
      { label: '생산2: 후공정', href: '/post-process?team=생산2팀' },
      { label: '생산3: 후공정', href: '/post-process?team=생산3팀' },
      { label: '생산4: 후공정', href: '/post-process?team=생산4팀' },
      { label: '생산이력', href: '/production/history' },
    ],
  },
  {
    label: '자재관리',
    href: '/materials/inventory',
    children: [
      { label: '재고현황', href: '/materials/inventory' },
      { label: '제품재고', href: '/materials/product-inventory' },
      { label: '발주', href: '/materials/purchase-orders' },
      { label: '입고', href: '/materials/inbound' },
      { label: '불출', href: '/materials/outbound' },
    ],
  },
  {
    label: '결재서',
    href: '/approvals',
    children: [
      { label: '품의서', href: '/approvals' },
      { label: '지출결의서', href: '/expense-reports' },
      { label: '휴가원', href: '/leave-requests' },
    ],
  },
]

/** href를 경로와 team 쿼리로 분리 (예: /post-process?team=생산2팀) */
function splitNavHref(href: string): { path: string; team: string | null } {
  const queryIndex = href.indexOf('?')
  if (queryIndex === -1) {
    return { path: href, team: null }
  }
  return {
    path: href.slice(0, queryIndex),
    team: new URLSearchParams(href.slice(queryIndex + 1)).get('team'),
  }
}

function navSearchFromHref(href: string): NavSearch | null {
  const { team } = splitNavHref(href)
  if (!team) return null
  return { get: (name: string) => (name === 'team' ? team : null) }
}

function canAccessNavHref(
  profile: { role: AuthRole; department: AuthDepartment | null },
  href: string,
) {
  const { path } = splitNavHref(href)
  return canAccessPath(profile, path, navSearchFromHref(href))
}

function matchesNavTeam(team: string | null, search?: NavSearch | null) {
  if (!team) return true
  return normalizePostProcessTeam(search?.get('team')) === team
}

export function isNavLinkActive(pathname: string, href: string, search?: NavSearch | null) {
  const { path, team } = splitNavHref(href)
  if (path === '/') {
    return pathname === '/' && matchesNavTeam(team, search)
  }
  const pathActive = pathname === path || pathname.startsWith(`${path}/`)
  return pathActive && matchesNavTeam(team, search)
}

const NAV_EXACT_CHILD_PATHS = [
  '/orders',
  '/quotations',
  '/master/customers',
  '/materials/inventory',
  '/materials/product-inventory',
] as const

export function isNavChildActive(pathname: string, href: string, search?: NavSearch | null) {
  if (NAV_EXACT_CHILD_PATHS.includes(href as (typeof NAV_EXACT_CHILD_PATHS)[number])) {
    return pathname === href
  }
  return isNavLinkActive(pathname, href, search)
}

export function isNavItemActive(pathname: string, item: NavItem, search?: NavSearch | null) {
  if (item.children?.length) {
    return item.children.some((child) => isNavChildActive(pathname, child.href, search))
  }
  return isNavLinkActive(pathname, item.href, search)
}

/**
 * 사이드바용 — 메뉴는 모두 보이되, 권한 없는 항목은 locked.
 * ERP 관리(adminOnly)만 비관리자에게 숨김.
 * 인증 꺼짐(개발)이면 전체 노출.
 */
export function getVisibleNavItems(options: {
  role?: AuthRole | null
  department?: AuthDepartment | null
  authDisabled?: boolean
}) {
  if (options.authDisabled) return NAV_ITEMS

  const profile = {
    role: options.role ?? 'operator',
    department: options.department ?? null,
  }

  const visible: NavItem[] = []

  for (const item of NAV_ITEMS) {
    if (item.adminOnly && profile.role !== 'admin') continue

    if (!item.children?.length) {
      visible.push({
        ...item,
        locked: !canAccessNavHref(profile, item.href),
      })
      continue
    }

    const children = item.children.map((child) => ({
      ...child,
      locked: !canAccessNavHref(profile, child.href),
    }))

    const parentLocked = !canAccessNavHref(profile, item.href)
    const firstUnlocked = children.find((child) => !child.locked)
    const parentHref = parentLocked
      ? (firstUnlocked?.href ?? item.href)
      : item.href

    visible.push({
      ...item,
      href: parentHref,
      locked: parentLocked && !firstUnlocked,
      children,
    })
  }

  return visible
}

export type NavBreadcrumb = {
  section: string
  page: string
}

/**
 * 현재 경로의 사이드바 메뉴 기준 위치 (예: 대시보드 / 생산실적).
 * 하위 경로도 가장 긴 매칭 메뉴로 해석합니다.
 */
export function resolveNavBreadcrumb(
  pathname: string,
  search?: NavSearch | null,
): NavBreadcrumb | null {
  let best: { section: string; page: string; score: number } | null = null

  for (const item of NAV_ITEMS) {
    if (!item.children?.length) continue

    for (const child of item.children) {
      const { path, team } = splitNavHref(child.href)
      if (!matchesNavTeam(team, search)) continue

      let matches = false
      let score = 0
      if (path === '/') {
        matches = pathname === '/'
        score = 1
      } else if (pathname === path || pathname.startsWith(`${path}/`)) {
        matches = true
        score = path.length
      }

      if (!matches) continue
      if (!best || score > best.score) {
        best = { section: item.label, page: child.label, score }
      }
    }
  }

  return best ? { section: best.section, page: best.page } : null
}
