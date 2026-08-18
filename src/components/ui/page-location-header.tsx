'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { resolveNavBreadcrumb } from '@/lib/navigation'

function PageLocationHeaderInner() {
  const pathname = usePathname()
  const search = useSearchParams()
  const crumb = resolveNavBreadcrumb(pathname, search)

  if (!crumb) return null

  return (
    <p className="shrink-0 text-xs font-medium text-slate-500">
      <span>{crumb.section}</span>
      <span className="mx-1.5 text-slate-300" aria-hidden>
        /
      </span>
      <span className="text-slate-800">{crumb.page}</span>
    </p>
  )
}

/** 대시보드 본문 상단 — 사이드바 메뉴 기준 현재 위치 (섹션 / 페이지) */
export function PageLocationHeader() {
  return (
    <Suspense fallback={null}>
      <PageLocationHeaderInner />
    </Suspense>
  )
}
