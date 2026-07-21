'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SmtHistoryFetchError } from '@/components/smt/smt-history-fetch-error'
import { SmtHistoryModal } from '@/components/smt/smt-history-modal'
import { SmtHistoryTable } from '@/components/smt/smt-history-table'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { downloadExcel } from '@/lib/excel/export'
import type { FetchSmtProductionHistoryResult } from '@/lib/smt/repository'
import type { SmtProductionHistoryRow } from '@/lib/smt/types'
import {
  filterSmtProductionHistory,
  formatSmtHistoryDateTime,
  formatSmtPcbSideLabel,
  sumSmtHistoryQuantity,
} from '@/lib/smt/history-utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type SmtHistoryWorkspaceProps = {
  result: FetchSmtProductionHistoryResult
}

type ModalState = { open: false } | { open: true; row: SmtProductionHistoryRow }

export function SmtHistoryWorkspace({ result }: SmtHistoryWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })

  const rows = result.ok ? result.rows : []
  const filtered = useMemo(() => filterSmtProductionHistory(rows, search), [rows, search])
  const totalQuantity = useMemo(() => sumSmtHistoryQuantity(filtered), [filtered])
  const pagination = useClientPagination(filtered)

  function openDetail(row: SmtProductionHistoryRow) {
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
      fileName: 'SMT생산이력',
      sheetName: 'SMT 생산이력',
      rows: filtered,
      columns: [
        { header: '기록일', value: (row) => row.recordDate, width: 12 },
        { header: '등록시각', value: (row) => formatSmtHistoryDateTime(row.createdAt), width: 16 },
        { header: '주문서번호', value: (row) => row.orderNumber, width: 22 },
        { header: '고객사', value: (row) => row.customer, width: 18 },
        { header: '제품명', value: (row) => row.productName, width: 26 },
        { header: '품목코드', value: (row) => row.productCode, width: 16 },
        { header: '라인', value: (row) => (row.lineNo != null ? row.lineNo : ''), width: 8 },
        { header: '면구분', value: (row) => formatSmtPcbSideLabel(row.pcbSide), width: 10 },
        { header: '수량', value: (row) => row.quantity, width: 10 },
        { header: '비고', value: (row) => row.note, width: 24 },
      ],
    })
  }

  if (!result.ok) {
    return <SmtHistoryFetchError result={result} />
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <WorkspaceHeader
          totalCount={rows.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(search.trim())}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="주문서번호, 고객사, 제품명, 기록일 검색…"
          accent="sky"
          actions={
            <ExcelDownloadButton onDownload={handleExcelDownload} disabled={!filtered.length} />
          }
          meta={
            <p className="mt-0.5 text-slate-500">
              수량 합계{' '}
              <span className="tabular-nums font-semibold text-sky-800">
                {totalQuantity.toLocaleString('ko-KR')}
              </span>
            </p>
          }
        />

        <SmtHistoryTable
          rows={pagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(search.trim()),
            emptyLabel: '등록된 SMT 생산 이력이 없습니다',
            actionHint: '생산입력에서 등록하세요',
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
      </div>

      <SmtHistoryModal
        open={modal.open}
        row={modal.open ? modal.row : null}
        onClose={closeModal}
        onDeleted={handleDeleted}
      />
    </>
  )
}
