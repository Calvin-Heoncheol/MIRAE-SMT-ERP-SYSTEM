'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { MaterialOrderPartialPurchaseModal } from '@/components/materials/purchase-orders/material-order-partial-purchase-modal'
import { MaterialOrderPurchaseCards } from '@/components/materials/purchase-orders/material-order-purchase-cards'
import { MaterialPurchaseOrderFetchError } from '@/components/materials/purchase-orders/material-purchase-order-fetch-error'
import { MaterialPurchaseOrderModal } from '@/components/materials/purchase-orders/material-purchase-order-modal'
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

function cardMatchesFilter(card: OrderPurchaseCard, filter: StatusFilter) {
  if (filter === 'all') return true
  if (filter === 'done') return card.purchaseStatus === 'done'
  return card.purchaseStatus !== 'done'
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
    () => cards.filter((card) => card.purchaseStatus === 'done').length,
    [cards],
  )
  const statusChips: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'active', label: '진행중', count: cards.length - doneCount },
    { key: 'done', label: '완료', count: doneCount },
    { key: 'all', label: '전체', count: cards.length },
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
      <div className="flex w-full flex-1 flex-col gap-4">
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="주문번호, 고객사, 제품명 검색…"
          accent="violet"
          filters={
            <div className="flex flex-wrap gap-2">
              {statusChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setStatusFilter(chip.key)}
                  className={[
                    'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                    statusFilter === chip.key
                      ? 'bg-violet-700 text-white shadow-sm'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {chip.label}{' '}
                  <span className={statusFilter === chip.key ? 'text-violet-200' : 'text-slate-400'}>
                    {chip.count.toLocaleString('ko-KR')}
                  </span>
                </button>
              ))}
            </div>
          }
        />

        <p className="text-sm text-slate-500">
          주문 제품 수량 중 일부만 발주할 수 있습니다. 예: 주문 1,000개 → 이번 발주 500개.
        </p>

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
