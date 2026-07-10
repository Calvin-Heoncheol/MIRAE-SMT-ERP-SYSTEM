'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type ModuleTabItem = {
  label: string
  href: string
}

type ModuleTabShellProps = {
  title: string
  description: string
  tabs: ModuleTabItem[]
  ariaLabel: string
  children: React.ReactNode
}

export function ModuleTabShell({
  title,
  description,
  tabs,
  ariaLabel,
  children,
}: ModuleTabShellProps) {
  const pathname = usePathname()

  return (
    <div className="flex min-h-[calc(100vh-60px)] w-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>

        <nav
          className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
          aria-label={ariaLabel}
        >
          {tabs.map((tab) => {
            const active = pathname === tab.href
            return (
              <Link
                key={tab.href}
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
          })}
        </nav>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}