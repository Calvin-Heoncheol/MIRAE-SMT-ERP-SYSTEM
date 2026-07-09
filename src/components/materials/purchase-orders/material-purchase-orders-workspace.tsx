'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { MaterialPurchaseOrderFetchError } from '@/components/materials/purchase-orders/material-purchase-order-fetch-error'
import { MaterialPurchaseOrderListTable } from '@/components/materials/purchase-orders/material-purchase-order-list-table'
import { MaterialPurchaseOrderModal } from '@/components/materials/purchase-orders/material-purchase-order-modal'
import type { FetchMaterialPurchaseOrdersResult } from '@/lib/materials/purchase-orders/repository'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'

type MaterialPurchaseOrdersWorkspaceProps = {
  result: FetchMaterialPurchaseOrdersResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; order: MaterialPurchaseOrderListGroup }

function matchesQuery(order: MaterialPurchaseOrderListGroup, query: string) {
  if (!query) return true
  const haystack = [
    order.orderNumber,
    order.supplier,
    ...order.items.flatMap((item) => [item.materialName, item.materialCode, item.mpn, item.specification]),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function MaterialPurchaseOrdersWorkspace({ result }: MaterialPurchaseOrdersWorkspaceProps) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)
  const [search, setSearch] = useState('')

  const orders = result.ok ? result.orders : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () => orders.filter((order) => matchesQuery(order, query)),
    [orders, query],
  )

  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(order: MaterialPurchaseOrderListGroup) {
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">자재 발주</h1>
            <p className="mt-1 text-sm text-slate-500">자재 발주를 등록하고 공급업체별 발주 내역을 관리합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {result.ok ? (
              <p className="text-sm font-medium text-slate-600">
                총{' '}
                <span className="tabular-nums text-violet-700">
                  {filtered.length.toLocaleString('ko-KR')}
                </span>
                건
                {query ? (
                  <span className="text-slate-400"> / {orders.length.toLocaleString('ko-KR')}건</span>
                ) : null}
              </p>
            ) : null}
            <button
              type="button"
              onClick={openCreate}
              disabled={!result.ok}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + 신규 발주
            </button>
          </div>
        </div>

        {result.ok ? (
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="발주번호, 공급업체, 자재명, CPN, MPN 검색…"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-violet-100 placeholder:text-slate-400 focus:border-violet-300 focus:ring-2"
          />
        ) : null}

        {!result.ok ? (
          <MaterialPurchaseOrderFetchError result={result} />
        ) : (
          <MaterialPurchaseOrderListTable
            orders={filtered}
            emptyMessage={query ? '검색 결과가 없습니다' : '등록된 자재 발주가 없습니다'}
            onSelectOrder={openEdit}
          />
        )}
      </div>

      {modal.open ? (
        <MaterialPurchaseOrderModal
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
