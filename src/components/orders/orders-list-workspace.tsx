'use client'

import { useMemo, useState } from 'react'
import { OrderListTable } from '@/components/orders/order-list-table'
import { OrderModal } from '@/components/orders/order-modal'
import { OrderFetchError } from '@/components/orders/order-fetch-error'
import { ErpButton } from '@/components/ui/erp-button'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { downloadExcelSheets, type ExcelColumn } from '@/lib/excel/export'
import type { FetchOrdersResult } from '@/lib/orders/repository'
import type { OrderLineItem, OrderListGroup } from '@/lib/orders/types'
import {
  filterOrdersForSearch,
  formatInternalCodeLabel,
  formatOrderDeliverySummary,
  formatProductSummary,
  todayYmdSeoul,
} from '@/lib/orders/utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type OrdersListWorkspaceProps = {
  result: FetchOrdersResult
  /** 모든 제품이 출하 완료된 주문 ID 목록 */
  completedOrderIds: string[]
  /** KPI「오늘 신규 주문」클릭 시 filter=today */
  initialFilter?: string
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; order: OrderListGroup }

type OrderLineExcelRow = {
  order: OrderListGroup
  item: OrderLineItem
}

export function OrdersListWorkspace({
  result,
  completedOrderIds,
  initialFilter = '',
}: OrdersListWorkspaceProps) {
  const { afterSave, afterDelete } = useSaveFeedback()
  const [search, setSearch] = useState('')
  /** KPI 카드로 진입했을 때만 오늘 주문일 필터 (칩 UI 없음) */
  const [kpiTodayOnly] = useState(initialFilter === 'today')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const orders = result.ok ? result.orders : []
  const completedSet = useMemo(() => new Set(completedOrderIds), [completedOrderIds])
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
  const pagination = useClientPagination(filtered)

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
    afterSave(message ?? '주문서가 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '주문서가 삭제되었습니다.', { close: closeModal })
  }

  async function handleExcelDownload() {
    const lineRows: OrderLineExcelRow[] = filtered.flatMap((order) =>
      order.items.map((item) => ({ order, item })),
    )

    const orderColumns: ExcelColumn<OrderListGroup>[] = [
      { header: '주문일', value: (row) => row.orderDate, width: 12 },
      {
        header: '납기일',
        value: (row) => formatOrderDeliverySummary(row),
        width: 14,
      },
      {
        header: '주문서번호',
        value: (row) => formatInternalCodeLabel(row.orderNumber),
        width: 18,
      },
      { header: '고객사', value: (row) => row.customer, width: 18 },
      {
        header: '제품',
        value: (row) => formatProductSummary(row),
        width: 28,
      },
      { header: '수량합계', value: (row) => row.totalQuantity, width: 10 },
      { header: '주문금액', value: (row) => row.totalAmount, width: 12 },
      { header: '구분', value: (row) => row.category, width: 8 },
      {
        header: '상태',
        value: (row) => (completedSet.has(row.orderId) ? '완료' : '진행중'),
        width: 8,
      },
      { header: '등록자', value: (row) => row.createdByName, width: 12 },
      { header: '비고', value: (row) => row.note, width: 24 },
    ]

    const lineColumns: ExcelColumn<OrderLineExcelRow>[] = [
      {
        header: '주문서번호',
        value: (row) => formatInternalCodeLabel(row.order.orderNumber),
        width: 18,
      },
      { header: '고객사', value: (row) => row.order.customer, width: 16 },
      { header: '주문일', value: (row) => row.order.orderDate, width: 12 },
      { header: '구분', value: (row) => row.order.category, width: 8 },
      { header: '품목코드', value: (row) => row.item.productCode, width: 16 },
      { header: '품목명', value: (row) => row.item.productName, width: 26 },
      { header: '수량', value: (row) => row.item.quantity, width: 10 },
      { header: '단가', value: (row) => row.item.unitPrice, width: 12 },
      { header: '금액', value: (row) => row.item.orderAmount, width: 12 },
      {
        header: '납기일',
        value: (row) => row.item.deliveryDate || row.order.deliveryDate,
        width: 12,
      },
    ]

    await downloadExcelSheets({
      fileName: '주문서',
      sheets: [
        {
          sheetName: '주문서',
          columns: orderColumns as ExcelColumn<unknown>[],
          rows: filtered as unknown[],
        },
        {
          sheetName: '품목',
          columns: lineColumns as ExcelColumn<unknown>[],
          rows: lineRows as unknown[],
        },
      ],
    })
  }

  if (!result.ok) {
    return <OrderFetchError result={result} />
  }

  return (
    <>
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
        <WorkspaceHeader
          title="주문서 등록"
          totalCount={orders.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(query) || kpiTodayOnly}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="주문번호, 고객사, 제품명, 주문일 검색…"
          accent="slate"
          actions={
            <div className="flex items-center gap-2">
              <ExcelDownloadButton
                onDownload={handleExcelDownload}
                disabled={!filtered.length}
              />
              <ErpButton onClick={openCreate}>주문서 등록</ErpButton>
            </div>
          }
        />

        <OrderListTable
          orders={pagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query) || kpiTodayOnly,
            emptyLabel: kpiTodayOnly
              ? '오늘 등록된 주문서가 없습니다'
              : '등록된 주문서가 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectOrder={openEdit}
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
