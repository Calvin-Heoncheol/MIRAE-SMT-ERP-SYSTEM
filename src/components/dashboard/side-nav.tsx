'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { SideNavUserMenu } from '@/components/auth/side-nav-user-menu'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import { APP_SHORT_NAME } from '@/lib/app-config'
import type { AuthDepartment, AuthProfile } from '@/lib/auth/types'
import {
  getVisibleNavItems,
  isNavChildActive,
  isNavChildItemActive,
  isNavItemActive,
  isNavLinkActive,
  type NavChildItem,
  type NavItem,
  type NavSearch,
} from '@/lib/navigation'

type SideNavProps = {
  profile?: AuthProfile | null
  authDisabled?: boolean
}

/** 생산팀 사용자는 본인 팀 하위 메뉴만 기본 펼침 */
function shouldExpandMyProductionTeam(
  label: string,
  department: AuthDepartment | null | undefined,
) {
  if (!department) return false
  if (department === 'production1') return label.includes('생산1')
  if (department === 'production2') return label.includes('생산2')
  if (department === 'production3') return label.includes('생산3')
  if (department === 'production4') return label.includes('생산4')
  return false
}

function shouldExpandProductionSection(
  label: string,
  department: AuthDepartment | null | undefined,
) {
  if (label !== '생산관리' || !department) return false
  return (
    department === 'production1' ||
    department === 'production2' ||
    department === 'production3' ||
    department === 'production4' ||
    department === 'quality'
  )
}

function shouldExpandQualitySection(
  label: string,
  department: AuthDepartment | null | undefined,
) {
  return label === '품질관리' && department === 'quality'
}

function NavIcon({
  children,
  className = 'h-4 w-4 shrink-0',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

function NavSectionIcon({ href }: { href: string }) {
  const iconClass = 'h-4 w-4 shrink-0 opacity-80'

  if (href === '/') {
    return (
      <NavIcon className={iconClass}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 10.5 12 4l8 6.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 9.5V20h11V9.5" />
      </NavIcon>
    )
  }
  if (href.startsWith('/master')) {
    return (
      <NavIcon className={iconClass}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.2.6.7 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
        />
      </NavIcon>
    )
  }
  if (href.startsWith('/quotations') || href.startsWith('/orders') || href.startsWith('/new-companies')) {
    return (
      <NavIcon className={iconClass}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 19.5V6.8A1.8 1.8 0 0 1 5.8 5h4.4L12 7h6.2A1.8 1.8 0 0 1 20 8.8v10.7A1.8 1.8 0 0 1 18.2 21H5.8A1.8 1.8 0 0 1 4 19.5Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 13h8M8 16.5h5" />
      </NavIcon>
    )
  }
  if (href.startsWith('/production') || href.startsWith('/smt') || href.startsWith('/post-process')) {
    return (
      <NavIcon className={iconClass}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 20h16M6 20V10l4 2V10l4 2V8l4 2v10"
        />
      </NavIcon>
    )
  }
  if (href.startsWith('/materials')) {
    return (
      <NavIcon className={iconClass}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.5 12 3.5 3 8.5v7l9 5 9-5v-7Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.5 3 8.5M12 12.5l9-4M12 12.5V20.5" />
      </NavIcon>
    )
  }
  if (href.startsWith('/quality')) {
    return (
      <NavIcon className={iconClass}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.5 11 14.5 15.5 10"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3.5 19.5 7v5.2c0 4.2-2.9 7.9-7.5 9.3C7.4 20.1 4.5 16.4 4.5 12.2V7L12 3.5Z"
        />
      </NavIcon>
    )
  }
  if (href.startsWith('/approvals') || href.startsWith('/expense') || href.startsWith('/leave')) {
    return (
      <NavIcon className={iconClass}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8 4h7l3 3v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 4v3h3M9 12h6M9 15.5h4" />
      </NavIcon>
    )
  }

  return (
    <NavIcon className={iconClass}>
      <circle cx="12" cy="12" r="7" />
    </NavIcon>
  )
}

function NavChildLink({
  child,
  pathname,
  search,
  onNavigate,
  nested = false,
}: {
  child: NavChildItem
  pathname: string
  search: NavSearch | null
  onNavigate?: () => void
  nested?: boolean
}) {
  const childActive = isNavChildActive(pathname, child.href, search)
  const { notifyForbidden } = useWriteFailureToast()

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (child.locked) {
      event.preventDefault()
      notifyForbidden(`「${child.label}」메뉴에 대한 접근 권한이 없습니다.`)
      return
    }
    onNavigate?.()
  }

  return (
    <Link
      href={child.locked ? '#' : child.href}
      onClick={handleClick}
      title={child.locked ? '접근 권한이 없습니다' : undefined}
      className={[
        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors',
        nested ? 'text-[12px]' : 'text-[13px]',
        child.locked
          ? 'cursor-not-allowed text-slate-400 hover:bg-slate-50'
          : childActive
            ? 'bg-blue-50 font-semibold text-blue-700'
            : nested
              ? 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
      ].join(' ')}
      aria-current={childActive && !child.locked ? 'page' : undefined}
      aria-disabled={child.locked || undefined}
    >
      <span className="min-w-0 flex-1 truncate">{child.label}</span>
      {child.locked ? (
        <span className="shrink-0 text-[10px] font-semibold text-slate-400">잠금</span>
      ) : null}
    </Link>
  )
}

function NavChildSection({
  child,
  pathname,
  search,
  department,
  onNavigate,
}: {
  child: NavChildItem
  pathname: string
  search: NavSearch | null
  department?: AuthDepartment | null
  onNavigate?: () => void
}) {
  const hasGrandchildren = Boolean(child.children?.length)
  const childActive = isNavChildItemActive(pathname, child, search)
  const preferMyTeam = shouldExpandMyProductionTeam(child.label, department)
  const [expanded, setExpanded] = useState(childActive || preferMyTeam)

  useEffect(() => {
    if (childActive) setExpanded(true)
  }, [childActive, pathname])

  if (!hasGrandchildren) {
    return (
      <NavChildLink
        child={child}
        pathname={pathname}
        search={search}
        onNavigate={onNavigate}
      />
    )
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className={[
          'flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[13px] font-semibold transition-colors',
          childActive ? 'text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800',
        ].join(' ')}
        aria-expanded={expanded}
      >
        <span className="min-w-0 truncate">{child.label}</span>
        <span className="shrink-0 pl-2 text-[10px] opacity-70">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded ? (
        <div className="space-y-0.5 pl-3">
          {child.children!.map((grandchild) => (
            <NavChildLink
              key={grandchild.href}
              child={grandchild}
              pathname={pathname}
              search={search}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function LockedAwareNavLink({
  href,
  locked,
  label,
  active,
  onNavigate,
  className,
  children,
}: {
  href: string
  locked: boolean
  label: string
  active: boolean
  onNavigate?: () => void
  className: string
  children: ReactNode
}) {
  const { notifyForbidden } = useWriteFailureToast()

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (locked) {
      event.preventDefault()
      notifyForbidden(`「${label}」메뉴에 대한 접근 권한이 없습니다.`)
      return
    }
    onNavigate?.()
  }

  return (
    <Link
      href={locked ? '#' : href}
      onClick={handleClick}
      title={locked ? '접근 권한이 없습니다' : undefined}
      className={className}
      aria-current={active && !locked ? 'page' : undefined}
      aria-disabled={locked || undefined}
    >
      {children}
    </Link>
  )
}

function NavSection({
  item,
  pathname,
  search,
  department,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  search: NavSearch | null
  department?: AuthDepartment | null
  onNavigate?: () => void
}) {
  const hasChildren = Boolean(item.children?.length)
  const sectionActive = hasChildren
    ? isNavItemActive(pathname, item, search)
    : isNavLinkActive(pathname, item.href, search)
  const preferOpen =
    sectionActive ||
    shouldExpandProductionSection(item.label, department) ||
    shouldExpandQualitySection(item.label, department)
  const [expanded, setExpanded] = useState(preferOpen)

  useEffect(() => {
    if (sectionActive) setExpanded(true)
  }, [sectionActive, pathname])

  if (!hasChildren) {
    return (
      <LockedAwareNavLink
        href={item.href}
        locked={Boolean(item.locked)}
        label={item.label}
        active={sectionActive}
        onNavigate={onNavigate}
        className={[
          'mb-0.5 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors',
          item.locked
            ? 'cursor-not-allowed text-slate-400 hover:bg-slate-50'
            : sectionActive
              ? 'bg-blue-50 text-blue-700'
              : 'text-slate-800 hover:bg-slate-50 hover:text-slate-900',
        ].join(' ')}
      >
        <NavSectionIcon href={item.href} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.locked ? (
          <span className="shrink-0 text-[10px] font-semibold text-slate-400">잠금</span>
        ) : null}
      </LockedAwareNavLink>
    )
  }

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className={[
          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors',
          sectionActive ? 'text-blue-700' : 'text-slate-800 hover:bg-slate-50 hover:text-slate-900',
        ].join(' ')}
        aria-expanded={expanded}
      >
        <NavSectionIcon href={item.href} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <span className="shrink-0 text-[10px] opacity-70">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded ? (
        <div className="mt-0.5 space-y-0.5 pl-3">
          {item.children!.map((child) => (
            <NavChildSection
              key={child.children?.length ? child.label : child.href}
              child={child}
              pathname={pathname}
              search={search}
              department={department}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SidebarBrand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-1"
      aria-label={`${APP_SHORT_NAME} 대시보드`}
    >
      <span className="relative h-9 w-[4.75rem] shrink-0">
        <Image
          src="/branding/logo.png"
          alt=""
          fill
          priority
          sizes="76px"
          className="object-contain object-left"
        />
      </span>
      <span className="min-w-0 truncate text-[15px] font-bold tracking-tight text-slate-900">
        {APP_SHORT_NAME}
      </span>
    </Link>
  )
}

function SidebarNavList({
  pathname,
  search,
  onNavigate,
  items,
  department,
}: {
  pathname: string
  search: NavSearch | null
  onNavigate?: () => void
  items: NavItem[]
  department?: AuthDepartment | null
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="주 메뉴">
      {items.map((item) => (
        <NavSection
          key={item.href}
          item={item}
          pathname={pathname}
          search={search}
          department={department}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  )
}

function SidebarNavListWithSearch({
  pathname,
  onNavigate,
  items,
  department,
}: {
  pathname: string
  onNavigate?: () => void
  items: NavItem[]
  department?: AuthDepartment | null
}) {
  const search = useSearchParams()
  return (
    <SidebarNavList
      pathname={pathname}
      search={search}
      onNavigate={onNavigate}
      items={items}
      department={department}
    />
  )
}

/** useSearchParams는 프리렌더 시 Suspense 경계가 필요 — 폴백은 쿼리 없이 렌더 */
function SidebarNavBody({
  pathname,
  onNavigate,
  profile,
  authDisabled,
}: {
  pathname: string
  onNavigate?: () => void
  profile?: AuthProfile | null
  authDisabled?: boolean
}) {
  const items = getVisibleNavItems({
    role: profile?.role,
    department: profile?.department,
    authDisabled,
  })

  return (
    <Suspense
      fallback={
        <SidebarNavList
          pathname={pathname}
          search={null}
          onNavigate={onNavigate}
          items={items}
          department={profile?.department}
        />
      }
    >
      <SidebarNavListWithSearch
        pathname={pathname}
        onNavigate={onNavigate}
        items={items}
        department={profile?.department}
      />
    </Suspense>
  )
}

function MobileDrawer({
  open,
  onClose,
  pathname,
  profile,
  authDisabled,
}: {
  open: boolean
  onClose: () => void
  pathname: string
  profile?: AuthProfile | null
  authDisabled?: boolean
}) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="메뉴 닫기"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 left-0 flex w-[min(17.5rem,86vw)] flex-col border-r border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3">
          <SidebarBrand onNavigate={onClose} />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <SidebarNavBody
          pathname={pathname}
          onNavigate={onClose}
          profile={profile}
          authDisabled={authDisabled}
        />
        <SideNavUserMenu profile={profile ?? null} authDisabled={authDisabled} />
      </aside>
    </div>
  )
}

export function SideNav({ profile = null, authDisabled = false }: SideNavProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <>
      {/* 모바일 상단 바 */}
      <header className="sticky top-0 z-50 flex h-14 items-center gap-3 border-b border-slate-200/90 bg-white/95 px-3 shadow-sm backdrop-blur-md lg:hidden">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          aria-label="메뉴 열기"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(true)}
        >
          <span className="flex flex-col gap-1" aria-hidden>
            <span className="block h-0.5 w-4 rounded bg-slate-700" />
            <span className="block h-0.5 w-4 rounded bg-slate-700" />
            <span className="block h-0.5 w-4 rounded bg-slate-700" />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <SidebarBrand />
        </div>
        <NotificationBell userId={profile?.id} variant="icon" />
      </header>

      {/* 데스크톱 사이드바 */}
      <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex xl:w-56">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3">
          <SidebarBrand />
          <NotificationBell userId={profile?.id} variant="icon" />
        </div>
        <SidebarNavBody pathname={pathname} profile={profile} authDisabled={authDisabled} />
        <SideNavUserMenu profile={profile} authDisabled={authDisabled} />
      </aside>

      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        pathname={pathname}
        profile={profile}
        authDisabled={authDisabled}
      />
    </>
  )
}
