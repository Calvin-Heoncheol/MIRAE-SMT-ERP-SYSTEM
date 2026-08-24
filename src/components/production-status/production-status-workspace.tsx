'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ProductionStatusQuickInputModal } from '@/components/production-status/production-status-quick-input-modal'
import {
  filterProductionStatusLineByStatus,
  ProductionStatusTable,
} from '@/components/production-status/production-status-table'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { DATE_RANGE_FILTER_LABEL, hasDateRangeFilter } from '@/lib/ui/date-range'
import { formatEmptyListMessage } from '@/lib/ui/tokens'
import { KpiStatCard } from '@/components/ui/kpi-stat-card'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchProductionStatusResult } from '@/lib/production-status/repository'
import type {
  ProductionStatusLine,
  ProductionStatusProductLine,
  ProductionStatusStage,
} from '@/lib/production-status/types'
import {
  filterProductionStatusLinesByDate,
  matchesProductionStatusSearch,
} from '@/lib/production-status/utils'

type ProductionStatusWorkspaceProps = {
  result: FetchProductionStatusResult
}

type QuickInputState = {
  stage: ProductionStatusStage
  line: ProductionStatusLine
  product?: ProductionStatusProductLine
} | null

type StatusFilter = 'active' | 'done' | 'all'

export function ProductionStatusWorkspace({ result }: ProductionStatusWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [quickInput, setQuickInput] = useState<QuickInputState>(null)
  const [, startTransition] = useTransition()

  const data = result.ok ? result.data : null
  const lines = data?.lines ?? []
  const query = search.trim()
  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate])

  const datedLines = useMemo(
    () => filterProductionStatusLinesByDate(lines, dateRange),
    [lines, dateRange],
  )

  const doneCount = useMemo(
    () =>
      datedLines.filter((line) => filterProductionStatusLineByStatus(line, 'done') != null).length,
    [datedLines],
  )
  const activeCount = useMemo(
    () =>
      datedLines.filter((line) => filterProductionStatusLineByStatus(line, 'active') != null)
        .length,
    [datedLines],
  )

  const statusFilteredLines = useMemo(() => {
    return datedLines
      .map((line) => filterProductionStatusLineByStatus(line, statusFilter))
      .filter((line): line is ProductionStatusLine => line != null)
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
    () => ({
      activeCount: searchedLines.filter(
        (line) => filterProductionStatusLineByStatus(line, 'active') != null,
      ).length,
      smtProduced: searchedLines.reduce((sum, line) => sum + Math.max(0, line.smtProduced), 0),
      postProduced: searchedLines.reduce((sum, line) => sum + Math.max(0, line.postProduced), 0),
      deliveryProduced: searchedLines.reduce((sum, line) => sum + Math.max(0, line.deliveryProduced), 0),
    }),
    [searchedLines],
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

  function handleStageClick(
    line: ProductionStatusLine,
    stage: ProductionStatusStage,
    product?: ProductionStatusProductLine,
  ) {
    setQuickInput({ stage, line, product })
  }

  function handleRegistered() {
    startTransition(() => {
      router.refresh()
    })
  }

  const hasActiveFilter = Boolean(query) || hasDateRangeFilter(dateRange)

  if (!result.ok) {
    return (
      <FetchErrorBanner
        reason={result.reason}
        title="생산현황을 불러오지 못했습니다"
        detail={result.detail}
      />
    )
  }

  return (
    <PageShell className="gap-4">
      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiStatCard label="진행중" value={kpi.activeCount} unit="건" tone="amber" />
        <KpiStatCard label="SMT 생산" value={kpi.smtProduced} unit="EA" tone="sky" />
        <KpiStatCard label="후공정 생산" value={kpi.postProduced} unit="EA" tone="emerald" />
        <KpiStatCard label="출하누적" value={kpi.deliveryProduced} unit="EA" />
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
          <FilterChipBar
            options={statusChips}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ProductionStatusTable
          lines={filteredLines}
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '표시할 발주서가 없습니다',
            actionHint: '발주서를 등록하면 생산 현황이 여기에 표시됩니다',
          })}
          onStageClick={handleStageClick}
        />
      </div>

      <ProductionStatusQuickInputModal
        open={Boolean(quickInput)}
        stage={quickInput?.stage ?? 'smt'}
        line={quickInput?.line ?? null}
        product={quickInput?.product ?? null}
        smtOrders={data!.smtOrders}
        postOrders={data!.postOrders}
        deliveryOrders={data!.deliveryOrders}
        smtCounts={data!.smtCounts}
        postCounts={data!.postCounts}
        deliveryAvailabilityByGroupId={data!.deliveryAvailabilityByGroupId}
        onClose={() => setQuickInput(null)}
        onRegistered={handleRegistered}
      />
    </PageShell>
  )
}
