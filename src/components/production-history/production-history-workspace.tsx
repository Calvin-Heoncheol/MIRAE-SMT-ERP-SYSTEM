'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ProductionHistoryModal } from '@/components/production-history/production-history-modal'
import { ProductionHistoryTable } from '@/components/production-history/production-history-table'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { DATE_RANGE_FILTER_LABEL } from '@/lib/ui/date-range'
import type { FetchProductionHistoryResult } from '@/lib/production-history/repository'
import type {
  ProductionHistoryRow,
  ProductionHistoryTeamFilter,
} from '@/lib/production-history/types'
import { filterProductionHistory } from '@/lib/production-history/utils'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type ProductionHistoryWorkspaceProps = {
  result: FetchProductionHistoryResult
  /** 상위 팀 탭 기준 필터 (칩 없음) */
  initialTeamFilter?: ProductionHistoryTeamFilter
  /** 생산등록 등 다른 화면 안에 넣을 때 */
  embedded?: boolean
  /** 검색 행 오른쪽 — 보기 탭 등 */
  headerActions?: ReactNode
}

type ModalState = { open: false } | { open: true; row: ProductionHistoryRow }

export function ProductionHistoryWorkspace({
  result,
  initialTeamFilter = 'all',
  embedded = false,
  headerActions,
}: ProductionHistoryWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })

  const rows = result.ok ? result.rows : []
  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate])
  const filtered = useMemo(
    () => filterProductionHistory(rows, search, initialTeamFilter, dateRange),
    [rows, search, initialTeamFilter, dateRange],
  )
  const hasActiveFilter =
    Boolean(search.trim()) || initialTeamFilter !== 'all' || Boolean(startDate || endDate)
  const showSmtColumns = initialTeamFilter === 'all' || initialTeamFilter === '생산1팀'

  if (!result.ok) {
    const errorBanner = (
      <FetchErrorBanner title="생산이력을 불러오지 못했습니다" detail={result.detail} />
    )
    if (embedded) return errorBanner
    return <PageShell>{errorBanner}</PageShell>
  }

  const header = (
    <WorkspaceHeader
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="출하번호, 발주번호, 고객사, 제품명 검색…"
      accent="slate"
      inlineFilters={
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          label={DATE_RANGE_FILTER_LABEL.record}
        />
      }
      actions={headerActions}
    />
  )

  const body = (
    <div className={embedded ? 'min-h-0 flex-1 overflow-auto' : undefined}>
      <ProductionHistoryTable
        rows={filtered}
        showSmtColumns={showSmtColumns}
        emptyMessage={formatEmptyListMessage({
          hasQuery: hasActiveFilter,
          emptyLabel: '등록된 생산 이력이 없습니다',
          actionHint: '각 팀 생산입력에서 등록하세요',
        })}
        onRowClick={(row) => setModal({ open: true, row })}
      />
    </div>
  )

  return (
    <>
      {embedded ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          {header}
          {body}
        </div>
      ) : (
        <PageShell>
          {header}
          {body}
        </PageShell>
      )}

      <ProductionHistoryModal
        open={modal.open}
        row={modal.open ? modal.row : null}
        onClose={() => setModal({ open: false })}
      />
    </>
  )
}
