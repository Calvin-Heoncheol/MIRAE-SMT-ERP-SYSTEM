'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useId, useRef, useState } from 'react'
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
  /** true면 클릭·라우팅 불가 (준비중 등) */
  disabled?: boolean
  /** 있으면 호버/클릭 시 드롭다운 메뉴 */
  menu?: ModuleTabMenuItem[]
}

type ModuleTabShellProps = {
  /** @deprecated 사이드바 도입 후 미표시 — 호출부 호환용 */
  title?: string
  tabs: ModuleTabItem[]
  ariaLabel: string
  /** 탭 이동 시 유지할 URL 쿼리 파라미터 (예: 후공정 team) */
  preserveQueryParams?: string[]
  children: React.ReactNode
}

function tabHrefMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function isTabActive(pathname: string, tab: ModuleTabItem, tabs: ModuleTabItem[]) {
  const selfMatches =
    tabHrefMatches(pathname, tab.href) ||
    Boolean(tab.menu?.some((item) => tabHrefMatches(pathname, item.href)))
  if (!selfMatches) return false

  // /purchase-orders 와 /purchase-orders/by-material 처럼 접두가 겹치면 더 긴 href만 활성
  const matchedHrefs = tabs.flatMap((candidate) => {
    const hrefs = [candidate.href, ...(candidate.menu?.map((item) => item.href) ?? [])]
    return hrefs.filter((href) => tabHrefMatches(pathname, href))
  })
  if (!matchedHrefs.length) return false
  const bestHref = matchedHrefs.reduce((best, href) => (href.length > best.length ? href : best))
  return tabHrefMatches(pathname, bestHref) && (
    tab.href === bestHref || Boolean(tab.menu?.some((item) => item.href === bestHref))
  )
}

function TabLink({
  tab,
  tabs,
  pathname,
  querySuffix = '',
}: {
  tab: ModuleTabItem
  tabs: ModuleTabItem[]
  pathname: string
  querySuffix?: string
}) {
  const active = isTabActive(pathname, tab, tabs)
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

  if (tab.disabled) {
    return (
      <span
        className="cursor-not-allowed rounded-lg px-4 py-2 text-[13px] font-semibold text-slate-400 opacity-60 pointer-events-none select-none"
        aria-disabled="true"
        title="준비중"
      >
        {tab.label}
      </span>
    )
  }

  if (!hasMenu) {
    return (
      <Link
        href={`${tab.href}${querySuffix}`}
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
                href={`${item.href}${querySuffix}`}
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
  querySuffix = '',
}: {
  tabs: ModuleTabItem[]
  pathname: string
  ariaLabel: string
  querySuffix?: string
}) {
  if (tabs.length === 0) return null

  return (
    <nav
      className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => (
        <TabLink
          key={tab.href + tab.label}
          tab={tab}
          tabs={tabs}
          pathname={pathname}
          querySuffix={querySuffix}
        />
      ))}
    </nav>
  )
}

/** preserveQueryParams에 지정된 현재 쿼리를 탭 링크에 이어붙일 접미사로 생성 */
function PreservedQueryTabs({
  tabs,
  pathname,
  ariaLabel,
  preserveQueryParams,
}: {
  tabs: { start: ModuleTabItem[]; end: ModuleTabItem[] }
  pathname: string
  ariaLabel: string
  preserveQueryParams: string[]
}) {
  const search = useSearchParams()
  const params = new URLSearchParams()
  for (const key of preserveQueryParams) {
    const value = search.get(key)
    if (value) params.set(key, value)
  }
  const queryString = params.toString()
  const querySuffix = queryString ? `?${queryString}` : ''

  return (
    <>
      <TabNav tabs={tabs.start} pathname={pathname} ariaLabel={ariaLabel} querySuffix={querySuffix} />
      {tabs.end.length ? (
        <TabNav
          tabs={tabs.end}
          pathname={pathname}
          ariaLabel={`${ariaLabel} · 부가`}
          querySuffix={querySuffix}
        />
      ) : null}
    </>
  )
}

export function ModuleTabShell({
  tabs,
  ariaLabel,
  preserveQueryParams,
  children,
}: ModuleTabShellProps) {
  const pathname = usePathname()
  const startTabs = tabs.filter((tab) => tab.align !== 'end')
  const endTabs = tabs.filter((tab) => tab.align === 'end')
  const hasSplit = endTabs.length > 0
  const hasTabs = startTabs.length > 0 || endTabs.length > 0

  const plainTabs = (
    <>
      <TabNav tabs={startTabs} pathname={pathname} ariaLabel={ariaLabel} />
      {hasSplit ? (
        <TabNav tabs={endTabs} pathname={pathname} ariaLabel={`${ariaLabel} · 부가`} />
      ) : null}
    </>
  )

  return (
    <PageShell>
      {hasTabs ? (
        <div
          className={[
            'flex flex-wrap items-center gap-3',
            hasSplit ? 'justify-between' : '',
          ].join(' ')}
        >
          {preserveQueryParams?.length ? (
            <Suspense fallback={plainTabs}>
              <PreservedQueryTabs
                tabs={{ start: startTabs, end: endTabs }}
                pathname={pathname}
                ariaLabel={ariaLabel}
                preserveQueryParams={preserveQueryParams}
              />
            </Suspense>
          ) : (
            plainTabs
          )}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </PageShell>
  )
}
