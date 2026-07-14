'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
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
}: {
  item: NavItem
  active: boolean
  showCaret?: boolean
}) {
  return (
    <Link
      href={item.href}
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

export function TopNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 overflow-visible border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-[60px] max-w-[1760px] items-center gap-3 overflow-visible px-5 lg:gap-5 lg:px-8">
        <Link
          href="/"
          className="relative h-9 w-[5.25rem] shrink-0 sm:h-10 sm:w-24"
          aria-label={`${APP_SHORT_NAME} 홈`}
        >
          <Image
            src="/branding/logo.png"
            alt={`${APP_SHORT_NAME} 로고`}
            fill
            priority
            sizes="96px"
            className="object-contain object-left"
          />
        </Link>

        <nav
          className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-visible"
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
      </div>
    </header>
  )
}
