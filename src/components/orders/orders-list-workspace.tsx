'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { OrderListTable } from '@/components/orders/order-list-table'
import { OrderModal } from '@/components/orders/order-modal'
import { OrderFetchError } from '@/components/orders/order-fetch-error'
import type { FetchOrdersResult } from '@/lib/orders/repository'
import type { OrderListGroup } from '@/lib/orders/types'

type OrdersListWorkspaceProps = {
  result: FetchOrdersResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; order: OrderListGroup }

export function OrdersListWorkspace({ result }: OrdersListWorkspaceProps) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const orders = result.ok ? result.orders : []
  const existingOrderNumbers = orders.map((order) => order.orderNumber)

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

  return (
    <>
      <div className="flex min-h-[calc(100vh-60px)] w-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">주문서 목록</h1>
            <p className="mt-1 text-sm text-slate-500">주문서 목록을 확인하고 신규 주문을 등록합니다.</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            disabled={!result.ok}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + 신규 주문
          </button>
        </div>

        {!result.ok ? (
          <OrderFetchError result={result} />
        ) : (
          <OrderListTable
            orders={orders}
            emptyMessage="등록된 주문서가 없습니다"
            onSelectOrder={openEdit}
          />
        )}
      </div>

      {modal.open ? (
        <OrderModal
          key={modal.mode === 'edit' ? `edit-${modal.order.orderNumber}-${modalSession}` : `create-${modalSession}`}
          open
          mode={modal.mode}
          order={modal.mode === 'edit' ? modal.order : null}
          existingOrderNumbers={existingOrderNumbers}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  )
}
