'use client'

import type { ReactNode } from 'react'
import {
  ERP_SEARCH_INPUT_BASE,
  erpSearchFocusClass,
  type ErpModuleAccent,
} from '@/lib/ui/tokens'

type WorkspaceHeaderProps = {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  accent?: ErpModuleAccent
  actions?: ReactNode
  /** 기간 등 — 검색과 같은 줄(검색 | 기간 | 액션) */
  inlineFilters?: ReactNode
  /** 칩 등 — 검색 아래 한 줄 */
  filters?: ReactNode
  /** 필터 아래/옆 요약 */
  meta?: ReactNode
}

/**
 * 1행: 검색 + 인라인필터(기간) + 액션
 * 2행: 칩 필터 + meta
 */
export function WorkspaceHeader({
  search,
  onSearchChange,
  searchPlaceholder,
  accent = 'neutral',
  actions,
  inlineFilters,
  filters,
  meta,
}: WorkspaceHeaderProps) {
  const showSearch = search != null && onSearchChange != null
  const showFiltersRow = Boolean(filters) || Boolean(meta)

  return (
    <div className="flex w-full shrink-0 flex-col gap-3">
      <div className="flex w-full flex-wrap items-center gap-3">
        {showSearch ? (
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder ?? '검색…'}
            className={`${ERP_SEARCH_INPUT_BASE} min-w-[12rem] flex-1 ${erpSearchFocusClass(accent)}`}
          />
        ) : null}
        {inlineFilters ? (
          <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">{inlineFilters}</div>
        ) : null}
        {actions ? (
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {showFiltersRow ? (
        <div className="flex w-full min-w-0 flex-col items-start gap-2.5">
          {filters}
          {meta ? <div className="text-sm text-slate-500">{meta}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
