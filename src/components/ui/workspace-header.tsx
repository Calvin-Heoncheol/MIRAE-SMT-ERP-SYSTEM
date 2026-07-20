'use client'

import type { ReactNode } from 'react'
import {
  ERP_SEARCH_INPUT_BASE,
  erpCountTintClass,
  erpSearchFocusClass,
  type ErpModuleAccent,
} from '@/lib/ui/tokens'

type WorkspaceHeaderProps = {
  /** @deprecated 사이드바 도입 후 미표시 — 호출부 호환용 */
  title?: string
  /** @deprecated 사이드바 도입 후 미표시 — 호출부 호환용 */
  subtitle?: string
  totalCount: number
  filteredCount?: number
  hasQuery?: boolean
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  accent?: ErpModuleAccent
  actions?: ReactNode
  /** 검색 위/옆에 추가 컨트롤 (필터 등) */
  filters?: ReactNode
  /** 건수 옆 보조 수치 (수량 합계 등) */
  meta?: ReactNode
}

export function WorkspaceHeader({
  totalCount,
  filteredCount,
  hasQuery = false,
  search,
  onSearchChange,
  searchPlaceholder,
  accent = 'neutral',
  actions,
  filters,
  meta,
}: WorkspaceHeaderProps) {
  const shown = filteredCount ?? totalCount
  const countClass = erpCountTintClass(accent)

  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        className={`${ERP_SEARCH_INPUT_BASE} ${erpSearchFocusClass(accent)}`}
      />
      {filters}
      <div className="ml-auto flex shrink-0 flex-wrap items-center gap-3">
        <div className="text-sm font-medium text-slate-600">
          <p className="whitespace-nowrap">
            총 <span className={`tabular-nums ${countClass}`}>{shown.toLocaleString('ko-KR')}</span>건
            {hasQuery ? (
              <span className="text-slate-400"> / {totalCount.toLocaleString('ko-KR')}건</span>
            ) : null}
          </p>
          {meta}
        </div>
        {actions}
      </div>
    </div>
  )
}
