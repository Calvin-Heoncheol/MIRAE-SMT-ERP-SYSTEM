'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SmtHistoryFetchError } from '@/components/smt/smt-history-fetch-error'
import { SmtHistoryModal } from '@/components/smt/smt-history-modal'
import { SmtHistoryTable } from '@/components/smt/smt-history-table'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchSmtProductionHistoryResult } from '@/lib/smt/repository'
import type { SmtProductionHistoryRow } from '@/lib/smt/types'
import {
  filterSmtProductionHistory,
  SMT_HISTORY_PAGE_SIZE,
  sumSmtHistoryQuantity,
} from '@/lib/smt/history-utils'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type SmtHistoryWorkspaceProps = {
  result: FetchSmtProductionHistoryResult
}

type ModalState = { open: false } | { open: true; row: SmtProductionHistoryRow }

export function SmtHistoryWorkspace({ result }: SmtHistoryWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<ModalState>({ open: false })

  const rows = result.ok ? result.rows : []
  const filtered = useMemo(() => filterSmtProductionHistory(rows, search), [rows, search])
  const totalQuantity = useMemo(() => sumSmtHistoryQuantity(filtered), [filtered])

  const totalPages = Math.max(1, Math.ceil(filtered.length / SMT_HISTORY_PAGE_SIZE))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const startIdx = (currentPage - 1) * SMT_HISTORY_PAGE_SIZE
  const pageRows = filtered.slice(startIdx, startIdx + SMT_HISTORY_PAGE_SIZE)
  const showPager = filtered.length > SMT_HISTORY_PAGE_SIZE

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function openDetail(row: SmtProductionHistoryRow) {
    setModal({ open: true, row })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleDeleted() {
    closeModal()
    router.refresh()
  }

  if (!result.ok) {
    return <SmtHistoryFetchError result={result} />
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <WorkspaceHeader
          totalCount={rows.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(search.trim())}
          search={search}
          onSearchChange={handleSearchChange}
          searchPlaceholder="주문서번호, 고객사, 제품명, 기록일 검색…"
          accent="sky"
          meta={
            <p className="mt-0.5 text-slate-500">
              수량 합계{' '}
              <span className="tabular-nums font-semibold text-sky-800">
                {totalQuantity.toLocaleString('ko-KR')}
              </span>
            </p>
          }
        />

        <SmtHistoryTable
          rows={pageRows}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(search.trim()),
            emptyLabel: '등록된 SMT 생산 이력이 없습니다',
            actionHint: '생산입력에서 등록하세요',
          })}
          onRowClick={openDetail}
        />

        {showPager ? (
          <div className="flex items-center justify-center gap-3 pt-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              이전
            </button>
            <span className="text-sm tabular-nums text-slate-600">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음
            </button>
          </div>
        ) : null}
      </div>

      <SmtHistoryModal
        open={modal.open}
        row={modal.open ? modal.row : null}
        onClose={closeModal}
        onDeleted={handleDeleted}
      />
    </>
  )
}
