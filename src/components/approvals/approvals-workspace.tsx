'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ApprovalFetchError } from '@/components/approvals/approval-fetch-error'
import { ApprovalListTable } from '@/components/approvals/approval-list-table'
import { ApprovalModal } from '@/components/approvals/approval-modal'
import {
  APPROVAL_CATEGORIES,
  getApprovalCategoryLabel,
  type ApprovalCategory,
} from '@/lib/approvals/categories'
import type { FetchApprovalsResult } from '@/lib/approvals/repository'
import type { ApprovalListItem } from '@/lib/approvals/types'
import { filterApprovalsByCategory } from '@/lib/approvals/utils'

type ApprovalsWorkspaceProps = {
  category: ApprovalCategory
  result: FetchApprovalsResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; approval: ApprovalListItem }

export function ApprovalsWorkspace({ category, result }: ApprovalsWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const approvals = result.ok ? filterApprovalsByCategory(result.approvals, category) : []

  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(approval: ApprovalListItem) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', approval })
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
      <div className="flex min-h-[calc(100dvh-60px)] w-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">결재서 · 품의서</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">품의서 관리</h1>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
          >
            새 품의서
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {APPROVAL_CATEGORIES.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.slug}
                href={item.href}
                className={[
                  'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                    active
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                {item.shortLabel}
              </Link>
            )
          })}
        </div>

        {!result.ok ? (
          <ApprovalFetchError result={result} />
        ) : (
          <ApprovalListTable
            approvals={approvals}
            emptyMessage={`등록된 ${getApprovalCategoryLabel(category)} 품의서가 없습니다`}
            onSelectApproval={openEdit}
          />
        )}
      </div>

      {modal.open ? (
        <ApprovalModal
          key={
            modal.mode === 'edit'
              ? `edit-${modal.approval.id}-${modalSession}`
              : `create-${category}-${modalSession}`
          }
          open
          mode={modal.mode}
          category={category}
          approval={modal.mode === 'edit' ? modal.approval : null}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleSaved}
          onSignoffComplete={handleSignoffComplete}
        />
      ) : null}
    </>
  )
}
