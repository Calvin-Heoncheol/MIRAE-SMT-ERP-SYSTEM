'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PartnerFetchError } from '@/components/partners/partner-fetch-error'
import { PartnerListTable } from '@/components/partners/partner-list-table'
import { PartnerModal } from '@/components/partners/partner-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchBusinessPartnersResult } from '@/lib/partners/repository'
import { PARTNER_TRADE_ROLE_LABELS } from '@/lib/partners/types'
import { formatBusinessRegNo } from '@/lib/partners/utils'
import type { BusinessPartner } from '@/lib/partners/types'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type PartnersWorkspaceProps = {
  result: FetchBusinessPartnersResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; partner: BusinessPartner }

function matchesQuery(partner: BusinessPartner, query: string) {
  if (!query) return true
  const haystack = [
    partner.businessRegNo,
    formatBusinessRegNo(partner.businessRegNo),
    partner.name,
    partner.representativeName,
    partner.businessType,
    partner.phone,
    PARTNER_TRADE_ROLE_LABELS[partner.tradeRole],
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function PartnersWorkspace({ result }: PartnersWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const partners = result.ok ? result.partners : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () => partners.filter((partner) => matchesQuery(partner, query)),
    [partners, query],
  )

  const pagination = useClientPagination(filtered)

  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(partner: BusinessPartner) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', partner })
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
    return <PartnerFetchError result={result} />
  }

  return (
    <>
      <div className="flex w-full flex-1 flex-col gap-4">
        <WorkspaceHeader
          title="거래처등록"
          totalCount={partners.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(query)}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="사업자번호, 거래처명, 대표자명, 업태, 전화 검색…"
          accent="slate"
          actions={<ErpButton onClick={openCreate}>거래처 등록</ErpButton>}
        />

        <PartnerListTable
          partners={pagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query),
            emptyLabel: '등록된 거래처가 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectPartner={openEdit}
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

      {modal.open ? (
        <PartnerModal
          key={`${modal.mode}-${modal.mode === 'edit' ? modal.partner.businessRegNo : 'create'}-${modalSession}`}
          open
          mode={modal.mode}
          partner={modal.mode === 'edit' ? modal.partner : null}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  )
}
