'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { PageShell } from '@/components/ui/page-shell'

export type ModuleTabMenuItem = {
  label: string
  href: string
}

export type ModuleTabItem = {
  label: string
  href: string
  /** end면 오른쪽 별도 탭 그룹으로 배치 */
  align?: 'start' | 'end'
  /** 있으면 호버/클릭 시 드롭다운 메뉴 */
  menu?: ModuleTabMenuItem[]
}

type ModuleTabShellProps = {
  /** @deprecated 사이드바 도입 후 미표시 — 호출부 호환용 */
  title?: string
  tabs: ModuleTabItem[]
  ariaLabel: string
  children: React.ReactNode
}

function isTabActive(pathname: string, tab: ModuleTabItem) {
  if (pathname === tab.href || pathname.startsWith(`${tab.href}/`)) return true
  return Boolean(tab.menu?.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)))
}

function TabLink({
  tab,
  pathname,
}: {
  tab: ModuleTabItem
  pathname: string
}) {
  const active = isTabActive(pathname, tab)
  const hasMenu = Boolean(tab.menu?.length)
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  function openMenu() {
    clearCloseTimer()
    setOpen(true)
  }

  function scheduleClose() {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => () => clearCloseTimer(), [])

  if (!hasMenu) {
    return (
      <Link
        href={tab.href}
        className={[
          'rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors',
          active
            ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
        ].join(' ')}
        aria-current={active ? 'page' : undefined}
      >
        {tab.label}
      </Link>
    )
  }

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={[
          'inline-flex items-center gap-1 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors',
          active || open
            ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
        ].join(' ')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {tab.label}
        <span className="text-[10px] leading-none opacity-70" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-30 mt-1.5 min-w-[9.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
        >
          {tab.menu!.map((item) => {
            const itemActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={[
                  'block px-3.5 py-2 text-sm font-semibold transition-colors',
                  itemActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                ].join(' ')}
                aria-current={itemActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function TabNav({
  tabs,
  pathname,
  ariaLabel,
}: {
  tabs: ModuleTabItem[]
  pathname: string
  ariaLabel: string
}) {
  if (tabs.length === 0) return null

  return (
    <nav
      className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => (
        <TabLink key={tab.href + tab.label} tab={tab} pathname={pathname} />
      ))}
    </nav>
  )
}

export function ModuleTabShell({
  tabs,
  ariaLabel,
  children,
}: ModuleTabShellProps) {
  const pathname = usePathname()
  const startTabs = tabs.filter((tab) => tab.align !== 'end')
  const endTabs = tabs.filter((tab) => tab.align === 'end')
  const hasSplit = endTabs.length > 0
  const hasTabs = startTabs.length > 0 || endTabs.length > 0

  return (
    <PageShell>
      {hasTabs ? (
        <div
          className={[
            'flex flex-wrap items-center gap-3',
            hasSplit ? 'justify-between' : '',
          ].join(' ')}
        >
          <TabNav tabs={startTabs} pathname={pathname} ariaLabel={ariaLabel} />
          {hasSplit ? (
            <TabNav
              tabs={endTabs}
              pathname={pathname}
              ariaLabel={`${ariaLabel} · 부가`}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </PageShell>
  )
}
