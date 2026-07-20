'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { APP_SHORT_NAME } from '@/lib/app-config'
import {
  isNavChildActive,
  isNavItemActive,
  isNavLinkActive,
  NAV_ITEMS,
  type NavItem,
} from '@/lib/navigation'

function NavSection({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  onNavigate?: () => void
}) {
  const hasChildren = Boolean(item.children?.length)
  const sectionActive = hasChildren
    ? isNavItemActive(pathname, item)
    : isNavLinkActive(pathname, item.href)
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
          'mb-0.5 flex items-center rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
          sectionActive
            ? 'bg-blue-50 text-blue-700'
            : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
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
          'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[11px] font-bold tracking-wide uppercase transition-colors',
          sectionActive ? 'text-blue-700' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600',
        ].join(' ')}
        aria-expanded={expanded}
      >
        <span>{item.label}</span>
        <span className="text-[10px] opacity-70">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded ? (
        <div className="mt-0.5 space-y-0.5 pl-1">
          {item.children!.map((child) => {
            const childActive = isNavChildActive(pathname, child.href)
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                className={[
                  'block rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                  childActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
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

function SidebarNavBody({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="주 메뉴">
      {NAV_ITEMS.map((item) => (
        <NavSection key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}

function MobileDrawer({
  open,
  onClose,
  pathname,
}: {
  open: boolean
  onClose: () => void
  pathname: string
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
        <SidebarNavBody pathname={pathname} onNavigate={onClose} />
      </aside>
    </div>
  )
}

export function SideNav() {
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
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex xl:w-60">
        <div className="border-b border-slate-200 px-3 py-4">
          <SidebarBrand />
        </div>
        <SidebarNavBody pathname={pathname} />
      </aside>

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} pathname={pathname} />
    </>
  )
}
