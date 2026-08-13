'use client'

import { useMemo, useState } from 'react'
import { UsersModal } from '@/components/users/users-modal'
import { UsersTable } from '@/components/users/users-table'
import { ErpButton } from '@/components/ui/erp-button'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import {
  formatAuthDepartmentLabel,
  formatAuthRoleLabel,
} from '@/lib/auth/types'
import type { FetchErpUsersResult } from '@/lib/users/actions'
import type { ErpUserRow } from '@/lib/users/types'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
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
  const { afterSave, afterDelete } = useSaveFeedback()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const users = result.ok ? result.users : []
  const query = search.trim().toLowerCase()
  const filtered = useMemo(
    () => users.filter((user) => matchesQuery(user, query)),
    [users, query],
  )
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

  function handleSaved(message?: string) {
    afterSave(message ?? '사용자가 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '사용자가 삭제되었습니다.', { close: closeModal })
  }

  if (!result.ok) {
    return (
      <FetchErrorBanner
        reason={result.reason}
        title="사용자 목록을 불러오지 못했습니다"
        detail={result.detail}
        hint={
          result.reason === 'env' ? (
            <>
              Supabase Dashboard → Project Settings → API →{' '}
              <code className="font-mono">service_role</code> 키를{' '}
              <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> 로 넣으세요. 로컬은{' '}
              <code className="font-mono">.env.local</code>, 배포는 Vercel Environment Variables에
              추가한 뒤 재배포하세요. (브라우저/계정 문제가 아닙니다.)
            </>
          ) : null
        }
      />
    )
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="이름, 이메일, 역할, 부서 검색…"
          accent="slate"
          actions={<ErpButton onClick={openCreate}>사용자 등록</ErpButton>}
        />

        <UsersTable
          users={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query),
            emptyLabel: '등록된 사용자가 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectUser={openEdit}
        />
      </PageShell>

      <UsersModal
        key={modalSession}
        open={modal.open}
        mode={modal.open ? modal.mode : 'create'}
        user={modal.open && modal.mode === 'edit' ? modal.user : null}
        onClose={closeModal}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </>
  )
}
