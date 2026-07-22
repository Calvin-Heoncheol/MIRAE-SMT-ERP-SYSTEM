'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductionHistoryModal } from '@/components/production-history/production-history-modal'
import { ProductionHistoryTable } from '@/components/production-history/production-history-table'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { ListPagination } from '@/components/ui/list-pagination'
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
  sumProductionHistoryQuantity,
} from '@/lib/production-history/utils'
import { formatSmtPcbSideLabel } from '@/lib/smt/history-utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import {
  ERP_FILTER_CHIP_ACTIVE_CLASS,
  ERP_FILTER_CHIP_IDLE_CLASS,
  formatEmptyListMessage,
} from '@/lib/ui/tokens'

type ProductionHistoryWorkspaceProps = {
  result: FetchProductionHistoryResult
}

type ModalState = { open: false } | { open: true; row: ProductionHistoryRow }

const TEAM_FILTER_OPTIONS: { value: ProductionHistoryTeamFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  ...PRODUCTION_HISTORY_TEAMS.map((team) => ({ value: team, label: team })),
]

export function ProductionHistoryWorkspace({ result }: ProductionHistoryWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [teamFilter, setTeamFilter] = useState<ProductionHistoryTeamFilter>('all')
  const [modal, setModal] = useState<ModalState>({ open: false })

  const rows = result.ok ? result.rows : []
  const filtered = useMemo(
    () => filterProductionHistory(rows, search, teamFilter),
    [rows, search, teamFilter],
  )
  const totalQuantity = useMemo(() => sumProductionHistoryQuantity(filtered), [filtered])
  const pagination = useClientPagination(filtered)
  const hasActiveFilter = Boolean(search.trim()) || teamFilter !== 'all'
  const showSmtColumns = teamFilter === 'all' || teamFilter === '생산1팀'

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
        { header: '기록일', value: (row) => row.recordDate, width: 12 },
        { header: '팀', value: (row) => row.team, width: 10 },
        { header: '주문서번호', value: (row) => row.orderNumber, width: 22 },
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
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-800">
          <p className="font-semibold">생산이력을 불러오지 못했습니다.</p>
          <p className="mt-2 text-rose-700">{result.detail}</p>
        </div>
      </PageShell>
    )
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          totalCount={rows.length}
          filteredCount={filtered.length}
          hasQuery={hasActiveFilter}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="주문서번호, 고객사, 제품명, 팀, 기록일 검색…"
          accent="slate"
          filters={
            <div className="flex flex-wrap gap-2">
              {TEAM_FILTER_OPTIONS.map((option) => {
                const active = teamFilter === option.value
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => setTeamFilter(option.value)}
                    className={[
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                      active ? ERP_FILTER_CHIP_ACTIVE_CLASS : ERP_FILTER_CHIP_IDLE_CLASS,
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          }
          actions={
            <ExcelDownloadButton onDownload={handleExcelDownload} disabled={!filtered.length} />
          }
          meta={
            <p className="mt-0.5 text-slate-500">
              양품 합계{' '}
              <span className="tabular-nums font-semibold text-slate-800">
                {totalQuantity.toLocaleString('ko-KR')}
              </span>
            </p>
          }
        />

        <ProductionHistoryTable
          rows={pagination.pageItems}
          showSmtColumns={showSmtColumns}
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '등록된 생산 이력이 없습니다',
            actionHint: '각 팀 생산입력에서 등록하세요',
          })}
          onRowClick={openDetail}
        />

        <ListPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
          rangeStart={pagination.rangeStart}
          rangeEnd={pagination.rangeEnd}
          totalCount={pagination.totalCount}
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
