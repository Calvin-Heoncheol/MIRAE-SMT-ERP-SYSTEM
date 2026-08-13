'use client'

import { useMemo, useState } from 'react'
import { MaterialPurchaseOrderFetchError } from '@/components/materials/purchase-orders/material-purchase-order-fetch-error'
import { MaterialPurchaseOrderListTable } from '@/components/materials/purchase-orders/material-purchase-order-list-table'
import { MaterialPurchaseOrderModal } from '@/components/materials/purchase-orders/material-purchase-order-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { FilterChipBar } from '@/components/ui/filter-chip'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import type { FetchMaterialPurchaseOrdersResult } from '@/lib/materials/purchase-orders/repository'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import {
  resolveMaterialPurchaseInboundStatus,
  type MaterialPurchaseInboundStatus,
} from '@/lib/materials/purchase-orders/utils'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type MaterialPurchaseOrdersListWorkspaceProps = {
  result: FetchMaterialPurchaseOrdersResult
}

type StatusFilter = 'all' | MaterialPurchaseInboundStatus

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; order: MaterialPurchaseOrderListGroup }

function matchesPurchaseOrder(order: MaterialPurchaseOrderListGroup, query: string) {
  if (!query) return true
  const haystack = [
    order.orderNumber,
    order.supplier,
    order.sourceOrderId || '',
    ...order.items.flatMap((item) => [
      item.materialName,
      item.materialCode,
      item.mpn,
      item.specification,
    ]),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function MaterialPurchaseOrdersListWorkspace({
  result,
}: MaterialPurchaseOrdersListWorkspaceProps) {
  const { afterSave, afterDelete } = useSaveFeedback()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const purchaseOrders = result.ok ? result.orders : []
  const query = search.trim().toLowerCase()

  const statusCounts = useMemo(() => {
    const counts = { all: purchaseOrders.length, none: 0, partial: 0, done: 0 }
    for (const item of purchaseOrders) {
      counts[resolveMaterialPurchaseInboundStatus(item)] += 1
    }
    return counts
  }, [purchaseOrders])

  const filtered = useMemo(
    () =>
      purchaseOrders.filter((order) => {
        if (!matchesPurchaseOrder(order, query)) return false
        if (statusFilter === 'all') return true
        return resolveMaterialPurchaseInboundStatus(order) === statusFilter
      }),
    [purchaseOrders, query, statusFilter],
  )

  const statusChips = useMemo(
    () => [
      { value: 'all' as const, label: '전체', count: statusCounts.all },
      { value: 'none' as const, label: '미입고', count: statusCounts.none },
      { value: 'partial' as const, label: '부분입고', count: statusCounts.partial },
      { value: 'done' as const, label: '입고완료', count: statusCounts.done },
    ],
    [statusCounts],
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

  function handleSaved(message?: string) {
    afterSave(message ?? '자재 발주가 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '자재 발주가 삭제되었습니다.', { close: closeModal })
  }

  if (!result.ok) {
    return <MaterialPurchaseOrderFetchError result={result} />
  }

  return (
    <>
      <PageShell>
        <div className="flex shrink-0 items-center justify-between gap-3">
          <h1 className="text-base font-bold text-slate-900">발주서 목록</h1>
        </div>

        <WorkspaceHeader
          title="발주서 목록"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="발주번호, 주문서, 공급사, 자재명, MPN 검색…"
          accent="slate"
          actions={<ErpButton onClick={openCreate}>새 자재 발주</ErpButton>}
          filters={
            <FilterChipBar
              options={statusChips}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          }
        />

        <MaterialPurchaseOrderListTable
          orders={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query) || statusFilter !== 'all',
            emptyLabel: '등록된 발주서가 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectOrder={openEdit}
        />
      </PageShell>

      {modal.open && modal.mode === 'create' ? (
        <MaterialPurchaseOrderModal
          key={`create-${modalSession}`}
          open
          mode="create"
          onClose={closeModal}
          onSaved={handleSaved}
        />
      ) : null}

      {modal.open && modal.mode === 'edit' ? (
        <MaterialPurchaseOrderModal
          key={`edit-${modal.order.orderNumber}-${modalSession}`}
          open
          mode="edit"
          order={modal.order}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  )
}
