'use client'

import { useMemo, useState } from 'react'
import { OrderProgressTable } from '@/components/orders/order-progress-table'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { KpiStatCard } from '@/components/ui/kpi-stat-card'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchOrderProgressResult } from '@/lib/orders/progress-repository'
import {
  matchesOrderProgressSearch,
  summarizeOrderProgressKpi,
  type OrderProgressStatus,
} from '@/lib/orders/progress'
import { DATE_RANGE_FILTER_LABEL, hasDateRangeFilter, matchesDateRange } from '@/lib/ui/date-range'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type OrdersProgressWorkspaceProps = {
  result: FetchOrderProgressResult
}

type StatusFilter = 'active' | OrderProgressStatus | 'all'

export function OrdersProgressWorkspace({ result }: OrdersProgressWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const rows = result.ok ? result.rows : []
  const query = search.trim()
  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate])

  const datedRows = useMemo(
    () => rows.filter((row) => matchesDateRange(row.deliveryDate || row.orderDate, dateRange)),
    [rows, dateRange],
  )

  const openCount = useMemo(
    () => datedRows.filter((row) => row.status === 'open').length,
    [datedRows],
  )
  const partialCount = useMemo(
    () => datedRows.filter((row) => row.status === 'partial').length,
    [datedRows],
  )
  const doneCount = useMemo(
    () => datedRows.filter((row) => row.status === 'done').length,
    [datedRows],
  )
  const activeCount = openCount + partialCount

  const statusFilteredRows = useMemo(() => {
    if (statusFilter === 'all') return datedRows
    if (statusFilter === 'active') {
      return datedRows.filter((row) => row.status !== 'done')
    }
    return datedRows.filter((row) => row.status === statusFilter)
  }, [datedRows, statusFilter])

  const filteredRows = useMemo(
    () => statusFilteredRows.filter((row) => matchesOrderProgressSearch(row, query)),
    [statusFilteredRows, query],
  )

  const kpi = useMemo(() => summarizeOrderProgressKpi(filteredRows), [filteredRows])

  if (!result.ok) {
    return (
      <PageShell>
        <FetchErrorBanner title="발주현황을 불러오지 못했습니다" detail={result.detail} />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <WorkspaceHeader
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="발주번호, 고객사, 제품, 상태 검색…"
        accent="slate"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiStatCard label="발주" value={kpi.orderCount} unit="건" tone="slate" />
        <KpiStatCard label="발주수량" value={kpi.orderedQuantity} unit="EA" tone="sky" />
        <KpiStatCard label="출하누적" value={kpi.shippedQuantity} unit="EA" tone="emerald" />
        <KpiStatCard label="잔량" value={kpi.remainingQuantity} unit="EA" tone="rose" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChipBar
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'active', label: '진행중', count: activeCount, tone: STATUS_FILTER_TONES.progress },
            { value: 'open', label: '미출하', count: openCount, tone: STATUS_FILTER_TONES.waiting },
            {
              value: 'partial',
              label: '부분출하',
              count: partialCount,
              tone: STATUS_FILTER_TONES.progress,
            },
            { value: 'done', label: '완료', count: doneCount, tone: STATUS_FILTER_TONES.done },
            { value: 'all', label: '전체', count: datedRows.length },
          ]}
        />
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          label={DATE_RANGE_FILTER_LABEL.due}
        />
      </div>

      <OrderProgressTable
        rows={filteredRows}
        emptyMessage={formatEmptyListMessage({
          hasQuery: Boolean(query) || hasDateRangeFilter(dateRange) || statusFilter !== 'active',
          emptyLabel: '표시할 발주서가 없습니다',
          actionHint: '발주서를 등록하면 발주 진행 현황이 여기에 표시됩니다',
        })}
      />
    </PageShell>
  )
}
