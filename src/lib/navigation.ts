export type NavChildItem = {
  label: string
  href: string
}

export type NavItem = {
  label: string
  href: string
  children?: NavChildItem[]
}

export const NAV_ITEMS: NavItem[] = [
  { label: '홈', href: '/' },
  { label: '견적', href: '/quotations' },
  {
    label: '주문',
    href: '/orders',
    children: [
      { label: '주문서 목록', href: '/orders' },
      { label: '주문서 현황', href: '/orders/status' },
    ],
  },
  {
    label: '자재',
    href: '/materials',
    children: [
      { label: '자재목록', href: '/materials' },
      { label: '발주', href: '/materials/purchase-orders' },
      { label: '입고', href: '/materials/inbound' },
      { label: '불출', href: '/materials/outbound' },
    ],
  },
  { label: 'SMT', href: '/smt' },
  {
    label: '후공정',
    href: '/post-process',
    children: [
      { label: '생산입력', href: '/post-process/input' },
      { label: '생산이력', href: '/post-process/history' },
      { label: '생산 스케줄', href: '/post-process/schedule' },
    ],
  },
  { label: '납품출하', href: '/delivery' },
]

export function isNavLinkActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

const NAV_EXACT_CHILD_PATHS = ['/orders', '/materials', '/post-process'] as const

export function isNavChildActive(pathname: string, href: string) {
  if (NAV_EXACT_CHILD_PATHS.includes(href as (typeof NAV_EXACT_CHILD_PATHS)[number])) {
    return pathname === href
  }
  return isNavLinkActive(pathname, href)
}

export function isNavItemActive(pathname: string, item: NavItem) {
  if (item.children?.length) {
    return item.children.some((child) => isNavChildActive(pathname, child.href))
  }
  return isNavLinkActive(pathname, item.href)
}
