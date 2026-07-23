'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { MaterialOrderPartialPurchaseModal } from '@/components/materials/purchase-orders/material-order-partial-purchase-modal'
import { MaterialOrderPurchaseCards } from '@/components/materials/purchase-orders/material-order-purchase-cards'
import { MaterialPurchaseOrderFetchError } from '@/components/materials/purchase-orders/material-purchase-order-fetch-error'
import { MaterialPurchaseOrderModal } from '@/components/materials/purchase-orders/material-purchase-order-modal'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { ListPagination } from '@/components/ui/list-pagination'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import type { MaterialPurchaseOrderItemForm } from '@/lib/materials/purchase-orders/form-state'
import { buildOrderPurchaseMaterialPreview } from '@/lib/materials/purchase-orders/need-utils'
import type { FetchMaterialPurchaseByOrderResult } from '@/lib/materials/purchase-orders/repository'
import type {
  OrderPurchaseCard,
  OrderPurchaseProductLine,
} from '@/lib/materials/purchase-orders/types'

type MaterialOrderPurchaseWorkspaceProps = {
  result: FetchMaterialPurchaseByOrderResult
}

type StatusFilter = 'active' | 'done' | 'all'

type PartialModalState =
  | { open: false }
  | { open: true; card: OrderPurchaseCard; product: OrderPurchaseProductLine }

type CreateModalState =
  | { open: false }
  | {
      open: true
      sourceOrderId: string
      coveredOrderLineId: string
      coveredProductQuantity: number
      initialItems: MaterialPurchaseOrderItemForm[]
      initialSupplier: string
    }

function matchesCard(card: OrderPurchaseCard, query: string) {
  if (!query) return true
  const haystack = [
    card.orderNumber,
    card.customer,
    ...card.products.flatMap((product) => [product.productName, product.productCode]),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function cardHasOpenPurchase(card: OrderPurchaseCard) {
  // 진행중 = BOM 있는 제품 중 아직 발주 잔량이 남은 경우 (부분 발주 포함)
  return card.products.some((product) => product.hasBom && product.remainingQuantity > 0)
}

function cardMatchesFilter(card: OrderPurchaseCard, filter: StatusFilter) {
  if (filter === 'all') return true
  const open = cardHasOpenPurchase(card)
  if (filter === 'done') return !open && card.products.some((product) => product.hasBom)
  // active: 잔량 남음 + BOM 미등록만 있는 카드도 확인용으로 유지
  return open || card.products.every((product) => !product.hasBom)
}

export function MaterialOrderPurchaseWorkspace({ result }: MaterialOrderPurchaseWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [partialModal, setPartialModal] = useState<PartialModalState>({ open: false })
  const [createModal, setCreateModal] = useState<CreateModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const cards = result.ok ? result.cards : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () => cards.filter((card) => cardMatchesFilter(card, statusFilter) && matchesCard(card, query)),
    [cards, statusFilter, query],
  )
  const pagination = useClientPagination(filtered)

  const doneCount = useMemo(
    () => cards.filter((card) => !cardHasOpenPurchase(card) && card.products.some((p) => p.hasBom)).length,
    [cards],
  )
  const activeCount = useMemo(
    () => cards.filter((card) => cardHasOpenPurchase(card) || card.products.every((p) => !p.hasBom)).length,
    [cards],
  )
  const statusChips = [
    {
      value: 'active' as const,
      label: '진행중',
      count: activeCount,
      tone: STATUS_FILTER_TONES.progress,
    },
    { value: 'done' as const, label: '완료', count: doneCount, tone: STATUS_FILTER_TONES.done },
    { value: 'all' as const, label: '전체', count: cards.length },
  ]

  function openPartial(card: OrderPurchaseCard, orderLineId: string) {
    const product = card.products.find((item) => item.orderLineId === orderLineId)
    if (!product || !product.hasBom || product.remainingQuantity <= 0) return
    setPartialModal({ open: true, card, product })
  }

  function handleConfirmPartial(purchaseQuantity: number) {
    if (!partialModal.open || !result.ok) return
    const { card, product } = partialModal

    const preview = buildOrderPurchaseMaterialPreview({
      productId: product.productId,
      purchaseQuantity,
      bomEdges: result.bomEdges,
      materials: result.materials,
      onHandByMaterialId: new Map(Object.entries(result.onHandByMaterialId)),
    })

    const items: MaterialPurchaseOrderItemForm[] = preview.map((line) => ({
      materialId: line.materialId,
      materialCode: line.materialCode,
      materialName: line.materialName,
      specification: line.specification,
      mpn: line.mpn,
      // 주문서 발주는 해당 수량 BOM 소요를 기본값으로 넣고, 재고 반영은 사용자가 조정
      quantity: String(line.requiredQuantity),
      unitPrice: String(line.unitPrice || 0),
    }))

    if (!items.length) {
      window.alert('이 제품의 BOM 자재가 없어 발주서를 만들 수 없습니다.')
      return
    }

    const suppliers = [
      ...new Set(preview.map((line) => line.supplier.trim()).filter(Boolean)),
    ]

    setPartialModal({ open: false })
    setModalSession((value) => value + 1)
    setCreateModal({
      open: true,
      sourceOrderId: card.orderId,
      coveredOrderLineId: product.orderLineId,
      coveredProductQuantity: purchaseQuantity,
      initialItems: items,
      initialSupplier: suppliers.length === 1 ? suppliers[0] : '',
    })
  }

  function handleSaved() {
    setCreateModal({ open: false })
    router.refresh()
  }

  if (!result.ok) {
    return <MaterialPurchaseOrderFetchError result={result} />
  }

  return (
    <>
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="주문번호, 고객사, 제품명 검색…"
          accent="slate"
          filters={
            <FilterChipBar
              options={statusChips}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          }
        />

        <MaterialOrderPurchaseCards
          cards={pagination.pageItems}
          onPurchaseProduct={openPartial}
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

      {partialModal.open ? (
        <MaterialOrderPartialPurchaseModal
          open
          card={partialModal.card}
          product={partialModal.product}
          materials={result.materials}
          bomEdges={result.bomEdges}
          onHandByMaterialId={result.onHandByMaterialId}
          onClose={() => setPartialModal({ open: false })}
          onConfirm={handleConfirmPartial}
        />
      ) : null}

      {createModal.open ? (
        <MaterialPurchaseOrderModal
          key={`create-order-${modalSession}`}
          open
          mode="create"
          initialItems={createModal.initialItems}
          initialSupplier={createModal.initialSupplier}
          sourceOrderId={createModal.sourceOrderId}
          coveredOrderLineId={createModal.coveredOrderLineId}
          coveredProductQuantity={createModal.coveredProductQuantity}
          onClose={() => setCreateModal({ open: false })}
          onSaved={handleSaved}
        />
      ) : null}
    </>
  )
}
