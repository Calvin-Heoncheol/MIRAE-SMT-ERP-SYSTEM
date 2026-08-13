import { canAccessPath } from '@/lib/auth/permissions'
import type { AuthDepartment, AuthRole } from '@/lib/auth/types'
import { normalizePostProcessTeam } from '@/lib/post-process/teams'
import { resolveProductionPlanTab } from '@/lib/production-plan/tabs'

export type NavChildItem = {
  label: string
  href: string
  /** true면 메뉴는 보이지만 접근 권한 없음 (클릭 시 /forbidden) */
  locked?: boolean
  children?: NavChildItem[]
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
      { label: '견적서 등록', href: '/quotations' },
      { label: '발주서 등록', href: '/orders' },
      { label: '출하등록', href: '/delivery/input' },
      { label: '출하현황', href: '/orders/status' },
      { label: '거래명세서', href: '/reports/sales' },
    ],
  },
  {
    label: '회계관리',
    href: '/accounting/receivables',
    children: [{ label: '수금현황', href: '/accounting/receivables' }],
  },
  {
    label: '생산관리',
    href: '/production/status',
    children: [
      { label: '생산현황', href: '/production/status' },
      { label: '생산이력', href: '/production/history' },
      {
        label: '생산1: SMT',
        href: '/smt/input',
        children: [
          { label: '생산등록', href: '/smt/input' },
          { label: '메탈마스크&스퀴즈', href: '/smt/metal-masks' },
        ],
      },
      {
        label: '생산2: 후공정',
        href: '/post-process/input?team=생산2팀',
        children: [
          { label: '생산등록', href: '/post-process/input?team=생산2팀' },
        ],
      },
      {
        label: '생산3: 후공정',
        href: '/post-process/input?team=생산3팀',
        children: [
          { label: '생산등록', href: '/post-process/input?team=생산3팀' },
        ],
      },
      {
        label: '생산4: 후공정',
        href: '/post-process/input?team=생산4팀',
        children: [
          { label: '생산등록', href: '/post-process/input?team=생산4팀' },
        ],
      },
    ],
  },
  {
    label: '자재관리',
    href: '/materials/inventory',
    children: [
      { label: '재고현황', href: '/materials/inventory' },
      { label: '구매발주', href: '/materials/purchase-orders' },
      { label: '입고', href: '/materials/inbound' },
      { label: '입고이력', href: '/materials/inbound/history' },
      { label: '불출', href: '/materials/outbound' },
    ],
  },
  {
    label: '품질관리',
    href: '/quality/defects',
    children: [{ label: '불량대처', href: '/quality/defects' }],
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

/** href를 경로와 쿼리로 분리 (예: /post-process?team=생산2팀) */
function splitNavHref(href: string): { path: string; team: string | null; tab: string | null } {
  const queryIndex = href.indexOf('?')
  if (queryIndex === -1) {
    return { path: href, team: null, tab: null }
  }
  const params = new URLSearchParams(href.slice(queryIndex + 1))
  return {
    path: href.slice(0, queryIndex),
    team: params.get('team'),
    tab: params.get('tab'),
  }
}

function navSearchFromHref(href: string): NavSearch | null {
  const { team, tab } = splitNavHref(href)
  if (!team && !tab) return null
  return {
    get: (name: string) => {
      if (name === 'team') return team
      if (name === 'tab') return tab
      return null
    },
  }
}

function canAccessNavHref(
  profile: { role: AuthRole; department: AuthDepartment | null },
  href: string,
) {
  const { path } = splitNavHref(href)
  return canAccessPath(profile, path, navSearchFromHref(href))
}

function matchesNavQuery(href: string, search?: NavSearch | null) {
  const { path, team, tab } = splitNavHref(href)
  if (team) {
    const current = String(search?.get('team') || '').trim()
    if (current) {
      // 생산이력 `생산1팀` 등을 후공정 normalize로 바꾸면 생산2팀 메뉴가 잘못 활성됨
      if (current !== team) return false
    } else if (path.startsWith('/post-process')) {
      // 후공정은 team 생략 시 기본 팀(생산2팀)으로 간주
      if (normalizePostProcessTeam(null) !== team) return false
    } else {
      return false
    }
  }
  if (tab && resolveProductionPlanTab(search?.get('tab')) !== resolveProductionPlanTab(tab)) {
    return false
  }
  return true
}

export function isNavLinkActive(pathname: string, href: string, search?: NavSearch | null) {
  const { path } = splitNavHref(href)
  if (path === '/') {
    return pathname === '/' && matchesNavQuery(href, search)
  }
  const pathActive = pathname === path || pathname.startsWith(`${path}/`)
  return pathActive && matchesNavQuery(href, search)
}

const NAV_EXACT_CHILD_PATHS = [
  '/orders',
  '/quotations',
  '/master/customers',
  '/materials/inventory',
  '/materials/product-inventory',
  '/materials/inbound',
] as const

export function isNavChildActive(pathname: string, href: string, search?: NavSearch | null) {
  if (NAV_EXACT_CHILD_PATHS.includes(href as (typeof NAV_EXACT_CHILD_PATHS)[number])) {
    return pathname === href
  }
  // 메탈마스크·스퀴즈는 동일 메뉴로 취급
  if (href === '/smt/metal-masks') {
    return pathname === '/smt/metal-masks' || pathname.startsWith('/smt/metal-masks/')
      || pathname === '/smt/squeegees' || pathname.startsWith('/smt/squeegees/')
  }
  return isNavLinkActive(pathname, href, search)
}

export function isNavChildItemActive(
  pathname: string,
  child: NavChildItem,
  search?: NavSearch | null,
) {
  if (child.children?.length) {
    return child.children.some((grandchild) =>
      isNavChildActive(pathname, grandchild.href, search),
    )
  }
  return isNavChildActive(pathname, child.href, search)
}

export function isNavItemActive(pathname: string, item: NavItem, search?: NavSearch | null) {
  if (item.children?.length) {
    return item.children.some((child) => isNavChildItemActive(pathname, child, search))
  }
  return isNavLinkActive(pathname, item.href, search)
}

function mapVisibleNavChild(
  profile: { role: AuthRole; department: AuthDepartment | null },
  child: NavChildItem,
): NavChildItem | null {
  if (child.children?.length) {
    const children = child.children
      .filter((grandchild) => canAccessNavHref(profile, grandchild.href))
      .map((grandchild) => ({ ...grandchild, locked: false }))

    if (!children.length) return null

    return {
      ...child,
      href: children[0]?.href ?? child.href,
      locked: false,
      children,
    }
  }

  if (!canAccessNavHref(profile, child.href)) return null
  return { ...child, locked: false }
}

/**
 * 사이드바용 — 권한 없는 메뉴는 숨김.
 * ERP 관리(adminOnly)는 비관리자에게 숨김.
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
      if (!canAccessNavHref(profile, item.href)) continue
      visible.push({ ...item, locked: false })
      continue
    }

    const children = item.children
      .map((child) => mapVisibleNavChild(profile, child))
      .filter((child): child is NavChildItem => child != null)

    if (!children.length) continue

    const parentAccessible = canAccessNavHref(profile, item.href)
    const parentHref = parentAccessible
      ? item.href
      : (children[0]?.href ?? item.href)

    visible.push({
      ...item,
      href: parentHref,
      locked: false,
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
 * 현재 경로의 사이드바 메뉴 기준 위치 (예: 생산관리 / 생산실적).
 * 하위 경로도 가장 긴 매칭 메뉴로 해석합니다.
 */
export function resolveNavBreadcrumb(
  pathname: string,
  search?: NavSearch | null,
): NavBreadcrumb | null {
  let best: { section: string; page: string; score: number } | null = null

  for (const item of NAV_ITEMS) {
    if (!item.children?.length) {
      const { path } = splitNavHref(item.href)
      if (path === '/') {
        if (pathname === '/') {
          return { section: item.label, page: '오늘 현황' }
        }
        continue
      }
      if (pathname === path || pathname.startsWith(`${path}/`)) {
        const score = path.length
        if (!best || score > best.score) {
          best = { section: item.label, page: item.label, score }
        }
      }
      continue
    }

    for (const child of item.children) {
      if (child.children?.length) {
        for (const grandchild of child.children) {
          if (!matchesNavQuery(grandchild.href, search)) continue
          if (!isNavChildActive(pathname, grandchild.href, search)) continue

          const { path } = splitNavHref(grandchild.href)
          const score = path.length + 100
          if (!best || score > best.score) {
            best = {
              section: item.label,
              page: `${child.label} · ${grandchild.label}`,
              score,
            }
          }
        }
        continue
      }

      const { path } = splitNavHref(child.href)
      if (!matchesNavQuery(child.href, search)) continue

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
