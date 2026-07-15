'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { APP_SHORT_NAME } from '@/lib/app-config'
import {
  isNavChildActive,
  isNavItemActive,
  isNavLinkActive,
  NAV_ITEMS,
  type NavItem,
} from '@/lib/navigation'

function NavLink({
  item,
  active,
  showCaret,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  showCaret?: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={[
        'inline-flex shrink-0 items-center gap-1 rounded-lg px-3.5 py-2 text-[13px] font-semibold tracking-tight whitespace-nowrap transition-colors',
        active
          ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
      ].join(' ')}
      aria-current={active ? 'page' : undefined}
    >
      {item.label}
      {showCaret ? <span className="text-[10px] opacity-70">▾</span> : null}
    </Link>
  )
}

function NavDropdown({ item, active }: { item: NavItem; active: boolean }) {
  const pathname = usePathname()
  const children = item.children ?? []
  const [open, setOpen] = useState(false)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleEnter() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setOpen(true)
  }

  function handleLeave() {
    closeTimerRef.current = setTimeout(() => setOpen(false), 150)
  }

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <NavLink item={item} active={active} showCaret />

      <div
        className={[
          'absolute top-full right-0 z-[60] min-w-[168px] pt-1 transition-opacity duration-150',
          open ? 'visible opacity-100' : 'invisible pointer-events-none opacity-0',
        ].join(' ')}
        aria-hidden={!open}
      >
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {children.map((child) => {
            const childActive = isNavChildActive(pathname, child.href)
            return (
              <Link
                key={child.href}
                href={child.href}
                className={[
                  'block px-4 py-2.5 text-[13px] font-semibold transition-colors',
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
      </div>
    </div>
  )
}

function MobileNavDrawer({
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
      <div className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-bold text-slate-900">메뉴</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="모바일 주 메뉴">
          {NAV_ITEMS.map((item) => {
            const active = item.children?.length
              ? isNavItemActive(pathname, item)
              : isNavLinkActive(pathname, item.href)

            if (!item.children?.length) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={[
                    'mb-1 block rounded-lg px-3 py-2.5 text-sm font-semibold',
                    active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              )
            }

            return (
              <div key={item.href} className="mb-3">
                <p className="px-3 py-1.5 text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                  {item.label}
                </p>
                {item.children.map((child) => {
                  const childActive = isNavChildActive(pathname, child.href)
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onClose}
                      className={[
                        'mb-0.5 block rounded-lg px-3 py-2 text-sm font-semibold',
                        childActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {child.label}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export function TopNav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <header className="sticky top-0 z-50 overflow-visible border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="flex h-[60px] w-full items-center gap-2 overflow-visible pl-3 pr-3 sm:gap-3 sm:pl-5 lg:gap-5 lg:pr-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2"
          aria-label={`${APP_SHORT_NAME} 홈`}
        >
          <span className="relative h-9 w-[4.75rem] sm:h-10 sm:w-[5.5rem]">
            <Image
              src="/branding/logo.png"
              alt=""
              fill
              priority
              sizes="88px"
              className="object-contain object-left"
            />
          </span>
          <span className="hidden text-[15px] font-bold tracking-tight text-slate-900 sm:inline sm:text-base">
            {APP_SHORT_NAME}
          </span>
        </Link>

        {/* 데스크톱·태블릿: overflow-x는 드롭다운을 잘라서 쓰지 않음 */}
        <nav
          className="hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-0.5 overflow-visible md:flex md:gap-1"
          aria-label="주 메뉴"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.children?.length
              ? isNavItemActive(pathname, item)
              : isNavLinkActive(pathname, item.href)

            if (item.children?.length) {
              return <NavDropdown key={item.href} item={item} active={active} />
            }

            return <NavLink key={item.href} item={item} active={active} />
          })}
        </nav>

        {/* 모바일: 햄버거 */}
        <button
          type="button"
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 md:hidden"
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
      </div>

      <MobileNavDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} pathname={pathname} />
    </header>
  )
}
