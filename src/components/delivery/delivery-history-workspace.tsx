'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DeliveryHistoryFetchError } from '@/components/delivery/delivery-history-fetch-error'
import { DeliveryHistoryModal } from '@/components/delivery/delivery-history-modal'
import { DeliveryHistoryTable } from '@/components/delivery/delivery-history-table'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { downloadExcel } from '@/lib/excel/export'
import type { FetchDeliveryHistoryResult } from '@/lib/delivery/repository'
import type { DeliveryHistoryRow } from '@/lib/delivery/types'
import {
  filterDeliveryHistory,
  formatDeliveryHistoryDateTime,
  sumDeliveryHistoryQuantity,
} from '@/lib/delivery/history-utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type DeliveryHistoryWorkspaceProps = {
  result: FetchDeliveryHistoryResult
}

type ModalState =
  | { open: false }
  | { open: true; row: DeliveryHistoryRow }

export function DeliveryHistoryWorkspace({ result }: DeliveryHistoryWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const rows = result.ok ? result.rows : []
  const filtered = useMemo(() => filterDeliveryHistory(rows, search), [rows, search])
  const totalQuantity = useMemo(() => sumDeliveryHistoryQuantity(filtered), [filtered])
  const pagination = useClientPagination(filtered)

  function openEdit(row: DeliveryHistoryRow) {
    setModalSession((value) => value + 1)
    setModal({ open: true, row })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleSaved() {
    closeModal()
    router.refresh()
  }

  function handleDeleted() {
    closeModal()
    router.refresh()
  }

  async function handleExcelDownload() {
    await downloadExcel({
      fileName: '출하이력',
      sheetName: '출하이력',
      rows: filtered,
      columns: [
        { header: '출하번호', value: (row) => row.id, width: 18 },
        { header: '출하일', value: (row) => row.recordDate, width: 12 },
        {
          header: '등록시각',
          value: (row) => formatDeliveryHistoryDateTime(row.createdAt),
          width: 16,
        },
        { header: '주문서번호', value: (row) => row.orderNumber, width: 22 },
        { header: '고객사', value: (row) => row.customer, width: 18 },
        { header: '완제품명', value: (row) => row.productName, width: 26 },
        { header: '품목코드', value: (row) => row.productCode, width: 16 },
        { header: '주문수량', value: (row) => row.targetQuantity, width: 10 },
        { header: '출하수량', value: (row) => row.quantity, width: 10 },
        { header: '비고', value: (row) => row.note, width: 24 },
      ],
    })
  }

  if (!result.ok) {
    return <DeliveryHistoryFetchError result={result} />
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <WorkspaceHeader
          subtitle="출하입력에서 등록된 납품 실적을 최신순으로 보여줍니다. 행을 클릭하면 수정·거래명세서 출력이 가능합니다."
          totalCount={rows.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(search.trim())}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="출하번호, 주문서번호, 고객사, 완제품명, 기록일 검색…"
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

        <DeliveryHistoryTable
          rows={pagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(search.trim()),
            emptyLabel: '등록된 출하 이력이 없습니다',
            actionHint: '출하입력에서 등록하세요',
          })}
          onRowClick={openEdit}
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

      {modal.open ? (
        <DeliveryHistoryModal
          key={`${modal.row.id}-${modalSession}`}
          open
          row={modal.row}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  )
}
