'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { MaterialOrderPartialPurchaseModal } from '@/components/materials/purchase-orders/material-order-partial-purchase-modal'
import { MaterialOrderPurchaseCards } from '@/components/materials/purchase-orders/material-order-purchase-cards'
import { MaterialPurchaseOrderFetchError } from '@/components/materials/purchase-orders/material-purchase-order-fetch-error'
import { MaterialPurchaseOrderModal } from '@/components/materials/purchase-orders/material-purchase-order-modal'
import { MaterialPurchaseSuggestionTable } from '@/components/materials/purchase-orders/material-purchase-suggestion-table'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import type { MaterialPurchaseOrderItemForm } from '@/lib/materials/purchase-orders/form-state'
import { buildOrderPurchaseMaterialPreview } from '@/lib/materials/purchase-orders/need-utils'
import type { FetchMaterialPurchaseRegisterResult } from '@/lib/materials/purchase-orders/repository'
import type {
  MaterialPurchaseSuggestionLine,
  OrderPurchaseCard,
  OrderPurchaseProductLine,
} from '@/lib/materials/purchase-orders/types'
import { ERP_SECONDARY_BUTTON_CLASS, formatEmptyListMessage } from '@/lib/ui/tokens'

type MaterialPurchaseOrdersWorkspaceProps = {
  result: FetchMaterialPurchaseRegisterResult
  /** URL ?mode=partial 로 부분 구매발주 패널 시작 */
  initialPanel?: 'suggestion' | 'partial'
}

type Panel = 'suggestion' | 'partial'
type StatusFilter = 'active' | 'done' | 'all'

type PartialModalState =
  | { open: false }
  | { open: true; card: OrderPurchaseCard; product: OrderPurchaseProductLine }

type CreateModalState =
  | { open: false }
  | {
      open: true
      initialItems?: MaterialPurchaseOrderItemForm[] | null
      initialSupplier?: string
      sourceOrderId?: string
      coveredOrderLineId?: string
      coveredProductQuantity?: number
    }

function matchesSuggestionLine(line: MaterialPurchaseSuggestionLine, query: string) {
  if (!query) return true
  const haystack = [line.materialId, line.materialName, line.specification, line.mpn, line.supplier]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
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
  return card.products.some((product) => product.hasBom && product.remainingQuantity > 0)
}

function cardMatchesFilter(card: OrderPurchaseCard, filter: StatusFilter) {
  if (filter === 'all') return true
  const open = cardHasOpenPurchase(card)
  if (filter === 'done') return !open && card.products.some((product) => product.hasBom)
  return open || card.products.every((product) => !product.hasBom)
}

export function MaterialPurchaseOrdersWorkspace({
  result,
  initialPanel = 'suggestion',
}: MaterialPurchaseOrdersWorkspaceProps) {
  const router = useRouter()
  const { afterSave } = useSaveFeedback()
  const [panel, setPanel] = useState<Panel>(initialPanel)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [partialModal, setPartialModal] = useState<PartialModalState>({ open: false })
  const [createModal, setCreateModal] = useState<CreateModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const suggestionLines = result.ok ? result.suggestionLines : []
  const cards = result.ok ? result.cards : []
  const query = search.trim().toLowerCase()

  const filteredSuggestions = useMemo(
    () => suggestionLines.filter((line) => matchesSuggestionLine(line, query)),
    [suggestionLines, query],
  )

  const filteredCards = useMemo(
    () => cards.filter((card) => cardMatchesFilter(card, statusFilter) && matchesCard(card, query)),
    [cards, statusFilter, query],
  )

  const doneCount = useMemo(
    () => cards.filter((card) => !cardHasOpenPurchase(card) && card.products.some((p) => p.hasBom)).length,
    [cards],
  )
  const activeCount = useMemo(
    () => cards.filter((card) => cardHasOpenPurchase(card) || card.products.every((p) => !p.hasBom)).length,
    [cards],
  )

  const panelChips = [
    { value: 'suggestion' as const, label: '구매발주 제안', count: suggestionLines.length },
    { value: 'partial' as const, label: '부분 구매발주', count: activeCount },
  ]

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

  function changePanel(next: Panel) {
    setPanel(next)
    setSearch('')
    const href =
      next === 'partial'
        ? '/materials/purchase-orders/by-material?mode=partial'
        : '/materials/purchase-orders/by-material'
    window.history.replaceState(window.history.state, '', href)
  }

  function openSuggestionCreate(items: MaterialPurchaseOrderItemForm[], supplier: string) {
    if (!items.length) return
    setModalSession((value) => value + 1)
    setCreateModal({
      open: true,
      initialItems: items,
      initialSupplier: supplier,
    })
  }

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

    const unregistered = preview.filter((line) => !line.registered)
    if (unregistered.length > 0) {
      window.alert(
        `품목등록에 없는 자재가 ${unregistered.length}종 있어 구매발주할 수 없습니다.\n` +
          unregistered.map((line) => line.materialCode).slice(0, 15).join(', ') +
          (unregistered.length > 15 ? ' …' : ''),
      )
      return
    }

    const items: MaterialPurchaseOrderItemForm[] = preview.map((line) => ({
      materialId: line.materialId,
      materialCode: line.materialCode,
      materialName: line.materialName,
      specification: line.specification,
      mpn: line.mpn,
      quantity: String(line.requiredQuantity),
      unitPrice: String(line.unitPrice || 0),
      deliveryDate: '',
    }))

    if (!items.length) {
      window.alert('이 제품의 BOM 자재가 없어 구매발주서를 만들 수 없습니다.')
      return
    }

    const suppliers = [...new Set(preview.map((line) => line.supplier.trim()).filter(Boolean))]

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

  function handleSaved(message?: string) {
    afterSave(message ?? '구매발주가 저장되었습니다.', {
      close: () => setCreateModal({ open: false }),
      refresh: false,
    })
    router.push('/materials/purchase-orders')
    router.refresh()
  }

  if (!result.ok) {
    return <MaterialPurchaseOrderFetchError result={result} />
  }

  return (
    <>
      <PageShell>
        <div className="flex shrink-0 items-center justify-between gap-3">
          <h1 className="text-base font-bold text-slate-900">새 구매발주</h1>
          <Link
            href="/materials/purchase-orders"
            className={`${ERP_SECONDARY_BUTTON_CLASS} inline-flex items-center justify-center no-underline`}
          >
            구매발주서 목록
          </Link>
        </div>

        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={
            panel === 'suggestion'
              ? '자재코드, 자재명, MPN, 공급사 검색…'
              : '발주번호, 고객사, 제품명 검색…'
          }
          accent="slate"
          filters={
            <div className="flex w-full min-w-0 flex-col gap-2">
              <FilterChipBar options={panelChips} value={panel} onChange={changePanel} />
              {panel === 'partial' ? (
                <FilterChipBar
                  options={statusChips}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              ) : null}
            </div>
          }
          meta={
            panel === 'suggestion' ? (
              <p className="text-slate-500">
                구매발주필요{' '}
                <span className="tabular-nums font-semibold text-rose-600">
                  {suggestionLines.length.toLocaleString('ko-KR')}
                </span>
                종 · 발주서 기준
              </p>
            ) : (
              <p className="text-slate-500">
                발주의 제품 대수에서 커버할 대수를 지정합니다.
              </p>
            )
          }
        />

        {panel === 'suggestion' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <MaterialPurchaseSuggestionTable
              lines={filteredSuggestions}
              onCreateOrder={openSuggestionCreate}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <MaterialOrderPurchaseCards
              cards={filteredCards}
              emptyMessage={formatEmptyListMessage({
                hasQuery: Boolean(search.trim()) || statusFilter !== 'active',
                emptyLabel: '구매발주할 발주서가 없습니다',
                actionHint: '출하 미완료 발주서가 있으면 여기에 표시됩니다',
              })}
              onPurchaseProduct={openPartial}
            />
          </div>
        )}
      </PageShell>

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
          key={`create-${modalSession}`}
          open
          mode="create"
          initialItems={createModal.initialItems}
          initialSupplier={createModal.initialSupplier}
          initialMaterials={result.materials}
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
