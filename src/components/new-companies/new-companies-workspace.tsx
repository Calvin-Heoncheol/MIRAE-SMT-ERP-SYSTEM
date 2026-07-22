'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NewCompanyFetchError } from '@/components/new-companies/new-company-fetch-error'
import { NewCompanyListTable } from '@/components/new-companies/new-company-list-table'
import { NewCompanyModal } from '@/components/new-companies/new-company-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchNewCompanyInquiriesResult } from '@/lib/new-companies/repository'
import type { NewCompanyInquiry, NewCompanyStatus } from '@/lib/new-companies/types'
import {
  NEW_COMPANY_STATUS_BADGE_CLASS,
  NEW_COMPANY_STATUS_LABELS,
  NEW_COMPANY_STATUSES,
} from '@/lib/new-companies/types'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
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
  const router = useRouter()
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
  const pagination = useClientPagination(filtered)

  const statusChips: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: inquiries.length },
    ...NEW_COMPANY_STATUSES.map((status) => ({
      key: status as StatusFilter,
      label: NEW_COMPANY_STATUS_LABELS[status],
      count: inquiries.filter((inquiry) => inquiry.status === status).length,
    })),
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
      <div className="flex w-full flex-1 flex-col gap-4">
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="회사명, 담당자, 유입경로, 상태, 이메일, 연락처, 제품, 진행사항 검색…"
          accent="slate"
          filters={
            <div className="flex flex-wrap gap-2">
              {statusChips.map((chip) => {
                const active = statusFilter === chip.key
                const statusBadgeClass =
                  chip.key === 'all'
                    ? null
                    : NEW_COMPANY_STATUS_BADGE_CLASS[chip.key]
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setStatusFilter(chip.key)}
                    className={[
                      'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                      statusBadgeClass == null
                        ? active
                          ? 'bg-slate-800 text-white shadow-sm'
                          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                        : [
                            'ring-1',
                            statusBadgeClass,
                            active
                              ? 'ring-2 ring-offset-1 ring-slate-400'
                              : 'opacity-70 hover:opacity-100',
                          ].join(' '),
                    ].join(' ')}
                  >
                    {chip.label}{' '}
                    <span
                      className={
                        statusBadgeClass == null
                          ? active
                            ? 'text-slate-300'
                            : 'text-slate-400'
                          : 'opacity-80'
                      }
                    >
                      {chip.count.toLocaleString('ko-KR')}
                    </span>
                  </button>
                )
              })}
            </div>
          }
          actions={<ErpButton onClick={openCreate}>신규업체 등록</ErpButton>}
        />

        <NewCompanyListTable
          inquiries={pagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query) || statusFilter !== 'all',
            emptyLabel: '등록된 신규업체가 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectInquiry={openEdit}
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
