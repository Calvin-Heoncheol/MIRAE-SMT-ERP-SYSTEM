'use client'

import { useMemo, useState } from 'react'
import { OrderListTable } from '@/components/orders/order-list-table'
import { OrderModal } from '@/components/orders/order-modal'
import { OrderFetchError } from '@/components/orders/order-fetch-error'
import { ErpButton } from '@/components/ui/erp-button'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { downloadExcel } from '@/lib/excel/export'
import {
  buildOrderLineExportRows,
  ORDER_LINE_EXPORT_COLUMNS,
} from '@/lib/orders/export-excel'
import type { FetchOrdersResult } from '@/lib/orders/repository'
import type { OrderListGroup } from '@/lib/orders/types'
import { filterOrdersForSearch, todayYmdSeoul } from '@/lib/orders/utils'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type OrdersListWorkspaceProps = {
  result: FetchOrdersResult
  /** KPI「오늘 신규 주문」클릭 시 filter=today */
  initialFilter?: string
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; order: OrderListGroup }

export function OrdersListWorkspace({
  result,
  initialFilter = '',
}: OrdersListWorkspaceProps) {
  const { afterSave, afterDelete } = useSaveFeedback()
  const [search, setSearch] = useState('')
  /** KPI 카드로 진입했을 때만 오늘 발주일 필터 (칩 UI 없음) */
  const [kpiTodayOnly] = useState(initialFilter === 'today')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const orders = result.ok ? result.orders : []
  const today = todayYmdSeoul()

  const scopedOrders = useMemo(() => {
    if (!kpiTodayOnly) return orders
    return orders.filter((order) => order.orderDate === today)
  }, [orders, kpiTodayOnly, today])

  const query = search.trim()
  const filtered = useMemo(
    () => filterOrdersForSearch(scopedOrders, query),
    [scopedOrders, query],
  )
  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(order: OrderListGroup) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', order })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleSaved(message?: string) {
    afterSave(message ?? '발주서가 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '발주서가 삭제되었습니다.', { close: closeModal })
  }

  async function handleExcelDownload() {
    await downloadExcel({
      fileName: '발주서',
      sheetName: '발주서',
      columns: ORDER_LINE_EXPORT_COLUMNS,
      rows: buildOrderLineExportRows(filtered),
    })
  }

  if (!result.ok) {
    return <OrderFetchError result={result} />
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="발주ID, 발주번호, 고객사, 제품명, 발주일 검색…"
          accent="slate"
          actions={
            <div className="flex items-center gap-2">
              <ExcelDownloadButton
                onDownload={handleExcelDownload}
                disabled={!filtered.length}
              />
              <ErpButton onClick={openCreate}>발주서 등록</ErpButton>
            </div>
          }
        />

        <OrderListTable
          orders={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query) || kpiTodayOnly,
            emptyLabel: kpiTodayOnly
              ? '오늘 등록된 발주서가 없습니다'
              : '등록된 발주서가 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectOrder={openEdit}
        />
      </PageShell>

      {modal.open ? (
        <OrderModal
          key={
            modal.mode === 'edit'
              ? `edit-${modal.order.orderNumber}-${modalSession}`
              : `create-${modalSession}`
          }
          open
          mode={modal.mode}
          order={modal.mode === 'edit' ? modal.order : null}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  )
}
