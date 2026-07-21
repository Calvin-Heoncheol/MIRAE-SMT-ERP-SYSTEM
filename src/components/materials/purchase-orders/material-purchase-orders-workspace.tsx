'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { MaterialPurchaseOrderFetchError } from '@/components/materials/purchase-orders/material-purchase-order-fetch-error'
import { MaterialPurchaseOrderListTable } from '@/components/materials/purchase-orders/material-purchase-order-list-table'
import { MaterialPurchaseOrderModal } from '@/components/materials/purchase-orders/material-purchase-order-modal'
import { MaterialPurchaseSuggestionTable } from '@/components/materials/purchase-orders/material-purchase-suggestion-table'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { ListPagination } from '@/components/ui/list-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import type { MaterialPurchaseOrderItemForm } from '@/lib/materials/purchase-orders/form-state'
import type {
  FetchMaterialPurchaseHistoryResult,
  FetchMaterialPurchaseRegisterResult,
} from '@/lib/materials/purchase-orders/repository'
import type {
  MaterialPurchaseOrderListGroup,
  MaterialPurchaseSuggestionLine,
} from '@/lib/materials/purchase-orders/types'

type MaterialPurchaseOrdersWorkspaceProps =
  | { view: 'register'; result: FetchMaterialPurchaseRegisterResult }
  | { view: 'history'; result: FetchMaterialPurchaseHistoryResult }

type CreateModalState =
  | { open: false }
  | {
      open: true
      initialItems?: MaterialPurchaseOrderItemForm[] | null
      initialSupplier?: string
    }

type EditModalState =
  | { open: false }
  | { open: true; order: MaterialPurchaseOrderListGroup }

function matchesSuggestionLine(line: MaterialPurchaseSuggestionLine, query: string) {
  if (!query) return true
  const haystack = [line.materialId, line.materialName, line.specification, line.mpn, line.supplier]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function matchesPurchaseOrder(order: MaterialPurchaseOrderListGroup, query: string) {
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

export function MaterialPurchaseOrdersWorkspace(props: MaterialPurchaseOrdersWorkspaceProps) {
  const router = useRouter()
  const [createModal, setCreateModal] = useState<CreateModalState>({ open: false })
  const [editModal, setEditModal] = useState<EditModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)
  const [search, setSearch] = useState('')

  const suggestionLines =
    props.view === 'register' && props.result.ok ? props.result.suggestionLines : []
  const purchaseOrders = props.view === 'history' && props.result.ok ? props.result.orders : []
  const query = search.trim().toLowerCase()

  const filteredSuggestions = useMemo(
    () => suggestionLines.filter((line) => matchesSuggestionLine(line, query)),
    [suggestionLines, query],
  )

  const filteredPurchaseOrders = useMemo(
    () => purchaseOrders.filter((order) => matchesPurchaseOrder(order, query)),
    [purchaseOrders, query],
  )
  const ordersPagination = useClientPagination(filteredPurchaseOrders)

  function openCreate(seed?: { items?: MaterialPurchaseOrderItemForm[]; supplier?: string }) {
    setModalSession((value) => value + 1)
    setCreateModal({
      open: true,
      initialItems: seed?.items || null,
      initialSupplier: seed?.supplier || '',
    })
  }

  function openEdit(order: MaterialPurchaseOrderListGroup) {
    setModalSession((value) => value + 1)
    setEditModal({ open: true, order })
  }

  function handleCreateSuggestionOrder(items: MaterialPurchaseOrderItemForm[], supplier: string) {
    if (!items.length) return
    openCreate({ items, supplier })
  }

  function handleSaved() {
    setCreateModal({ open: false })
    setEditModal({ open: false })
    router.refresh()
  }

  function handleDeleted() {
    setEditModal({ open: false })
    router.refresh()
  }

  if (!props.result.ok) {
    return <MaterialPurchaseOrderFetchError result={props.result} />
  }

  if (props.view === 'register') {
    return (
      <>
        <div className="flex w-full flex-1 flex-col gap-4">
          <WorkspaceHeader
            totalCount={suggestionLines.length}
            filteredCount={filteredSuggestions.length}
            hasQuery={Boolean(query)}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="자재코드, 자재명, MPN, 공급사 검색…"
            accent="violet"
            meta={
              <p className="mt-0.5 text-slate-500">
                발주필요{' '}
                <span className="tabular-nums font-semibold text-rose-600">
                  {suggestionLines.length.toLocaleString('ko-KR')}
                </span>
                종
              </p>
            }
          />

          <MaterialPurchaseSuggestionTable
            lines={filteredSuggestions}
            onCreateOrder={handleCreateSuggestionOrder}
          />
        </div>

        {createModal.open ? (
          <MaterialPurchaseOrderModal
            key={`create-${modalSession}`}
            open
            mode="create"
            initialItems={createModal.initialItems}
            initialSupplier={createModal.initialSupplier}
            onClose={() => setCreateModal({ open: false })}
            onSaved={handleSaved}
          />
        ) : null}
      </>
    )
  }

  return (
    <>
      <div className="flex w-full flex-1 flex-col gap-4">
        <WorkspaceHeader
          totalCount={purchaseOrders.length}
          filteredCount={filteredPurchaseOrders.length}
          hasQuery={Boolean(query)}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="발주번호, 공급사, 자재명, MPN 검색…"
          accent="violet"
        />

        <MaterialPurchaseOrderListTable
          orders={ordersPagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query),
            emptyLabel: '등록된 자재 발주가 없습니다',
            actionHint: '발주등록 탭에서 등록하세요',
          })}
          onSelectOrder={openEdit}
        />

        <ListPagination
          page={ordersPagination.page}
          totalPages={ordersPagination.totalPages}
          onPageChange={ordersPagination.setPage}
          rangeStart={ordersPagination.rangeStart}
          rangeEnd={ordersPagination.rangeEnd}
          totalCount={ordersPagination.totalCount}
        />
      </div>

      {editModal.open ? (
        <MaterialPurchaseOrderModal
          key={`edit-${editModal.order.orderNumber}-${modalSession}`}
          open
          mode="edit"
          order={editModal.order}
          onClose={() => setEditModal({ open: false })}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  )
}
