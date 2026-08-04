'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OrderListTable } from '@/components/orders/order-list-table'
import { OrderModal } from '@/components/orders/order-modal'
import { OrderFetchError } from '@/components/orders/order-fetch-error'
import { ErpButton } from '@/components/ui/erp-button'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { downloadExcelSheets } from '@/lib/excel/export'
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

type OrderStatusFilter = 'active' | 'done' | 'all'

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; order: OrderListGroup }

type OrderLineExcelRow = {
  order: OrderListGroup
  item: OrderLineItem
}

function resolveStatusFilter(value: string | undefined): OrderStatusFilter {
  if (value === 'active' || value === 'done' || value === 'all') return value
  return 'active'
}

export function OrdersListWorkspace({
  result,
  completedOrderIds,
  initialFilter = '',
}: OrdersListWorkspaceProps) {
  const router = useRouter()
  const { afterSave, afterDelete } = useSaveFeedback()
  const [search, setSearch] = useState('')
  /** KPI 카드로 진입했을 때만 오늘 주문일 필터 (칩 UI 없음) */
  const [kpiTodayOnly, setKpiTodayOnly] = useState(initialFilter === 'today')
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>(() =>
    resolveStatusFilter(initialFilter === 'today' ? 'all' : initialFilter),
  )
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const orders = result.ok ? result.orders : []
  const completedSet = useMemo(() => new Set(completedOrderIds), [completedOrderIds])
  const today = todayYmdSeoul()

  const statusFiltered = useMemo(() => {
    if (kpiTodayOnly) {
      return orders.filter((order) => order.orderDate === today)
    }
    if (statusFilter === 'all') return orders
    if (statusFilter === 'done') return orders.filter((order) => completedSet.has(order.orderId))
    return orders.filter((order) => !completedSet.has(order.orderId))
  }, [orders, completedSet, statusFilter, kpiTodayOnly, today])

  const query = search.trim()
  const filtered = useMemo(
    () => filterOrdersForSearch(statusFiltered, query),
    [statusFiltered, query],
  )
  const pagination = useClientPagination(filtered)

  const doneCount = useMemo(
    () => orders.filter((order) => completedSet.has(order.orderId)).length,
    [orders, completedSet],
  )

  const statusChips: {
    value: OrderStatusFilter
    label: string
    count: number
    tone?: (typeof STATUS_FILTER_TONES)[keyof typeof STATUS_FILTER_TONES]
  }[] = [
    {
      value: 'active',
      label: '진행중',
      count: orders.length - doneCount,
      tone: STATUS_FILTER_TONES.progress,
    },
    { value: 'done', label: '완료', count: doneCount, tone: STATUS_FILTER_TONES.done },
    { value: 'all', label: '전체', count: orders.length },
  ]

  function changeStatusFilter(next: OrderStatusFilter) {
    setKpiTodayOnly(false)
    setStatusFilter(next)
    const url = next === 'active' ? '/orders' : `/orders?filter=${next}`
    router.replace(url, { scroll: false })
  }

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

    await downloadExcelSheets({
      fileName: '주문서',
      sheets: [
        {
          sheetName: '주문서',
          rows: filtered,
          columns: [
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
          ],
        },
        {
          sheetName: '품목',
          rows: lineRows,
          columns: [
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
          ],
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
          title="주문서"
          totalCount={orders.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(query) || kpiTodayOnly}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="주문번호, 고객사, 제품명, 주문일 검색…"
          accent="slate"
          filters={
            <FilterChipBar
              options={statusChips}
              value={kpiTodayOnly ? null : statusFilter}
              onChange={changeStatusFilter}
            />
          }
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
              : statusFilter === 'done'
                ? '출하 완료된 주문서가 없습니다'
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
