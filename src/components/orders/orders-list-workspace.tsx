'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OrderListTable } from '@/components/orders/order-list-table'
import { OrderModal } from '@/components/orders/order-modal'
import { OrderFetchError } from '@/components/orders/order-fetch-error'
import type { FetchOrdersResult } from '@/lib/orders/repository'
import type { OrderListGroup } from '@/lib/orders/types'
import { filterOrdersForSearch } from '@/lib/orders/utils'

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
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">주문서</h1>
            <p className="mt-1 text-sm text-slate-500">주문서 목록을 확인하고 신규 주문을 등록합니다.</p>
          </div>
          <p className="text-sm font-medium text-slate-600">
            총 <span className="tabular-nums text-slate-900">{filtered.length.toLocaleString('ko-KR')}</span>건
            {query ? (
              <span className="text-slate-400"> / {orders.length.toLocaleString('ko-KR')}건</span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="주문번호, 고객사, 제품명, 주문일 검색…"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-slate-100 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2"
          />
          <div className="ml-auto shrink-0">
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
            >
              주문서 등록
            </button>
          </div>
        </div>

        <OrderListTable
          orders={filtered}
          emptyMessage={query ? '검색 결과가 없습니다' : '등록된 주문서가 없습니다'}
          onSelectOrder={openEdit}
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
