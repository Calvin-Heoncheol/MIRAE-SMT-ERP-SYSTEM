'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { SideNavUserMenu } from '@/components/auth/side-nav-user-menu'
import { APP_SHORT_NAME } from '@/lib/app-config'
import type { AuthProfile } from '@/lib/auth/types'
import {
  getVisibleNavItems,
  isNavChildActive,
  isNavItemActive,
  isNavLinkActive,
  type NavItem,
  type NavSearch,
} from '@/lib/navigation'

type SideNavProps = {
  profile?: AuthProfile | null
  authDisabled?: boolean
}

function NavSection({
  item,
  pathname,
  search,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  search: NavSearch | null
  onNavigate?: () => void
}) {
  const hasChildren = Boolean(item.children?.length)
  const sectionActive = hasChildren
    ? isNavItemActive(pathname, item, search)
    : isNavLinkActive(pathname, item.href, search)
  const [expanded, setExpanded] = useState(sectionActive)

  useEffect(() => {
    if (sectionActive) setExpanded(true)
  }, [sectionActive, pathname])

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={[
          'mb-0.5 flex items-center rounded-lg px-3 py-2.5 text-sm font-bold transition-colors',
          sectionActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-800 hover:bg-slate-50 hover:text-slate-900',
        ].join(' ')}
        aria-current={sectionActive ? 'page' : undefined}
      >
        {item.label}
      </Link>
    )
  }

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className={[
          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-bold transition-colors',
          sectionActive ? 'text-blue-700' : 'text-slate-800 hover:bg-slate-50 hover:text-slate-900',
        ].join(' ')}
        aria-expanded={expanded}
      >
        <span>{item.label}</span>
        <span className="text-[10px] opacity-70">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded ? (
        <div className="mt-0.5 space-y-0.5 pl-3">
          {item.children!.map((child) => {
            const childActive = isNavChildActive(pathname, child.href, search)
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={[
                  'block rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                  childActive
                    ? 'bg-blue-50 font-semibold text-blue-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                ].join(' ')}
                aria-current={childActive ? 'page' : undefined}
              >
                {child.label}
              </Link>
            )
          })}
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
}: {
  pathname: string
  search: NavSearch | null
  onNavigate?: () => void
  items: NavItem[]
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="주 메뉴">
      {items.map((item) => (
        <NavSection
          key={item.href}
          item={item}
          pathname={pathname}
          search={search}
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
}: {
  pathname: string
  onNavigate?: () => void
  items: NavItem[]
}) {
  const search = useSearchParams()
  return (
    <SidebarNavList pathname={pathname} search={search} onNavigate={onNavigate} items={items} />
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
        <SidebarNavList pathname={pathname} search={null} onNavigate={onNavigate} items={items} />
      }
    >
      <SidebarNavListWithSearch pathname={pathname} onNavigate={onNavigate} items={items} />
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
        <SidebarBrand />
      </header>

      {/* 데스크톱 사이드바 */}
      <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex xl:w-56">
        <div className="border-b border-slate-200 px-3 py-4">
          <SidebarBrand />
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
