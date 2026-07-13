'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OutboundFetchError } from '@/components/materials/outbound/outbound-fetch-error'
import { OutboundListTable } from '@/components/materials/outbound/outbound-list-table'
import { OutboundModal } from '@/components/materials/outbound/outbound-modal'
import { OutboundNeedsTable } from '@/components/materials/outbound/outbound-needs-table'
import type { FetchMaterialOutboundPageResult } from '@/lib/materials/outbound/repository'
import type { MaterialOutboundListGroup } from '@/lib/materials/outbound/types'
import { getOutboundTypeLabel } from '@/lib/materials/outbound/utils'

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
      <div className="flex w-full flex-col gap-4">
        <p className="text-sm text-slate-500">
          미불출{' '}
          <span className="font-semibold tabular-nums text-orange-700">
            {needCards.length.toLocaleString('ko-KR')}
          </span>
          건
        </p>

        <OutboundNeedsTable
          cards={needCards}
          bomEdges={bomEdges}
          onIssued={() => router.refresh()}
        />
      </div>
    )
  }

  return (
    <>
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-600">
            총 <span className="tabular-nums text-orange-700">{filtered.length.toLocaleString('ko-KR')}</span>
            건
            {query ? (
              <span className="text-slate-400"> / {outbounds.length.toLocaleString('ko-KR')}건</span>
            ) : null}
          </p>
        </div>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="출고번호, 주문번호, 자재명, 자재코드 검색…"
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-orange-100 placeholder:text-slate-400 focus:border-orange-300 focus:ring-2"
        />

        <OutboundListTable
          outbounds={filtered}
          emptyMessage={query ? '검색 결과가 없습니다' : '등록된 출고 내역이 없습니다'}
          onSelectOutbound={openEdit}
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
