'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { InboundFetchError } from '@/components/materials/inbound/inbound-fetch-error'
import { InboundListTable } from '@/components/materials/inbound/inbound-list-table'
import { InboundModal } from '@/components/materials/inbound/inbound-modal'
import { InboundRegisterModal } from '@/components/materials/inbound/inbound-register-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchMaterialInboundPageResult } from '@/lib/materials/inbound/repository'
import type { MaterialInboundListGroup } from '@/lib/materials/inbound/types'
import { getInboundTypeLabel } from '@/lib/materials/inbound/utils'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type InboundWorkspaceProps = {
  result: FetchMaterialInboundPageResult
}

type EditModalState =
  | { open: false }
  | { open: true; inbound: MaterialInboundListGroup }

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

export function InboundWorkspace({ result }: InboundWorkspaceProps) {
  const router = useRouter()
  const { afterSave, afterDelete } = useSaveFeedback()
  const [search, setSearch] = useState('')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [registerSession, setRegisterSession] = useState(0)
  const [editModal, setEditModal] = useState<EditModalState>({ open: false })
  const [editModalSession, setEditModalSession] = useState(0)

  const inbounds = result.ok ? result.inbounds : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () => inbounds.filter((inbound) => matchesQuery(inbound, query)),
    [inbounds, query],
  )

  function openRegister() {
    setRegisterSession((value) => value + 1)
    setRegisterOpen(true)
  }

  function closeRegister() {
    setRegisterOpen(false)
  }

  function openEdit(inbound: MaterialInboundListGroup) {
    setEditModalSession((value) => value + 1)
    setEditModal({ open: true, inbound })
  }

  function closeEditModal() {
    setEditModal({ open: false })
  }

  function handleSaved(message?: string) {
    afterSave(message ?? '입고 내역이 저장되었습니다.', { close: closeEditModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '입고 내역이 삭제되었습니다.', { close: closeEditModal })
  }

  function handleRegisterSaved() {
    router.refresh()
  }

  if (!result.ok) {
    return <InboundFetchError result={result} />
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="입고번호, 구매발주번호, 자재명, 자재코드 검색…"
          accent="slate"
          actions={<ErpButton onClick={openRegister}>입고 등록</ErpButton>}
        />

        <InboundListTable
          inbounds={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query),
            emptyLabel: '등록된 입고 내역이 없습니다',
            actionHint: '오른쪽 상단에서 입고 등록하세요',
          })}
          onSelectInbound={openEdit}
        />
      </PageShell>

      {registerOpen ? (
        <InboundRegisterModal
          key={`register-${registerSession}`}
          open
          materials={result.materials}
          purchaseOrders={result.purchaseOrders}
          onClose={closeRegister}
          onSaved={handleRegisterSaved}
          onMaterialsChanged={() => router.refresh()}
        />
      ) : null}

      {editModal.open ? (
        <InboundModal
          key={`edit-${editModal.inbound.inboundId}-${editModalSession}`}
          open
          mode="edit"
          inbound={editModal.inbound}
          materials={result.materials}
          purchaseOrders={result.purchaseOrders}
          onClose={closeEditModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onMaterialsChanged={() => router.refresh()}
        />
      ) : null}
    </>
  )
}
