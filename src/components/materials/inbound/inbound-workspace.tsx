'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { InboundFetchError } from '@/components/materials/inbound/inbound-fetch-error'
import { InboundForm } from '@/components/materials/inbound/inbound-form'
import { InboundListTable } from '@/components/materials/inbound/inbound-list-table'
import { InboundModal } from '@/components/materials/inbound/inbound-modal'
import type { FetchMaterialInboundPageResult } from '@/lib/materials/inbound/repository'
import type { MaterialInboundListGroup } from '@/lib/materials/inbound/types'
import { getInboundTypeLabel } from '@/lib/materials/inbound/utils'

type InboundWorkspaceProps = {
  result: FetchMaterialInboundPageResult
  view: 'register' | 'history'
}

type ModalState =
  | { open: false }
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

export function InboundWorkspace({ result, view }: InboundWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const inbounds = result.ok ? result.inbounds : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () => inbounds.filter((inbound) => matchesQuery(inbound, query)),
    [inbounds, query],
  )

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

  if (view === 'register') {
    return (
      <div className="flex w-full flex-col gap-4">
        <InboundForm
          mode="create"
          variant="page"
          materials={result.materials}
          purchaseOrders={result.purchaseOrders}
          onMaterialsChanged={() => router.refresh()}
        />
      </div>
    )
  }

  return (
    <>
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-600">
            총 <span className="tabular-nums text-blue-700">{filtered.length.toLocaleString('ko-KR')}</span>건
            {query ? (
              <span className="text-slate-400"> / {inbounds.length.toLocaleString('ko-KR')}건</span>
            ) : null}
          </p>
        </div>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="입고번호, 발주번호, 자재명, 자재코드 검색…"
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-blue-100 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2"
        />

        <InboundListTable
          inbounds={filtered}
          emptyMessage={query ? '검색 결과가 없습니다' : '등록된 입고 내역이 없습니다'}
          onSelectInbound={openEdit}
        />
      </div>

      {modal.open ? (
        <InboundModal
          key={`edit-${modal.inbound.inboundId}-${modalSession}`}
          open
          mode="edit"
          inbound={modal.inbound}
          materials={result.materials}
          purchaseOrders={result.purchaseOrders}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onMaterialsChanged={() => router.refresh()}
        />
      ) : null}
    </>
  )
}
