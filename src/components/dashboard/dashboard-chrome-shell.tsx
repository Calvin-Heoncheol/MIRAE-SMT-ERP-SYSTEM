'use client'

import type { ReactNode } from 'react'
import { useDashboardChrome } from '@/components/dashboard/dashboard-chrome'

type DashboardChromeShellProps = {
  sideNav: ReactNode
  pageHeader: ReactNode
  children: ReactNode
}

/** focusMode일 때 사이드 네비·위치 헤더를 숨기고 본문만 넓게 표시 */
export function DashboardChromeShell({
  sideNav,
  pageHeader,
  children,
}: DashboardChromeShellProps) {
  const { focusMode } = useDashboardChrome()

  return (
    <div className="flex h-dvh flex-col overflow-hidden text-slate-900 lg:flex-row">
      {focusMode ? null : sideNav}
      <main
        className={[
          'flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden',
          focusMode ? 'gap-0 p-2 lg:p-3' : 'gap-3 px-4 py-4 lg:px-6 lg:py-5',
        ].join(' ')}
      >
        {focusMode ? null : pageHeader}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </main>
    </div>
  )
}
