import type { ReactNode } from 'react'

/** 목록·현황 등 대시보드 본문 공통 래퍼 — 불필요한 min-h 없이 flex로만 채움 */
export const ERP_PAGE_SHELL_CLASS = 'flex w-full flex-1 flex-col gap-4'

type PageShellProps = {
  children: ReactNode
  className?: string
}

export function PageShell({ children, className = '' }: PageShellProps) {
  return <div className={[ERP_PAGE_SHELL_CLASS, className].filter(Boolean).join(' ')}>{children}</div>
}
