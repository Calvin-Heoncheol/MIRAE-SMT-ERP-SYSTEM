'use client'

import { useMemo, useState } from 'react'
import { MaterialManualHistoryTable } from '@/components/materials/manual/material-manual-history-table'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchMaterialManualHistoryResult } from '@/lib/materials/manual/types'
import type { MaterialManualHistoryKindFilter } from '@/lib/materials/manual/types'
import { filterMaterialManualHistory } from '@/lib/materials/manual/utils'
import { DATE_RANGE_FILTER_LABEL } from '@/lib/ui/date-range'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type MaterialManualHistoryWorkspaceProps = {
  result: FetchMaterialManualHistoryResult
}

export function MaterialManualHistoryWorkspace({
  result,
}: MaterialManualHistoryWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<MaterialManualHistoryKindFilter>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const rows = result.ok ? result.rows : []
  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate])

  const filtered = useMemo(
    () => filterMaterialManualHistory(rows, search, kindFilter, dateRange),
    [rows, search, kindFilter, dateRange],
  )

  const kindCounts = useMemo(() => {
    const searched = filterMaterialManualHistory(rows, search, 'all', dateRange)
    return {
      all: searched.length,
      inbound: searched.filter((row) => row.kind === 'inbound').length,
      outbound: searched.filter((row) => row.kind === 'outbound').length,
    }
  }, [rows, search, dateRange])

  const hasActiveFilter =
    Boolean(search.trim()) || kindFilter !== 'all' || Boolean(startDate || endDate)

  if (!result.ok) {
    return (
      <PageShell>
        <FetchErrorBanner title="입고 및 불출 이력을 불러오지 못했습니다" detail={result.detail} />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <WorkspaceHeader
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="발주번호, 고객사, 제품명, 등록자 검색…"
        accent="orange"
        inlineFilters={
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            label={DATE_RANGE_FILTER_LABEL.record}
          />
        }
        filters={
          <FilterChipBar
            options={[
              { value: 'all', label: '전체', count: kindCounts.all },
              {
                value: 'inbound',
                label: '입고',
                count: kindCounts.inbound,
                tone: STATUS_FILTER_TONES.progress,
              },
              {
                value: 'outbound',
                label: '불출',
                count: kindCounts.outbound,
                tone: STATUS_FILTER_TONES.info,
              },
            ]}
            value={kindFilter}
            onChange={setKindFilter}
          />
        }
      />

      <MaterialManualHistoryTable
        rows={filtered}
        emptyMessage={formatEmptyListMessage({
          hasQuery: hasActiveFilter,
          emptyLabel: '등록된 입고·불출 이력이 없습니다',
          actionHint: '입고 및 불출 메뉴에서 등록하세요',
        })}
      />
    </PageShell>
  )
}
