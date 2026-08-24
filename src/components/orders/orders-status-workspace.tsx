'use client'

import { useMemo, useState } from 'react'
import {
  isOrderShipmentComplete,
  OrderStatusTable,
  summarizeOrderShipmentKpi,
} from '@/components/orders/order-status-table'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { DATE_RANGE_FILTER_LABEL, hasDateRangeFilter } from '@/lib/ui/date-range'
import { formatEmptyListMessage } from '@/lib/ui/tokens'
import { KpiStatCard } from '@/components/ui/kpi-stat-card'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchProductionStatusResult } from '@/lib/production-status/repository'
import {
  filterProductionStatusLinesByDate,
  matchesProductionStatusSearch,
} from '@/lib/production-status/utils'

type OrdersStatusWorkspaceProps = {
  result: FetchProductionStatusResult
}

type StatusFilter = 'active' | 'done' | 'all'

export function OrdersStatusWorkspace({ result }: OrdersStatusWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const lines = result.ok ? result.data.lines : []
  const query = search.trim()
  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate])

  const datedLines = useMemo(
    () => filterProductionStatusLinesByDate(lines, dateRange),
    [lines, dateRange],
  )

  const doneCount = useMemo(() => datedLines.filter(isOrderShipmentComplete).length, [datedLines])
  const activeCount = datedLines.length - doneCount

  const statusFilteredLines = useMemo(() => {
    if (statusFilter === 'all') return datedLines
    if (statusFilter === 'done') return datedLines.filter(isOrderShipmentComplete)
    return datedLines.filter((line) => !isOrderShipmentComplete(line))
  }, [datedLines, statusFilter])

  const searchedLines = useMemo(
    () => datedLines.filter((line) => matchesProductionStatusSearch(line, query)),
    [datedLines, query],
  )

  const filteredLines = useMemo(
    () => statusFilteredLines.filter((line) => matchesProductionStatusSearch(line, query)),
    [statusFilteredLines, query],
  )

  const kpi = useMemo(
    () =>
      summarizeOrderShipmentKpi(
        searchedLines,
        result.ok ? result.data.deliveryAvailabilityByGroupId : {},
      ),
    [result, searchedLines],
  )

  const statusChips = [
    {
      value: 'active' as const,
      label: '진행중',
      count: activeCount,
      tone: STATUS_FILTER_TONES.progress,
    },
    { value: 'done' as const, label: '완료', count: doneCount, tone: STATUS_FILTER_TONES.done },
    { value: 'all' as const, label: '전체', count: datedLines.length },
  ]

  const hasActiveFilter = Boolean(query) || hasDateRangeFilter(dateRange)

  if (!result.ok) {
    return (
      <FetchErrorBanner
        reason={result.reason}
        title="출하현황을 불러오지 못했습니다"
        detail={result.detail}
      />
    )
  }

  return (
    <PageShell className="gap-4">
      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiStatCard label="진행중" value={kpi.activeCount} unit="건" tone="amber" />
        <KpiStatCard label="출하가능" value={kpi.shippable} unit="EA" tone="sky" />
        <KpiStatCard label="출하누적" value={kpi.shipped} unit="EA" tone="emerald" />
        <KpiStatCard label="미출하" value={kpi.remaining} unit="EA" tone="rose" />
      </div>

      <WorkspaceHeader
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="발주번호, 고객사, 품목코드, 제품명 검색…"
        accent="slate"
        inlineFilters={
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            label={DATE_RANGE_FILTER_LABEL.due}
          />
        }
        filters={
          <FilterChipBar options={statusChips} value={statusFilter} onChange={setStatusFilter} />
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <OrderStatusTable
          lines={filteredLines}
          availabilityByGroupId={
            result.ok ? result.data.deliveryAvailabilityByGroupId : {}
          }
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '표시할 발주서가 없습니다',
            actionHint: '발주서를 등록하면 출하 현황이 여기에 표시됩니다',
          })}
        />
      </div>
    </PageShell>
  )
}
