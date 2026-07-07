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
    label: '품의서',
    href: '/approvals/raw-materials',
    children: [
      { label: '원자재', href: '/approvals/raw-materials' },
      { label: '부자재', href: '/approvals/sub-materials' },
      { label: '장비', href: '/approvals/equipment' },
      { label: '설비', href: '/approvals/facilities' },
      { label: '기타', href: '/approvals/misc' },
    ],
  },
  {
    label: '주문',
    href: '/orders',
    children: [{ label: '주문서 목록', href: '/orders' }],
  },
  {
    label: '자재',
    href: '/materials',
    children: [
      { label: '자재목록', href: '/materials' },
      { label: '재고현황', href: '/materials/inventory' },
      { label: '발주', href: '/materials/purchase-orders' },
    ],
  },
  {
    label: '생산',
    href: '/production/status',
    children: [
      { label: '생산현황', href: '/production/status' },
      { label: 'SMT', href: '/smt' },
      { label: '후공정', href: '/post-process' },
      { label: '출하', href: '/delivery' },
    ],
  },
]

export function isNavLinkActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

const NAV_EXACT_CHILD_PATHS = ['/orders', '/materials'] as const

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
