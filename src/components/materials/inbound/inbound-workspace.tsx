'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { InboundFetchError } from '@/components/materials/inbound/inbound-fetch-error'
import { InboundListTable } from '@/components/materials/inbound/inbound-list-table'
import { InboundModal } from '@/components/materials/inbound/inbound-modal'
import { InboundScanPanel } from '@/components/materials/inbound/inbound-scan-panel'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchMaterialInboundPageResult } from '@/lib/materials/inbound/repository'
import type { MaterialInboundListGroup } from '@/lib/materials/inbound/types'
import { getInboundTypeLabel } from '@/lib/materials/inbound/utils'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type InboundWorkspaceProps = {
  result: FetchMaterialInboundPageResult
  view: 'register' | 'history'
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; seedPurchaseOrderId?: string }
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
  const { afterSave, afterDelete } = useSaveFeedback()
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

  function handleSaved(message?: string) {
    afterSave(message ?? '입고 내역이 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '입고 내역이 삭제되었습니다.', { close: closeModal })
  }

  if (!result.ok) {
    return <InboundFetchError result={result} />
  }

  const modalNode = modal.open ? (
    <InboundModal
      key={
        modal.mode === 'edit'
          ? `edit-${modal.inbound.inboundId}-${modalSession}`
          : `create-${modalSession}`
      }
      open
      mode={modal.mode}
      inbound={modal.mode === 'edit' ? modal.inbound : null}
      seedPurchaseOrderId={modal.mode === 'create' ? modal.seedPurchaseOrderId : undefined}
      materials={result.materials}
      purchaseOrders={result.purchaseOrders}
      onClose={closeModal}
      onSaved={handleSaved}
      onDeleted={handleDeleted}
      onMaterialsChanged={() => router.refresh()}
    />
  ) : null

  if (view === 'register') {
    return (
      <PageShell>
        <InboundScanPanel
          materials={result.materials}
          purchaseOrders={result.purchaseOrders}
          onSaved={() => router.refresh()}
          onMaterialsChanged={() => router.refresh()}
        />
      </PageShell>
    )
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="입고번호, 구매발주번호, 자재명, 자재코드 검색…"
          accent="slate"
        />

        <InboundListTable
          inbounds={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query),
            emptyLabel: '등록된 입고 내역이 없습니다',
            actionHint: '입고 메뉴에서 등록하세요',
          })}
          onSelectInbound={openEdit}
        />
      </PageShell>

      {modalNode}
    </>
  )
}
