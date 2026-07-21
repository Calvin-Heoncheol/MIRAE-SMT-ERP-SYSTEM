import { normalizePostProcessTeam } from '@/lib/post-process/teams'

export type NavChildItem = {
  label: string
  href: string
}

/** useSearchParams()의 ReadonlyURLSearchParams 호환 최소 타입 */
export type NavSearch = { get(name: string): string | null }

export type NavItem = {
  label: string
  href: string
  children?: NavChildItem[]
}

export const NAV_ITEMS: NavItem[] = [
  { label: '대시보드', href: '/' },
  {
    label: '영업관리',
    href: '/quotations',
    children: [
      { label: '신규업체', href: '/new-companies' },
      { label: '견적서', href: '/quotations' },
      { label: '주문서', href: '/orders' },
      { label: '출하', href: '/delivery' },
    ],
  },
  {
    label: '기초등록',
    href: '/master/customers',
    children: [
      { label: '거래처등록', href: '/master/customers' },
      { label: '품목등록', href: '/master/products' },
      { label: 'BOM등록', href: '/master/bom' },
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
  {
    label: '자재',
    href: '/materials/inventory',
    children: [
      { label: '재고현황', href: '/materials/inventory' },
      { label: '발주', href: '/materials/purchase-orders' },
      { label: '입고', href: '/materials/inbound' },
      { label: '불출', href: '/materials/outbound' },
    ],
  },
  {
    label: '생산',
    href: '/production/status',
    children: [
      { label: '주문별 현황', href: '/production/status' },
      { label: '생산1: SMT', href: '/smt' },
      { label: '생산2: 후공정', href: '/post-process?team=생산2팀' },
      { label: '생산3: 후공정', href: '/post-process?team=생산3팀' },
      { label: '생산4: 후공정', href: '/post-process?team=생산4팀' },
    ],
  },
  {
    label: '리포트',
    href: '/reports/production',
    children: [
      { label: '생산실적', href: '/reports/production' },
      { label: '영업/매출', href: '/reports/sales' },
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
