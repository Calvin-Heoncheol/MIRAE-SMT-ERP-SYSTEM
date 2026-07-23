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
import { filterOrdersForSearch } from '@/lib/orders/utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type OrdersListWorkspaceProps = {
  result: FetchOrdersResult
  /** 모든 제품이 출하 완료된 주문 ID 목록 */
  completedOrderIds: string[]
}

type OrderStatusFilter = 'active' | 'done' | 'all'

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; order: OrderListGroup }

export function OrdersListWorkspace({ result, completedOrderIds }: OrdersListWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>('active')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const orders = result.ok ? result.orders : []
  const completedSet = useMemo(() => new Set(completedOrderIds), [completedOrderIds])

  const statusFiltered = useMemo(() => {
    if (statusFilter === 'all') return orders
    if (statusFilter === 'done') return orders.filter((order) => completedSet.has(order.orderId))
    return orders.filter((order) => !completedSet.has(order.orderId))
  }, [orders, completedSet, statusFilter])

  const query = search.trim()
  const filtered = useMemo(() => filterOrdersForSearch(statusFiltered, query), [statusFiltered, query])
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
          hasQuery={Boolean(query)}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="주문번호, 고객사, 제품명, 주문일 검색…"
          accent="slate"
          filters={
            <FilterChipBar
              options={statusChips}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          }
          actions={<ErpButton onClick={openCreate}>주문서 등록</ErpButton>}
        />

        <OrderListTable
          orders={pagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query),
            emptyLabel:
              statusFilter === 'done'
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
          key={modal.mode === 'edit' ? `edit-${modal.order.orderNumber}-${modalSession}` : `create-${modalSession}`}
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
