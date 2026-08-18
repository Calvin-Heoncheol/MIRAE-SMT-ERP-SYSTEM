'use client'

import Link from 'next/link'
import { useAuthProfile } from '@/components/auth/auth-profile-provider'
import { canAccessPath } from '@/lib/auth/permissions'

export type ProductionTeamTab = {
  id: string
  label: string
  href: string
}

function tabSearch(href: string) {
  const queryIndex = href.indexOf('?')
  if (queryIndex === -1) {
    return { path: href, get: () => null as string | null }
  }
  const params = new URLSearchParams(href.slice(queryIndex + 1))
  return {
    path: href.slice(0, queryIndex),
    get: (name: string) => params.get(name),
  }
}

export function ProductionTeamTabs({
  tabs,
  activeId,
  ariaLabel,
}: {
  tabs: ProductionTeamTab[]
  activeId: string
  ariaLabel: string
}) {
  const { profile, authDisabled } = useAuthProfile()
  const visible = authDisabled
    ? tabs
    : tabs.filter((tab) => {
        const parsed = tabSearch(tab.href)
        return canAccessPath(profile, parsed.path, parsed)
      })

  if (!visible.length) return null

  return (
    <nav
      className="inline-flex flex-wrap items-center rounded-xl border border-slate-200 bg-white p-1"
      aria-label={ariaLabel}
    >
      {visible.map((tab) => {
        const isActive = tab.id === activeId
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={[
              'rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors',
              isActive
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
            ].join(' ')}
            aria-current={isActive ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
