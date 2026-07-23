import type { ReactNode } from 'react'

/** 목록·현황 등 대시보드 본문 공통 래퍼 — 뷰포트 안에 가두고 페이지 스크롤 방지 */
export const ERP_PAGE_SHELL_CLASS =
  'flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden'

type PageShellProps = {
  children: ReactNode
  className?: string
}

export function PageShell({ children, className = '' }: PageShellProps) {
  return <div className={[ERP_PAGE_SHELL_CLASS, className].filter(Boolean).join(' ')}>{children}</div>
}
