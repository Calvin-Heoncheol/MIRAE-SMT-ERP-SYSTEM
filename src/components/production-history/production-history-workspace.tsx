'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ProductionHistoryModal } from '@/components/production-history/production-history-modal'
import { ProductionHistoryTable } from '@/components/production-history/production-history-table'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { DATE_RANGE_FILTER_LABEL } from '@/lib/ui/date-range'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { FilterChipBar } from '@/components/ui/filter-chip'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { downloadExcel } from '@/lib/excel/export'
import type { FetchProductionHistoryResult } from '@/lib/production-history/repository'
import {
  PRODUCTION_HISTORY_TEAMS,
  type ProductionHistoryRow,
  type ProductionHistoryTeamFilter,
} from '@/lib/production-history/types'
import {
  filterProductionHistory,
  formatProductionHistoryRecordAt,
} from '@/lib/production-history/utils'
import { formatSmtPcbSideLabel } from '@/lib/smt/history-utils'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type ProductionHistoryWorkspaceProps = {
  result: FetchProductionHistoryResult
  initialTeamFilter?: ProductionHistoryTeamFilter
}

type ModalState = { open: false } | { open: true; row: ProductionHistoryRow }

export function ProductionHistoryWorkspace({
  result,
  initialTeamFilter = 'all',
}: ProductionHistoryWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState<ProductionHistoryTeamFilter>(initialTeamFilter)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })

  // 내비에서 ?team=생산3팀 등으로 같은 페이지 이동 시 필터 동기화
  useEffect(() => {
    setTeamFilter(initialTeamFilter)
  }, [initialTeamFilter])

  function handleTeamFilterChange(next: ProductionHistoryTeamFilter) {
    setTeamFilter(next)
    // App Router soft navigation(RSC fetch) 없이 URL만 맞춰 딥링크 유지
    const query = next === 'all' ? '' : `?team=${encodeURIComponent(next)}`
    window.history.replaceState(window.history.state, '', `${pathname}${query}`)
  }

  const rows = result.ok ? result.rows : []
  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate])
  const filtered = useMemo(
    () => filterProductionHistory(rows, search, teamFilter, dateRange),
    [rows, search, teamFilter, dateRange],
  )
  const hasActiveFilter =
    Boolean(search.trim()) || teamFilter !== 'all' || Boolean(startDate || endDate)
  const showSmtColumns = teamFilter === 'all' || teamFilter === '생산1팀'

  const teamFilterOptions = useMemo(() => {
    const searched = filterProductionHistory(rows, search, 'all', dateRange)
    return [
      { value: 'all' as const, label: '전체', count: searched.length },
      ...PRODUCTION_HISTORY_TEAMS.map((team) => ({
        value: team as ProductionHistoryTeamFilter,
        label: team,
        count: searched.filter((row) => row.team === team).length,
      })),
    ]
  }, [rows, search, dateRange])

  function openDetail(row: ProductionHistoryRow) {
    setModal({ open: true, row })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleDeleted() {
    closeModal()
    router.refresh()
  }

  async function handleExcelDownload() {
    await downloadExcel({
      fileName: '생산이력',
      sheetName: '생산이력',
      rows: filtered,
      columns: [
        { header: '기록일', value: (row) => formatProductionHistoryRecordAt(row), width: 18 },
        { header: '팀', value: (row) => row.team, width: 10 },
        { header: '발주ID', value: (row) => row.orderNumber, width: 22 },
        { header: '고객사', value: (row) => row.customer, width: 18 },
        { header: '제품명', value: (row) => row.productName, width: 26 },
        { header: '품목코드', value: (row) => row.productCode, width: 16 },
        ...(showSmtColumns
          ? [
              {
                header: '라인',
                value: (row: ProductionHistoryRow) => (row.lineNo != null ? row.lineNo : ''),
                width: 8,
              },
              {
                header: '면구분',
                value: (row: ProductionHistoryRow) =>
                  row.pcbSide ? formatSmtPcbSideLabel(row.pcbSide) : '',
                width: 10,
              },
            ]
          : []),
        { header: '양품', value: (row) => row.quantity, width: 10 },
        { header: '불량', value: (row) => row.defectQuantity, width: 10 },
        { header: '등록자', value: (row) => row.createdByName, width: 12 },
        { header: '비고', value: (row) => row.note, width: 24 },
      ],
    })
  }

  if (!result.ok) {
    return (
      <PageShell>
        <FetchErrorBanner title="생산이력을 불러오지 못했습니다" detail={result.detail} />
      </PageShell>
    )
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="출하번호, LOT, 발주ID, 고객사, 제품명 검색…"
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
          filters={
            <FilterChipBar
              options={teamFilterOptions}
              value={teamFilter}
              onChange={handleTeamFilterChange}
            />
          }
          actions={
            <ExcelDownloadButton onDownload={handleExcelDownload} disabled={!filtered.length} />
          }
        />

        <ProductionHistoryTable
          rows={filtered}
          showSmtColumns={showSmtColumns}
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '등록된 생산 이력이 없습니다',
            actionHint: '각 팀 생산입력에서 등록하세요',
          })}
          onRowClick={openDetail}
        />
      </PageShell>

      <ProductionHistoryModal
        open={modal.open}
        row={modal.open ? modal.row : null}
        onClose={closeModal}
        onDeleted={handleDeleted}
      />
    </>
  )
}
