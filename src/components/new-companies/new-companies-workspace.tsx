'use client'

import { useMemo, useState } from 'react'
import { NewCompanyFetchError } from '@/components/new-companies/new-company-fetch-error'
import { NewCompanyListTable } from '@/components/new-companies/new-company-list-table'
import { NewCompanyModal } from '@/components/new-companies/new-company-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { FilterChipBar } from '@/components/ui/filter-chip'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchNewCompanyInquiriesResult } from '@/lib/new-companies/repository'
import type { NewCompanyInquiry, NewCompanyStatus } from '@/lib/new-companies/types'
import {
  NEW_COMPANY_STATUS_BADGE_CLASS,
  NEW_COMPANY_STATUS_LABELS,
  NEW_COMPANY_STATUSES,
} from '@/lib/new-companies/types'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type NewCompaniesWorkspaceProps = {
  result: FetchNewCompanyInquiriesResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; inquiry: NewCompanyInquiry }

type StatusFilter = 'all' | NewCompanyStatus

function matchesQuery(inquiry: NewCompanyInquiry, query: string) {
  if (!query) return true
  const haystack = [
    inquiry.contactName,
    inquiry.companyName,
    inquiry.region,
    inquiry.email,
    inquiry.phone,
    inquiry.product,
    inquiry.note,
    inquiry.sourceChannel,
    NEW_COMPANY_STATUS_LABELS[inquiry.status],
    inquiry.quantity == null ? '' : String(inquiry.quantity),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function NewCompaniesWorkspace({ result }: NewCompaniesWorkspaceProps) {
  const { afterSave, afterDelete } = useSaveFeedback()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const inquiries = result.ok ? result.inquiries : []
  const query = search.trim().toLowerCase()

  const statusFiltered = useMemo(() => {
    if (statusFilter === 'all') return inquiries
    return inquiries.filter((inquiry) => inquiry.status === statusFilter)
  }, [inquiries, statusFilter])

  const filtered = useMemo(
    () => statusFiltered.filter((inquiry) => matchesQuery(inquiry, query)),
    [statusFiltered, query],
  )

  const statusChips = [
    { value: 'all' as const, label: '전체', count: inquiries.length },
    ...NEW_COMPANY_STATUSES.map((status) => {
      const badge = NEW_COMPANY_STATUS_BADGE_CLASS[status]
      return {
        value: status as StatusFilter,
        label: NEW_COMPANY_STATUS_LABELS[status],
        count: inquiries.filter((inquiry) => inquiry.status === status).length,
        tone: {
          idleClassName: `ring-1 opacity-80 hover:opacity-100 ${badge}`,
          activeClassName: `ring-2 ring-offset-1 ring-slate-400 ${badge}`,
          activeCountClassName: 'opacity-80',
        },
      }
    }),
  ]

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

  function handleSaved(message?: string) {
    afterSave(message ?? '신규업체가 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '신규업체가 삭제되었습니다.', { close: closeModal })
  }

  if (!result.ok) {
    return <NewCompanyFetchError result={result} />
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="회사명, 담당자, 유입경로, 상태, 이메일, 연락처, 제품, 진행사항 검색…"
          accent="slate"
          filters={
            <FilterChipBar
              options={statusChips}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          }
          actions={<ErpButton onClick={openCreate}>신규업체 등록</ErpButton>}
        />

        <NewCompanyListTable
          inquiries={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query) || statusFilter !== 'all',
            emptyLabel: '등록된 신규업체가 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectInquiry={openEdit}
        />
      </PageShell>

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
