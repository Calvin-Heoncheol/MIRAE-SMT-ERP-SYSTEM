'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NewCompanyFetchError } from '@/components/new-companies/new-company-fetch-error'
import { NewCompanyListTable } from '@/components/new-companies/new-company-list-table'
import { NewCompanyModal } from '@/components/new-companies/new-company-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchNewCompanyInquiriesResult } from '@/lib/new-companies/repository'
import type { NewCompanyInquiry } from '@/lib/new-companies/types'
import { NEW_COMPANY_STATUS_LABELS } from '@/lib/new-companies/types'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type NewCompaniesWorkspaceProps = {
  result: FetchNewCompanyInquiriesResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; inquiry: NewCompanyInquiry }

function matchesQuery(inquiry: NewCompanyInquiry, query: string) {
  if (!query) return true
  const haystack = [
    inquiry.contactName,
    inquiry.companyName,
    inquiry.email,
    inquiry.phone,
    inquiry.product,
    inquiry.note,
    NEW_COMPANY_STATUS_LABELS[inquiry.status],
    inquiry.quantity == null ? '' : String(inquiry.quantity),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function NewCompaniesWorkspace({ result }: NewCompaniesWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const inquiries = result.ok ? result.inquiries : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () => inquiries.filter((inquiry) => matchesQuery(inquiry, query)),
    [inquiries, query],
  )

  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(inquiry: NewCompanyInquiry) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', inquiry })
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
    return <NewCompanyFetchError result={result} />
  }

  return (
    <>
      <div className="flex w-full flex-col gap-4">
        <WorkspaceHeader
          title="신규업체"
          subtitle="상담·견적 중인 신규 업체를 등록합니다"
          totalCount={inquiries.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(query)}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="회사명, 담당자, 상태, 이메일, 연락처, 제품, 비고 검색…"
          accent="slate"
          actions={<ErpButton onClick={openCreate}>신규업체 등록</ErpButton>}
        />

        <NewCompanyListTable
          inquiries={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query),
            emptyLabel: '등록된 신규업체가 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectInquiry={openEdit}
        />
      </div>

      {modal.open ? (
        <NewCompanyModal
          key={`${modal.mode}-${modal.mode === 'edit' ? modal.inquiry.id : 'create'}-${modalSession}`}
          open
          mode={modal.mode}
          inquiry={modal.mode === 'edit' ? modal.inquiry : null}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  )
}
