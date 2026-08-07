'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExpenseReportFetchError } from '@/components/expense-reports/expense-report-fetch-error'
import { ExpenseReportListTable } from '@/components/expense-reports/expense-report-list-table'
import { ExpenseReportModal } from '@/components/expense-reports/expense-report-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { ListPagination } from '@/components/ui/list-pagination'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchExpenseReportsResult } from '@/lib/expense-reports/repository'
import type { ExpenseReportListItem } from '@/lib/expense-reports/types'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type ExpenseReportsWorkspaceProps = {
  result: FetchExpenseReportsResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; report: ExpenseReportListItem }

function matchesExpenseSearch(item: ExpenseReportListItem, query: string) {
  if (!query) return true
  const haystack = [
    item.docNumber,
    item.department,
    item.author,
    item.createdByName,
    item.accountCategory,
    item.processingDetails,
    item.recipient,
    item.writtenDate,
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function ExpenseReportsWorkspace({ result }: ExpenseReportsWorkspaceProps) {
  const router = useRouter()
  const { afterSave, afterDelete } = useSaveFeedback()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const query = search.trim().toLowerCase()
  const reports = useMemo(() => {
    const all = result.ok ? result.reports : []
    return all.filter((item) => matchesExpenseSearch(item, query))
  }, [result, query])
  const pagination = useClientPagination(reports)

  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(report: ExpenseReportListItem) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', report })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleSaved(message?: string) {
    afterSave(message ?? '지출결의서가 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '지출결의서가 삭제되었습니다.', { close: closeModal })
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
          searchPlaceholder="문서번호, 작성자, 계정과목, 지급처 검색…"
          accent="slate"
          actions={<ErpButton onClick={openCreate}>새 지출결의서</ErpButton>}
        />

        {!result.ok ? (
          <ExpenseReportFetchError result={result} />
        ) : (
          <>
            <ExpenseReportListTable
              reports={pagination.pageItems}
              emptyMessage={formatEmptyListMessage({
                hasQuery: Boolean(query),
                emptyLabel: '등록된 지출결의서가 없습니다',
                actionHint: '오른쪽 상단에서 작성하세요',
              })}
              onSelectReport={openEdit}
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
        <ExpenseReportModal
          key={
            modal.mode === 'edit'
              ? `edit-${modal.report.id}-${modalSession}`
              : `create-${modalSession}`
          }
          open
          mode={modal.mode}
          report={modal.mode === 'edit' ? modal.report : null}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onSignoffComplete={handleSignoffComplete}
        />
      ) : null}
    </>
  )
}
