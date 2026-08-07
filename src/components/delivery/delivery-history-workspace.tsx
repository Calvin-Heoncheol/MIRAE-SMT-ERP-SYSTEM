'use client'

import { useMemo, useState } from 'react'
import { DeliveryHistoryFetchError } from '@/components/delivery/delivery-history-fetch-error'
import { DeliveryHistoryModal } from '@/components/delivery/delivery-history-modal'
import { DeliveryHistoryTable } from '@/components/delivery/delivery-history-table'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { ListPagination } from '@/components/ui/list-pagination'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { downloadExcel } from '@/lib/excel/export'
import type { FetchDeliveryHistoryResult } from '@/lib/delivery/repository'
import type { DeliveryHistoryRow } from '@/lib/delivery/types'
import {
  filterDeliveryHistory,
  formatDeliveryHistoryDateTime,
  formatShipmentRound,
} from '@/lib/delivery/history-utils'
import { hasDateRangeFilter } from '@/lib/ui/date-range'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type DeliveryHistoryWorkspaceProps = {
  result: FetchDeliveryHistoryResult
}

type ModalState =
  | { open: false }
  | { open: true; row: DeliveryHistoryRow }

export function DeliveryHistoryWorkspace({ result }: DeliveryHistoryWorkspaceProps) {
  const { afterSave, afterDelete } = useSaveFeedback()
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const rows = result.ok ? result.rows : []
  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate])
  const filtered = useMemo(
    () => filterDeliveryHistory(rows, search, dateRange),
    [rows, search, dateRange],
  )
  const pagination = useClientPagination(filtered)
  const hasActiveFilter = Boolean(search.trim()) || hasDateRangeFilter(dateRange)

  function openEdit(row: DeliveryHistoryRow) {
    setModalSession((value) => value + 1)
    setModal({ open: true, row })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleSaved(message?: string) {
    afterSave(message ?? '출하 이력이 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '출하 이력이 삭제되었습니다.', { close: closeModal })
  }

  async function handleExcelDownload() {
    await downloadExcel({
      fileName: '출하이력',
      sheetName: '출하이력',
      rows: filtered,
      columns: [
        { header: '출하번호', value: (row) => row.id, width: 18 },
        { header: '차수', value: (row) => formatShipmentRound(row.shipmentRound), width: 8 },
        { header: '출하일', value: (row) => row.recordDate, width: 12 },
        {
          header: '등록시각',
          value: (row) => formatDeliveryHistoryDateTime(row.createdAt),
          width: 16,
        },
        { header: '주문서번호', value: (row) => row.orderNumber, width: 22 },
        { header: '고객사', value: (row) => row.customer, width: 18 },
        { header: '조립제품명', value: (row) => row.productName, width: 26 },
        { header: '품목코드', value: (row) => row.productCode, width: 16 },
        { header: '주문수량', value: (row) => row.targetQuantity, width: 10 },
        { header: '출하수량', value: (row) => row.quantity, width: 10 },
        { header: '등록자', value: (row) => row.createdByName, width: 12 },
        { header: '비고', value: (row) => row.note, width: 24 },
      ],
    })
  }

  if (!result.ok) {
    return <DeliveryHistoryFetchError result={result} />
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          subtitle="출하에서 등록된 납품 실적을 최신순으로 보여줍니다. 같은 제품은 등록 순으로 1차·2차로 표시되며, 행을 클릭하면 수정·거래명세서 출력이 가능합니다."
          totalCount={rows.length}
          filteredCount={filtered.length}
          hasQuery={hasActiveFilter}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="출하번호, 주문서번호, 고객사, 조립제품명, 기록일 검색…"
          accent="sky"
          inlineFilters={
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              label="출하일"
            />
          }
          actions={
            <ExcelDownloadButton onDownload={handleExcelDownload} disabled={!filtered.length} />
          }
        />

        <DeliveryHistoryTable
          rows={pagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '등록된 출하 이력이 없습니다',
            actionHint: '출하 메뉴에서 등록하세요',
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
      </PageShell>

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
