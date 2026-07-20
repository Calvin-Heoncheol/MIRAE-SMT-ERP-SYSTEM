'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OrderListTable } from '@/components/orders/order-list-table'
import { OrderModal } from '@/components/orders/order-modal'
import { OrderFetchError } from '@/components/orders/order-fetch-error'
import { ErpButton } from '@/components/ui/erp-button'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchOrdersResult } from '@/lib/orders/repository'
import type { OrderListGroup } from '@/lib/orders/types'
import { filterOrdersForSearch } from '@/lib/orders/utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type OrdersListWorkspaceProps = {
  result: FetchOrdersResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; order: OrderListGroup }

export function OrdersListWorkspace({ result }: OrdersListWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const orders = result.ok ? result.orders : []
  const query = search.trim()
  const filtered = useMemo(() => filterOrdersForSearch(orders, query), [orders, query])
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
      <div className="flex w-full flex-1 flex-col gap-4">
        <WorkspaceHeader
          title="주문서"
          totalCount={orders.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(query)}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="주문번호, 고객사, 제품명, 주문일 검색…"
          accent="slate"
          actions={<ErpButton onClick={openCreate}>주문서 등록</ErpButton>}
        />

        <OrderListTable
          orders={pagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query),
            emptyLabel: '등록된 주문서가 없습니다',
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
