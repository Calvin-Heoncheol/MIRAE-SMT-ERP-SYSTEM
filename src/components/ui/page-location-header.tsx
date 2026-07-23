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
    <section className="shrink-0 rounded-xl border border-slate-200 border-l-4 border-l-slate-700 bg-slate-50 px-4 py-3 shadow-sm">
      <p className="text-sm font-semibold tracking-tight text-slate-900">
        <span className="text-slate-500">{crumb.section}</span>
        <span className="mx-2 font-medium text-slate-300" aria-hidden>
          /
        </span>
        <span>{crumb.page}</span>
      </p>
    </section>
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
