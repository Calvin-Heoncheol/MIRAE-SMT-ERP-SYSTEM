'use client'

import type { ReactNode } from 'react'
import {
  ERP_SEARCH_INPUT_BASE,
  erpSearchFocusClass,
  type ErpModuleAccent,
} from '@/lib/ui/tokens'

type WorkspaceHeaderProps = {
  /** @deprecated 사이드바 도입 후 미표시 — 호출부 호환용 */
  title?: string
  /** @deprecated 사이드바 도입 후 미표시 — 호출부 호환용 */
  subtitle?: string
  /** @deprecated 건수 미표시 — 호출부 호환용 */
  totalCount?: number
  /** @deprecated 건수 미표시 — 호출부 호환용 */
  filteredCount?: number
  /** @deprecated 건수 미표시 — 호출부 호환용 */
  hasQuery?: boolean
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  accent?: ErpModuleAccent
  actions?: ReactNode
  /** 검색 위/옆에 추가 컨트롤 (필터 등) */
  filters?: ReactNode
  /** @deprecated 수량 합계 등 미표시 — 호출부 호환용 */
  meta?: ReactNode
}

export function WorkspaceHeader({
  search,
  onSearchChange,
  searchPlaceholder,
  accent = 'neutral',
  actions,
  filters,
}: WorkspaceHeaderProps) {
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
      {actions ? <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
