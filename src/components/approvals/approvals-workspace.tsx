'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ApprovalFetchError } from '@/components/approvals/approval-fetch-error'
import { ApprovalListTable } from '@/components/approvals/approval-list-table'
import { ApprovalModal } from '@/components/approvals/approval-modal'
import { ErpButton } from '@/components/ui/erp-button'
import {
  filterChipClassName,
  filterChipCountClassName,
} from '@/components/ui/filter-chip'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import {
  APPROVAL_CATEGORIES,
  APPROVAL_CATEGORY_FILTER_IDLE_CLASS,
  getApprovalCategoryLabel,
  type ApprovalCategory,
} from '@/lib/approvals/categories'
import type { FetchApprovalsResult } from '@/lib/approvals/repository'
import type { ApprovalListItem } from '@/lib/approvals/types'
import { filterApprovalsByCategory } from '@/lib/approvals/utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type ApprovalsWorkspaceProps = {
  category: ApprovalCategory
  result: FetchApprovalsResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; approval: ApprovalListItem }

function matchesApprovalSearch(item: ApprovalListItem, query: string) {
  if (!query) return true
  const haystack = [
    item.docNumber,
    item.subject,
    item.department,
    item.author,
    item.createdByName,
    item.writtenDate,
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function ApprovalsWorkspace({ category, result }: ApprovalsWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const query = search.trim().toLowerCase()
  const allApprovals = result.ok ? result.approvals : []
  const approvals = useMemo(() => {
    return filterApprovalsByCategory(allApprovals, category).filter((item) =>
      matchesApprovalSearch(item, query),
    )
  }, [allApprovals, category, query])
  const pagination = useClientPagination(approvals)

  const categoryCounts = useMemo(() => {
    const counts = Object.fromEntries(
      APPROVAL_CATEGORIES.map((item) => [item.slug, 0]),
    ) as Record<ApprovalCategory, number>
    for (const approval of allApprovals) {
      if (approval.category in counts) counts[approval.category] += 1
    }
    return counts
  }, [allApprovals])

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
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="문서번호, 제목, 작성자, 부서 검색…"
          accent="slate"
          filters={
            <div className="flex flex-wrap gap-1.5">
              {APPROVAL_CATEGORIES.map((item) => {
                const active = pathname === item.href
                const tone = {
                  idleClassName: APPROVAL_CATEGORY_FILTER_IDLE_CLASS[item.slug],
                }
                return (
                  <Link
                    key={item.slug}
                    href={item.href}
                    className={filterChipClassName(active, tone)}
                  >
                    <span>{item.shortLabel}</span>
                    <span className={`tabular-nums ${filterChipCountClassName(active, tone)}`}>
                      {categoryCounts[item.slug].toLocaleString('ko-KR')}
                    </span>
                  </Link>
                )
              })}
            </div>
          }
          actions={<ErpButton onClick={openCreate}>새 품의서</ErpButton>}
        />

        {!result.ok ? (
          <ApprovalFetchError result={result} />
        ) : (
          <>
            <ApprovalListTable
              approvals={pagination.pageItems}
              emptyMessage={formatEmptyListMessage({
                hasQuery: Boolean(query),
                emptyLabel: `등록된 ${getApprovalCategoryLabel(category)} 품의서가 없습니다`,
                actionHint: '오른쪽 상단에서 작성하세요',
              })}
              hideCategory
              onSelectApproval={openEdit}
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
