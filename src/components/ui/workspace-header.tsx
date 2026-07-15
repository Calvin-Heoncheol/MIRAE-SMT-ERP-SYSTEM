'use client'

import type { ReactNode } from 'react'
import {
  ERP_SEARCH_INPUT_BASE,
  erpCountTintClass,
  erpSearchFocusClass,
  type ErpModuleAccent,
} from '@/lib/ui/tokens'

type WorkspaceHeaderProps = {
  /** 셸(ModuleTabShell)이 제목을 이미 보이면 false */
  title?: string
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
  /** 건수 아래 보조 수치 (수량 합계 등) */
  meta?: ReactNode
}

export function WorkspaceHeader({
  title,
  subtitle,
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

  const countBlock = (
    <div className="text-right text-sm font-medium text-slate-600">
      <p>
        총 <span className={`tabular-nums ${countClass}`}>{shown.toLocaleString('ko-KR')}</span>건
        {hasQuery ? (
          <span className="text-slate-400"> / {totalCount.toLocaleString('ko-KR')}건</span>
        ) : null}
      </p>
      {meta}
    </div>
  )

  return (
    <div className="flex w-full flex-col gap-3">
      {(title || subtitle) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            ) : null}
            {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {countBlock}
        </div>
      )}

      {!title && !subtitle ? (
        <div className="flex flex-wrap items-center justify-between gap-3">{countBlock}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
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
    </div>
  )
}
