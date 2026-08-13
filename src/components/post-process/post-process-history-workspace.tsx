'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PostProcessHistoryFetchError } from '@/components/post-process/post-process-history-fetch-error'
import { PostProcessHistoryModal } from '@/components/post-process/post-process-history-modal'
import { PostProcessHistoryTable } from '@/components/post-process/post-process-history-table'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { downloadExcel } from '@/lib/excel/export'
import type { FetchPostProcessProductionHistoryResult } from '@/lib/post-process/repository'
import type { PostProcessProductionHistoryRow } from '@/lib/post-process/types'
import {
  filterPostProcessProductionHistory,
  formatPostProcessHistoryDateTime,
} from '@/lib/post-process/history-utils'
import { hasDateRangeFilter } from '@/lib/ui/date-range'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type PostProcessHistoryWorkspaceProps = {
  result: FetchPostProcessProductionHistoryResult
}

type ModalState = { open: false } | { open: true; row: PostProcessProductionHistoryRow }

export function PostProcessHistoryWorkspace({ result }: PostProcessHistoryWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })

  const rows = result.ok ? result.rows : []
  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate])
  const filtered = useMemo(
    () => filterPostProcessProductionHistory(rows, search, dateRange),
    [rows, search, dateRange],
  )
  const hasActiveFilter = Boolean(search.trim()) || hasDateRangeFilter(dateRange)

  function openDetail(row: PostProcessProductionHistoryRow) {
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
      fileName: '후공정생산이력',
      sheetName: '후공정 생산이력',
      rows: filtered,
      columns: [
        { header: '기록일', value: (row) => row.recordDate, width: 12 },
        {
          header: '등록시각',
          value: (row) => formatPostProcessHistoryDateTime(row.createdAt),
          width: 16,
        },
        { header: '팀', value: (row) => row.team, width: 10 },
        { header: '발주ID', value: (row) => row.orderNumber, width: 22 },
        { header: '고객사', value: (row) => row.customer, width: 18 },
        { header: '조립제품명', value: (row) => row.productName, width: 26 },
        { header: '품목코드', value: (row) => row.productCode, width: 16 },
        { header: '양품', value: (row) => row.quantity, width: 10 },
        { header: '불량', value: (row) => row.defectQuantity, width: 10 },
        { header: '비고', value: (row) => row.note, width: 24 },
      ],
    })
  }

  if (!result.ok) {
    return <PostProcessHistoryFetchError result={result} />
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          subtitle="후공정 생산입력에서 등록된 조립제품 세트 실적을 최신순으로 보여줍니다. 행을 클릭하면 삭제할 수 있습니다."
          totalCount={rows.length}
          filteredCount={filtered.length}
          hasQuery={hasActiveFilter}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="발주ID, 고객사, 조립제품명, 기록일 검색…"
          accent="emerald"
          inlineFilters={
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              label="기록일"
            />
          }
          actions={
            <ExcelDownloadButton onDownload={handleExcelDownload} disabled={!filtered.length} />
          }
        />

        <PostProcessHistoryTable
          rows={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '등록된 후공정 생산 이력이 없습니다',
            actionHint: '생산입력에서 등록하세요',
          })}
          onRowClick={openDetail}
        />
      </PageShell>

      <PostProcessHistoryModal
        open={modal.open}
        row={modal.open ? modal.row : null}
        onClose={closeModal}
        onDeleted={handleDeleted}
      />
    </>
  )
}
