'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ExpenseReportFetchError } from '@/components/expense-reports/expense-report-fetch-error'
import { ExpenseReportListTable } from '@/components/expense-reports/expense-report-list-table'
import { ExpenseReportModal } from '@/components/expense-reports/expense-report-modal'
import type { FetchExpenseReportsResult } from '@/lib/expense-reports/repository'
import type { ExpenseReportListItem } from '@/lib/expense-reports/types'

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
      <div className="flex min-h-[calc(100vh-60px)] w-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">결재서 · 지출결의서</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">지출결의서 관리</h1>
            <p className="mt-1 text-sm text-slate-500">지출결의서를 작성하고 결재·목록을 관리합니다.</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            새 지출결의서
          </button>
        </div>

        {!result.ok ? (
          <ExpenseReportFetchError result={result} />
        ) : (
          <ExpenseReportListTable
            reports={reports}
            emptyMessage="등록된 지출결의서가 없습니다"
            onSelectReport={openEdit}
          />
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
