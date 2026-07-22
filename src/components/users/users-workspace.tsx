'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UsersModal } from '@/components/users/users-modal'
import { UsersTable } from '@/components/users/users-table'
import { ErpButton } from '@/components/ui/erp-button'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import {
  formatAuthDepartmentLabel,
  formatAuthRoleLabel,
} from '@/lib/auth/types'
import type { FetchErpUsersResult } from '@/lib/users/actions'
import type { ErpUserRow } from '@/lib/users/types'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type UsersWorkspaceProps = {
  result: FetchErpUsersResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; user: ErpUserRow }

function matchesQuery(user: ErpUserRow, query: string) {
  if (!query) return true
  const haystack = [
    user.displayName,
    user.email,
    formatAuthRoleLabel(user.role),
    formatAuthDepartmentLabel(user.department),
    user.role,
    user.department || '',
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function UsersWorkspace({ result }: UsersWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const users = result.ok ? result.users : []
  const query = search.trim().toLowerCase()
  const filtered = useMemo(
    () => users.filter((user) => matchesQuery(user, query)),
    [users, query],
  )
  const pagination = useClientPagination(filtered)

  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(user: ErpUserRow) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', user })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleSaved() {
    closeModal()
    router.refresh()
  }

  if (!result.ok) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-800">
        <p className="font-semibold">사용자 목록을 불러오지 못했습니다.</p>
        <p className="mt-2 text-rose-700">{result.detail}</p>
        {result.reason === 'env' ? (
          <p className="mt-3 text-rose-700">
            Dashboard → Project Settings → API → <code className="font-mono">service_role</code> 키를
            `.env.local`의 <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> 에 넣고 개발
            서버를 재시작하세요.
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <div className="flex w-full flex-1 flex-col gap-4">
        <WorkspaceHeader
          title="사용자등록"
          totalCount={users.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(query)}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="이름, 이메일, 역할, 부서 검색…"
          accent="slate"
          actions={<ErpButton onClick={openCreate}>사용자 등록</ErpButton>}
        />

        <UsersTable
          users={pagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query),
            emptyLabel: '등록된 사용자가 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectUser={openEdit}
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

      <UsersModal
        key={modalSession}
        open={modal.open}
        mode={modal.open ? modal.mode : 'create'}
        user={modal.open && modal.mode === 'edit' ? modal.user : null}
        onClose={closeModal}
        onSaved={handleSaved}
        onDeleted={handleSaved}
      />
    </>
  )
}
