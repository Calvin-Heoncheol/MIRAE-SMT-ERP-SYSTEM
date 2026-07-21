'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { InboundFetchError } from '@/components/materials/inbound/inbound-fetch-error'
import { InboundListTable } from '@/components/materials/inbound/inbound-list-table'
import { InboundModal } from '@/components/materials/inbound/inbound-modal'
import { InboundPendingOrdersTable } from '@/components/materials/inbound/inbound-pending-orders-table'
import { InboundScanPanel } from '@/components/materials/inbound/inbound-scan-panel'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { ListPagination } from '@/components/ui/list-pagination'
import type { FetchMaterialInboundPageResult } from '@/lib/materials/inbound/repository'
import type { MaterialInboundListGroup } from '@/lib/materials/inbound/types'
import { filterPurchaseOrdersWithRemaining, getInboundTypeLabel } from '@/lib/materials/inbound/utils'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type InboundWorkspaceProps = {
  result: FetchMaterialInboundPageResult
  view: 'register' | 'history'
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; seedPurchaseOrderId?: string }
  | { open: true; mode: 'edit'; inbound: MaterialInboundListGroup }

function matchesQuery(inbound: MaterialInboundListGroup, query: string) {
  if (!query) return true

  const haystack = [
    inbound.inboundNumber,
    inbound.purchaseOrderNumber || '',
    inbound.note,
    getInboundTypeLabel(inbound.inboundType),
    ...inbound.items.flatMap((item) => [item.materialCode, item.materialName, item.mpn]),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function matchesPurchaseOrderQuery(order: MaterialPurchaseOrderListGroup, query: string) {
  if (!query) return true
  const haystack = [
    order.orderNumber,
    order.supplier,
    ...order.items.flatMap((item) => [item.materialCode, item.materialName, item.mpn]),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function InboundWorkspace({ result, view }: InboundWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const inbounds = result.ok ? result.inbounds : []
  const purchaseOrders = result.ok ? result.purchaseOrders : []
  const query = search.trim().toLowerCase()

  const pendingOrders = useMemo(
    () => filterPurchaseOrdersWithRemaining(purchaseOrders),
    [purchaseOrders],
  )
  const filteredPendingOrders = useMemo(
    () => pendingOrders.filter((order) => matchesPurchaseOrderQuery(order, query)),
    [pendingOrders, query],
  )

  const filtered = useMemo(
    () => inbounds.filter((inbound) => matchesQuery(inbound, query)),
    [inbounds, query],
  )
  const cardsPagination = useClientPagination(filteredPendingOrders)
  const pagination = useClientPagination(filtered)

  function openCreate(seedPurchaseOrderId?: string) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create', seedPurchaseOrderId })
  }

  function openEdit(inbound: MaterialInboundListGroup) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', inbound })
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
    return <InboundFetchError result={result} />
  }

  const modalNode = modal.open ? (
    <InboundModal
      key={
        modal.mode === 'edit'
          ? `edit-${modal.inbound.inboundId}-${modalSession}`
          : `create-${modalSession}`
      }
      open
      mode={modal.mode}
      inbound={modal.mode === 'edit' ? modal.inbound : null}
      seedPurchaseOrderId={modal.mode === 'create' ? modal.seedPurchaseOrderId : undefined}
      materials={result.materials}
      purchaseOrders={result.purchaseOrders}
      onClose={closeModal}
      onSaved={handleSaved}
      onDeleted={handleDeleted}
      onMaterialsChanged={() => router.refresh()}
    />
  ) : null

  if (view === 'register') {
    return (
      <>
        <div className="flex w-full flex-1 flex-col gap-4">
          <InboundScanPanel
            materials={result.materials}
            purchaseOrders={result.purchaseOrders}
            onSaved={() => router.refresh()}
            onMaterialsChanged={() => router.refresh()}
          />

          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-bold text-slate-800">
              입고 대기 발주{' '}
              <span className="tabular-nums font-semibold text-blue-700">
                {pendingOrders.length.toLocaleString('ko-KR')}
              </span>
              건
            </h3>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="발주번호, 공급사, 자재명, MPN 검색…"
              className="ml-auto w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <InboundPendingOrdersTable
            orders={cardsPagination.pageItems}
            emptyMessage={formatEmptyListMessage({
              hasQuery: Boolean(query),
              emptyLabel: '입고 잔량이 남은 발주가 없습니다',
              actionHint: '발주등록 탭에서 발주를 등록하세요',
            })}
            onInboundClick={(order) => openCreate(order.orderId)}
          />

          <ListPagination
            page={cardsPagination.page}
            totalPages={cardsPagination.totalPages}
            onPageChange={cardsPagination.setPage}
            rangeStart={cardsPagination.rangeStart}
            rangeEnd={cardsPagination.rangeEnd}
            totalCount={cardsPagination.totalCount}
          />
        </div>

        {modalNode}
      </>
    )
  }

  return (
    <>
      <div className="flex w-full flex-1 flex-col gap-4">
        <WorkspaceHeader
          totalCount={inbounds.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(query)}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="입고번호, 발주번호, 자재명, 자재코드 검색…"
          accent="blue"
        />

        <InboundListTable
          inbounds={pagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query),
            emptyLabel: '등록된 입고 내역이 없습니다',
            actionHint: '입고등록 탭에서 등록하세요',
          })}
          onSelectInbound={openEdit}
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

      {modalNode}
    </>
  )
}
