'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { MaterialPurchaseNeedCards } from '@/components/materials/purchase-orders/material-purchase-need-cards'
import { MaterialPurchaseNeedDetailModal } from '@/components/materials/purchase-orders/material-purchase-need-detail-modal'
import { MaterialPurchaseOrderFetchError } from '@/components/materials/purchase-orders/material-purchase-order-fetch-error'
import { MaterialPurchaseOrderListTable } from '@/components/materials/purchase-orders/material-purchase-order-list-table'
import { MaterialPurchaseOrderModal } from '@/components/materials/purchase-orders/material-purchase-order-modal'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { ListPagination } from '@/components/ui/list-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import type { MaterialPurchaseOrderItemForm } from '@/lib/materials/purchase-orders/form-state'
import {
  deleteMaterialPurchaseNeedCard,
  type FetchMaterialPurchaseHistoryResult,
  type FetchMaterialPurchaseRegisterResult,
} from '@/lib/materials/purchase-orders/repository'
import type {
  MaterialPurchaseNeedCard,
  MaterialPurchaseOrderListGroup,
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

type DetailModalState =
  | { open: false }
  | { open: true; card: MaterialPurchaseNeedCard }

function matchesNeedCard(card: MaterialPurchaseNeedCard, query: string) {
  if (!query) return true
  const haystack = [
    card.orderNumber,
    card.customer,
    card.productLabel,
    ...card.lines.flatMap((line) => [
      line.materialCode,
      line.materialName,
      line.mpn,
      line.specification,
      line.supplier,
    ]),
  ]
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

function shortageLinesToFormItems(card: MaterialPurchaseNeedCard): MaterialPurchaseOrderItemForm[] {
  return card.lines
    .filter((line) => line.status === '부족' && line.shortageQuantity > 0)
    .map((line) => ({
      materialId: line.materialId,
      materialCode: line.materialCode,
      materialName: line.materialName,
      specification: line.specification,
      mpn: line.mpn,
      quantity: String(line.shortageQuantity),
      unitPrice: String(line.unitPrice || 0),
    }))
}

function pickSupplierFromCard(card: MaterialPurchaseNeedCard) {
  const suppliers = [
    ...new Set(
      card.lines
        .filter((line) => line.status === '부족')
        .map((line) => line.supplier.trim())
        .filter(Boolean),
    ),
  ]
  return suppliers.length === 1 ? suppliers[0] : ''
}

export function MaterialPurchaseOrdersWorkspace(props: MaterialPurchaseOrdersWorkspaceProps) {
  const router = useRouter()
  const [createModal, setCreateModal] = useState<CreateModalState>({ open: false })
  const [editModal, setEditModal] = useState<EditModalState>({ open: false })
  const [detailModal, setDetailModal] = useState<DetailModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)
  const [search, setSearch] = useState('')
  const [deletingNeedCard, setDeletingNeedCard] = useState(false)
  const [deleteNeedError, setDeleteNeedError] = useState<string | null>(null)

  const needCards = props.view === 'register' && props.result.ok ? props.result.needCards : []
  const purchaseOrders = props.view === 'history' && props.result.ok ? props.result.orders : []
  const query = search.trim().toLowerCase()

  const filteredCards = useMemo(
    () => needCards.filter((card) => matchesNeedCard(card, query)),
    [needCards, query],
  )

  const filteredPurchaseOrders = useMemo(
    () => purchaseOrders.filter((order) => matchesPurchaseOrder(order, query)),
    [purchaseOrders, query],
  )
  const cardsPagination = useClientPagination(filteredCards)
  const ordersPagination = useClientPagination(filteredPurchaseOrders)

  const shortageCardCount = needCards.filter((card) => card.shortageCount > 0).length

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

  function openDetail(card: MaterialPurchaseNeedCard) {
    setDeleteNeedError(null)
    setDetailModal({ open: true, card })
  }

  function closeDetail() {
    if (deletingNeedCard) return
    setDetailModal({ open: false })
    setDeleteNeedError(null)
  }

  function handleCreateShortageOrder(card: MaterialPurchaseNeedCard) {
    const items = shortageLinesToFormItems(card)
    if (!items.length) return
    closeDetail()
    openCreate({
      items,
      supplier: pickSupplierFromCard(card),
    })
  }

  async function handleDeleteNeedCard(card: MaterialPurchaseNeedCard) {
    setDeletingNeedCard(true)
    setDeleteNeedError(null)

    const result = await deleteMaterialPurchaseNeedCard(card.orderId)
    setDeletingNeedCard(false)

    if (!result.ok) {
      setDeleteNeedError(result.detail)
      return
    }

    setDetailModal({ open: false })
    setDeleteNeedError(null)
    router.refresh()
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
            totalCount={needCards.length}
            filteredCount={filteredCards.length}
            hasQuery={Boolean(query)}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="주문번호, 고객사, 품목, 자재명 검색…"
            accent="violet"
            meta={
              <p className="mt-0.5 text-slate-500">
                부족{' '}
                <span className="tabular-nums font-semibold text-rose-600">
                  {shortageCardCount.toLocaleString('ko-KR')}
                </span>
                건
              </p>
            }
          />

          <MaterialPurchaseNeedCards cards={cardsPagination.pageItems} onSelectCard={openDetail} />

          <ListPagination
            page={cardsPagination.page}
            totalPages={cardsPagination.totalPages}
            onPageChange={cardsPagination.setPage}
            rangeStart={cardsPagination.rangeStart}
            rangeEnd={cardsPagination.rangeEnd}
            totalCount={cardsPagination.totalCount}
          />
        </div>

        {detailModal.open ? (
          <MaterialPurchaseNeedDetailModal
            open
            card={detailModal.card}
            onClose={closeDetail}
            onCreateShortageOrder={handleCreateShortageOrder}
            onDelete={handleDeleteNeedCard}
            deleting={deletingNeedCard}
            deleteError={deleteNeedError}
          />
        ) : null}

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
