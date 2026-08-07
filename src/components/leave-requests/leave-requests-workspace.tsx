'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LeaveRequestFetchError } from '@/components/leave-requests/leave-request-fetch-error'
import { LeaveRequestListTable } from '@/components/leave-requests/leave-request-list-table'
import { LeaveRequestModal } from '@/components/leave-requests/leave-request-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { ListPagination } from '@/components/ui/list-pagination'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchLeaveRequestsResult } from '@/lib/leave-requests/repository'
import type { LeaveRequestListItem } from '@/lib/leave-requests/types'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type LeaveRequestsWorkspaceProps = {
  result: FetchLeaveRequestsResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; request: LeaveRequestListItem }

function matchesLeaveSearch(item: LeaveRequestListItem, query: string) {
  if (!query) return true
  const haystack = [
    item.docNumber,
    item.department,
    item.position,
    item.author,
    item.createdByName,
    item.leaveType,
    item.reason,
    item.writtenDate,
    item.startDate,
    item.endDate,
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function LeaveRequestsWorkspace({ result }: LeaveRequestsWorkspaceProps) {
  const router = useRouter()
  const { afterSave, afterDelete } = useSaveFeedback()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const query = search.trim().toLowerCase()
  const requests = useMemo(() => {
    const all = result.ok ? result.requests : []
    return all.filter((item) => matchesLeaveSearch(item, query))
  }, [result, query])
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

  function handleSaved(message?: string) {
    afterSave(message ?? '휴가원이 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '휴가원이 삭제되었습니다.', { close: closeModal })
  }

  function handleSignoffComplete() {
    router.refresh()
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="문서번호, 작성자, 부서, 휴가유형, 사유 검색…"
          accent="slate"
          actions={<ErpButton onClick={openCreate}>새 휴가원</ErpButton>}
        />

        {!result.ok ? (
          <LeaveRequestFetchError result={result} />
        ) : (
          <>
            <LeaveRequestListTable
              requests={pagination.pageItems}
              emptyMessage={formatEmptyListMessage({
                hasQuery: Boolean(query),
                emptyLabel: '등록된 휴가원이 없습니다',
                actionHint: '오른쪽 상단에서 작성하세요',
              })}
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
      </PageShell>

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
          onDeleted={handleDeleted}
          onSignoffComplete={handleSignoffComplete}
        />
      ) : null}
    </>
  )
}
