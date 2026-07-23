'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { MaterialPurchaseOrderFetchError } from '@/components/materials/purchase-orders/material-purchase-order-fetch-error'
import { MaterialPurchaseOrderListTable } from '@/components/materials/purchase-orders/material-purchase-order-list-table'
import { MaterialPurchaseOrderModal } from '@/components/materials/purchase-orders/material-purchase-order-modal'
import { MaterialPurchaseSuggestionTable } from '@/components/materials/purchase-orders/material-purchase-suggestion-table'
import { FilterChipBar } from '@/components/ui/filter-chip'
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
import { getMaterialPurchaseSourceKind } from '@/lib/materials/purchase-orders/utils'

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

type HistorySourceFilter = 'all' | 'order' | 'material'

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
    order.sourceOrderId || '',
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
  const [sourceFilter, setSourceFilter] = useState<HistorySourceFilter>('all')

  const suggestionLines =
    props.view === 'register' && props.result.ok ? props.result.suggestionLines : []
  const purchaseOrders = props.view === 'history' && props.result.ok ? props.result.orders : []
  const query = search.trim().toLowerCase()

  const filteredSuggestions = useMemo(
    () => suggestionLines.filter((line) => matchesSuggestionLine(line, query)),
    [suggestionLines, query],
  )
  const suggestionsPagination = useClientPagination(filteredSuggestions)

  const sourceCounts = useMemo(() => {
    let order = 0
    let material = 0
    for (const item of purchaseOrders) {
      if (getMaterialPurchaseSourceKind(item) === 'order') order += 1
      else material += 1
    }
    return { all: purchaseOrders.length, order, material }
  }, [purchaseOrders])

  const filteredPurchaseOrders = useMemo(
    () =>
      purchaseOrders.filter((order) => {
        if (!matchesPurchaseOrder(order, query)) return false
        if (sourceFilter === 'all') return true
        return getMaterialPurchaseSourceKind(order) === sourceFilter
      }),
    [purchaseOrders, query, sourceFilter],
  )
  const ordersPagination = useClientPagination(filteredPurchaseOrders)

  const historyChips = useMemo(
    () => [
      { value: 'all' as const, label: '전체', count: sourceCounts.all },
      { value: 'order' as const, label: '주문서', count: sourceCounts.order },
      { value: 'material' as const, label: '자재별', count: sourceCounts.material },
    ],
    [sourceCounts],
  )

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
        <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
          <WorkspaceHeader
            totalCount={suggestionLines.length}
            filteredCount={filteredSuggestions.length}
            hasQuery={Boolean(query)}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="자재코드, 자재명, MPN, 공급사 검색…"
            accent="slate"
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

          <div className="min-h-0 flex-1 overflow-hidden">
            <MaterialPurchaseSuggestionTable
              lines={suggestionsPagination.pageItems}
              onCreateOrder={handleCreateSuggestionOrder}
            />
          </div>

          <ListPagination
            page={suggestionsPagination.page}
            totalPages={suggestionsPagination.totalPages}
            onPageChange={suggestionsPagination.setPage}
            rangeStart={suggestionsPagination.rangeStart}
            rangeEnd={suggestionsPagination.rangeEnd}
            totalCount={suggestionsPagination.totalCount}
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
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
        <WorkspaceHeader
          totalCount={purchaseOrders.length}
          filteredCount={filteredPurchaseOrders.length}
          hasQuery={Boolean(query) || sourceFilter !== 'all'}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="발주번호, 주문서, 공급사, 자재명, MPN 검색…"
          accent="slate"
          filters={
            <FilterChipBar
              options={historyChips}
              value={sourceFilter}
              onChange={setSourceFilter}
            />
          }
        />

        <MaterialPurchaseOrderListTable
          orders={ordersPagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query) || sourceFilter !== 'all',
            emptyLabel: '등록된 자재 발주가 없습니다',
            actionHint: '주문서 발주 또는 자재별 발주 탭에서 등록하세요',
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
