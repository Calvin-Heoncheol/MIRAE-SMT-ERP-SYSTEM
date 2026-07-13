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
  {
    label: '영업관리',
    href: '/quotations',
    children: [
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
      { label: '출고', href: '/materials/outbound' },
    ],
  },
  {
    label: '생산',
    href: '/production/status',
    children: [
      { label: '생산현황', href: '/production/status' },
      { label: 'SMT', href: '/smt' },
      { label: '후공정', href: '/post-process' },
    ],
  },
]

export function isNavLinkActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/'
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

const NAV_EXACT_CHILD_PATHS = [
  '/orders',
  '/quotations',
  '/master/customers',
  '/materials/inventory',
] as const

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
