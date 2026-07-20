'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LeaveRequestFetchError } from '@/components/leave-requests/leave-request-fetch-error'
import { LeaveRequestListTable } from '@/components/leave-requests/leave-request-list-table'
import { LeaveRequestModal } from '@/components/leave-requests/leave-request-modal'
import { ListPagination } from '@/components/ui/list-pagination'
import type { FetchLeaveRequestsResult } from '@/lib/leave-requests/repository'
import type { LeaveRequestListItem } from '@/lib/leave-requests/types'
import { useClientPagination } from '@/lib/ui/use-client-pagination'

type LeaveRequestsWorkspaceProps = {
  result: FetchLeaveRequestsResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; request: LeaveRequestListItem }

export function LeaveRequestsWorkspace({ result }: LeaveRequestsWorkspaceProps) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const requests = result.ok ? result.requests : []
  const pagination = useClientPagination(requests)

  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(request: LeaveRequestListItem) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', request })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleSaved() {
    closeModal()
    router.refresh()
  }

  function handleSignoffComplete() {
    router.refresh()
  }

  return (
    <>
      <div className="flex w-full flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
          >
            새 휴가원
          </button>
        </div>

        {!result.ok ? (
          <LeaveRequestFetchError result={result} />
        ) : (
          <>
            <LeaveRequestListTable
              requests={pagination.pageItems}
              emptyMessage="등록된 휴가원이 없습니다"
              onSelectRequest={openEdit}
            />

            <ListPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={pagination.setPage}
              rangeStart={pagination.rangeStart}
              rangeEnd={pagination.rangeEnd}
              totalCount={pagination.totalCount}
            />
          </>
        )}
      </div>

      {modal.open ? (
        <LeaveRequestModal
          key={
            modal.mode === 'edit'
              ? `edit-${modal.request.id}-${modalSession}`
              : `create-${modalSession}`
          }
          open
          mode={modal.mode}
          request={modal.mode === 'edit' ? modal.request : null}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleSaved}
          onSignoffComplete={handleSignoffComplete}
        />
      ) : null}
    </>
  )
}
