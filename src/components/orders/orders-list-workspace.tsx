'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OrderListTable } from '@/components/orders/order-list-table'
import { OrderModal } from '@/components/orders/order-modal'
import { OrderFetchError } from '@/components/orders/order-fetch-error'
import { ErpButton } from '@/components/ui/erp-button'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchOrdersResult } from '@/lib/orders/repository'
import type { OrderListGroup } from '@/lib/orders/types'
import { filterOrdersForSearch, todayYmdSeoul } from '@/lib/orders/utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
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

  function handleSaved() {
    closeModal()
    router.refresh()
  }

  function handleDeleted() {
    closeModal()
    router.refresh()
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
          actions={<ErpButton onClick={openCreate}>주문서 등록</ErpButton>}
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
