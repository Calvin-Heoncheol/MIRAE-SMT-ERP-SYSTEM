'use client'

import { useMemo, useState } from 'react'
import { PartnerFetchError } from '@/components/partners/partner-fetch-error'
import { PartnerListTable } from '@/components/partners/partner-list-table'
import { PartnerModal } from '@/components/partners/partner-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchBusinessPartnersResult } from '@/lib/partners/repository'
import { PARTNER_TRADE_ROLE_LABELS } from '@/lib/partners/types'
import { formatBusinessRegNo, formatPartnerPaymentTermLabel } from '@/lib/partners/utils'
import type { BusinessPartner } from '@/lib/partners/types'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
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
    partner.id,
    partner.businessRegNo,
    formatBusinessRegNo(partner.businessRegNo),
    partner.name,
    partner.representativeName,
    partner.businessType,
    partner.address,
    partner.phone,
    formatPartnerPaymentTermLabel(partner),
    PARTNER_TRADE_ROLE_LABELS[partner.tradeRole],
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function PartnersWorkspace({ result }: PartnersWorkspaceProps) {
  const { afterSave, afterDelete } = useSaveFeedback()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const partners = result.ok ? result.partners : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () => partners.filter((partner) => matchesQuery(partner, query)),
    [partners, query],
  )

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

  function handleSaved(message?: string) {
    afterSave(message ?? '거래처가 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '거래처가 삭제되었습니다.', { close: closeModal })
  }

  if (!result.ok) {
    return <PartnerFetchError result={result} />
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="사업자번호, 거래처명, 결제조건, 전화 검색…"
          accent="slate"
          actions={<ErpButton onClick={openCreate}>거래처 등록</ErpButton>}
        />

        <PartnerListTable
          partners={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query),
            emptyLabel: '등록된 거래처가 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectPartner={openEdit}
        />
      </PageShell>

      {modal.open ? (
        <PartnerModal
          key={`${modal.mode}-${modal.mode === 'edit' ? modal.partner.id : 'create'}-${modalSession}`}
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
