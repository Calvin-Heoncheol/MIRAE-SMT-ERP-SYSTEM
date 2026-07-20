'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OutboundFetchError } from '@/components/materials/outbound/outbound-fetch-error'
import { OutboundListTable } from '@/components/materials/outbound/outbound-list-table'
import { OutboundModal } from '@/components/materials/outbound/outbound-modal'
import { OutboundNeedsTable } from '@/components/materials/outbound/outbound-needs-table'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { ListPagination } from '@/components/ui/list-pagination'
import type { FetchMaterialOutboundPageResult } from '@/lib/materials/outbound/repository'
import type {
  MaterialOutboundListGroup,
  MaterialOutboundNeedCard,
} from '@/lib/materials/outbound/types'
import { getOutboundTypeLabel } from '@/lib/materials/outbound/utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type OutboundWorkspaceProps = {
  result: FetchMaterialOutboundPageResult
  view: 'register' | 'history'
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'edit'; outbound: MaterialOutboundListGroup }

function matchesQuery(outbound: MaterialOutboundListGroup, query: string) {
  if (!query) return true
  const haystack = [
    outbound.outboundNumber,
    outbound.orderNumber || '',
    outbound.customer,
    outbound.note,
    getOutboundTypeLabel(outbound.outboundType),
    ...outbound.items.flatMap((item) => [item.materialCode, item.materialName, item.mpn]),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function matchesNeedCardQuery(card: MaterialOutboundNeedCard, query: string) {
  if (!query) return true
  const haystack = [card.orderNumber, card.customer, card.productName].join(' ').toLowerCase()
  return haystack.includes(query)
}

export function OutboundWorkspace({ result, view }: OutboundWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const outbounds = result.ok ? result.outbounds : []
  const needCards = result.ok ? result.needCards : []
  const bomEdges = result.ok ? result.bomEdges : []
  const materials = result.ok ? result.materials : []
  const orders = result.ok ? result.orders : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () => outbounds.filter((outbound) => matchesQuery(outbound, query)),
    [outbounds, query],
  )

  const filteredNeedCards = useMemo(
    () => needCards.filter((card) => matchesNeedCardQuery(card, query)),
    [needCards, query],
  )
  const needsPagination = useClientPagination(filteredNeedCards)
  const historyPagination = useClientPagination(filtered)

  function openEdit(outbound: MaterialOutboundListGroup) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', outbound })
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
    return <OutboundFetchError result={result} />
  }

  if (view === 'register') {
    return (
      <div className="flex w-full flex-1 flex-col gap-4">
        <WorkspaceHeader
          subtitle="주문·BOM 기준 미불출 필요 수량입니다"
          totalCount={needCards.length}
          filteredCount={filteredNeedCards.length}
          hasQuery={Boolean(query)}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="주문번호, 고객사, 품목 검색…"
          accent="orange"
        />

        <OutboundNeedsTable
          cards={needsPagination.pageItems}
          bomEdges={bomEdges}
          onIssued={() => router.refresh()}
        />

        <ListPagination
          page={needsPagination.page}
          totalPages={needsPagination.totalPages}
          onPageChange={needsPagination.setPage}
          rangeStart={needsPagination.rangeStart}
          rangeEnd={needsPagination.rangeEnd}
          totalCount={needsPagination.totalCount}
        />
      </div>
    )
  }

  return (
    <>
      <div className="flex w-full flex-1 flex-col gap-4">
        <WorkspaceHeader
          totalCount={outbounds.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(query)}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="불출번호, 주문번호, 자재명, 자재코드 검색…"
          accent="orange"
        />

        <OutboundListTable
          outbounds={historyPagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query),
            emptyLabel: '등록된 불출 내역이 없습니다',
            actionHint: '불출등록 탭에서 등록하세요',
          })}
          onSelectOutbound={openEdit}
        />

        <ListPagination
          page={historyPagination.page}
          totalPages={historyPagination.totalPages}
          onPageChange={historyPagination.setPage}
          rangeStart={historyPagination.rangeStart}
          rangeEnd={historyPagination.rangeEnd}
          totalCount={historyPagination.totalCount}
        />
      </div>

      {modal.open ? (
        <OutboundModal
          key={`edit-${modal.outbound.outboundId}-${modalSession}`}
          open
          mode="edit"
          outbound={modal.outbound}
          materials={materials}
          orders={orders}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  )
}
