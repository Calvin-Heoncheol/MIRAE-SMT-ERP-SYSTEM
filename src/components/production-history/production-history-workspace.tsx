'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { ProductionHistoryModal } from '@/components/production-history/production-history-modal'
import {
  ProductionHistoryTable,
  productionHistoryRowKey,
} from '@/components/production-history/production-history-table'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { ErpButton } from '@/components/ui/erp-button'
import { FilterChipBar } from '@/components/ui/filter-chip'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { DATE_RANGE_FILTER_LABEL } from '@/lib/ui/date-range'
import { deletePostProcessProductionRecord } from '@/lib/post-process/repository'
import type { FetchProductionHistoryResult } from '@/lib/production-history/repository'
import {
  PRODUCTION_HISTORY_TEAMS,
  type ProductionHistoryRow,
  type ProductionHistoryTeamFilter,
} from '@/lib/production-history/types'
import { filterProductionHistory } from '@/lib/production-history/utils'
import { deleteSmtProductionRecord } from '@/lib/smt/repository'
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
  const canDelete = useCanDeleteRecords()
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState<ProductionHistoryTeamFilter>(initialTeamFilter)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // 내비에서 ?team=생산3팀 등으로 같은 페이지 이동 시 필터 동기화
  useEffect(() => {
    setTeamFilter(initialTeamFilter)
    setSelectedIds(new Set())
  }, [initialTeamFilter])

  function handleTeamFilterChange(next: ProductionHistoryTeamFilter) {
    setTeamFilter(next)
    setSelectedIds(new Set())
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

  const selectedRows = useMemo(
    () => filtered.filter((row) => selectedIds.has(productionHistoryRowKey(row))),
    [filtered, selectedIds],
  )
  const selectedCount = selectedRows.length

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

  function toggleSelectAll() {
    if (selectedCount === filtered.length && filtered.length > 0) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const row of filtered) next.delete(productionHistoryRowKey(row))
        return next
      })
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const row of filtered) next.add(productionHistoryRowKey(row))
      return next
    })
  }

  function toggleSelectOne(key: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleDeleteSelected() {
    if (deleting || selectedCount === 0) return
    if (
      !window.confirm(
        `선택한 생산이력 ${selectedCount}건을 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`,
      )
    ) {
      return
    }

    setDeleting(true)
    setError(null)
    setSaveMessage(null)

    for (let index = 0; index < selectedRows.length; index += 1) {
      const row = selectedRows[index]!
      const deleteResult =
        row.module === 'smt'
          ? await deleteSmtProductionRecord(row.id)
          : await deletePostProcessProductionRecord(row.id)
      if (!deleteResult.ok) {
        setDeleting(false)
        setError(`${index + 1}건째 삭제 실패: ${deleteResult.detail}`)
        return
      }
    }

    setDeleting(false)
    setSelectedIds(new Set())
    setSaveMessage(`생산이력 ${selectedCount}건을 삭제했습니다.`)
    router.refresh()
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
          onSearchChange={(value) => {
            setSearch(value)
            setSelectedIds(new Set())
          }}
          searchPlaceholder="출하번호, LOT, 발주번호, 고객사, 제품명 검색…"
          accent="slate"
          inlineFilters={
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={(value) => {
                setStartDate(value)
                setSelectedIds(new Set())
              }}
              onEndDateChange={(value) => {
                setEndDate(value)
                setSelectedIds(new Set())
              }}
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
            canDelete ? (
              <ErpButton
                variant="danger"
                disabled={selectedCount === 0}
                loading={deleting}
                onClick={() => void handleDeleteSelected()}
              >
                {deleting
                  ? '삭제 중…'
                  : selectedCount > 0
                    ? `삭제 (${selectedCount})`
                    : '삭제'}
              </ErpButton>
            ) : null
          }
        />

        {saveMessage ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
            {saveMessage}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-900">
            {error}
          </div>
        ) : null}

        <ProductionHistoryTable
          rows={filtered}
          showSmtColumns={showSmtColumns}
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '등록된 생산 이력이 없습니다',
            actionHint: '각 팀 생산입력에서 등록하세요',
          })}
          onRowClick={openDetail}
          selectedIds={selectedIds}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelectOne={toggleSelectOne}
          selectionDisabled={deleting}
        />
      </PageShell>

      <ProductionHistoryModal
        open={modal.open}
        row={modal.open ? modal.row : null}
        onClose={closeModal}
      />
    </>
  )
}
