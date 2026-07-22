import type { ReactNode } from 'react'

/** 목록·현황 등 대시보드 본문 공통 래퍼 — min-h-0으로 중첩 flex 스크롤 높이 체인 유지 */
export const ERP_PAGE_SHELL_CLASS = 'flex min-h-0 w-full flex-1 flex-col gap-4'

type PageShellProps = {
  children: ReactNode
  className?: string
}

export function PageShell({ children, className = '' }: PageShellProps) {
  return <div className={[ERP_PAGE_SHELL_CLASS, className].filter(Boolean).join(' ')}>{children}</div>
}
