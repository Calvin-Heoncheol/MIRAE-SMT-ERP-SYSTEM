'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ExpenseReportFetchError } from '@/components/expense-reports/expense-report-fetch-error'
import { ExpenseReportListTable } from '@/components/expense-reports/expense-report-list-table'
import { ExpenseReportModal } from '@/components/expense-reports/expense-report-modal'
import { ListPagination } from '@/components/ui/list-pagination'
import type { FetchExpenseReportsResult } from '@/lib/expense-reports/repository'
import type { ExpenseReportListItem } from '@/lib/expense-reports/types'
import { useClientPagination } from '@/lib/ui/use-client-pagination'

type ExpenseReportsWorkspaceProps = {
  result: FetchExpenseReportsResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; report: ExpenseReportListItem }

export function ExpenseReportsWorkspace({ result }: ExpenseReportsWorkspaceProps) {
  const router = useRouter()
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const reports = result.ok ? result.reports : []
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
            새 지출결의서
          </button>
        </div>

        {!result.ok ? (
          <ExpenseReportFetchError result={result} />
        ) : (
          <>
            <ExpenseReportListTable
              reports={pagination.pageItems}
              emptyMessage="등록된 지출결의서가 없습니다"
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
      </div>

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
          onDeleted={handleSaved}
          onSignoffComplete={handleSignoffComplete}
        />
      ) : null}
    </>
  )
}
