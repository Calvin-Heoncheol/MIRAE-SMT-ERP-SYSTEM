'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SmtHistoryFetchError } from '@/components/smt/smt-history-fetch-error'
import { SmtHistoryModal } from '@/components/smt/smt-history-modal'
import { SmtHistoryTable } from '@/components/smt/smt-history-table'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchSmtProductionHistoryResult } from '@/lib/smt/repository'
import type { SmtProductionHistoryRow } from '@/lib/smt/types'
import {
  filterSmtProductionHistory,
  sumSmtHistoryQuantity,
} from '@/lib/smt/history-utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type SmtHistoryWorkspaceProps = {
  result: FetchSmtProductionHistoryResult
}

type ModalState = { open: false } | { open: true; row: SmtProductionHistoryRow }

export function SmtHistoryWorkspace({ result }: SmtHistoryWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })

  const rows = result.ok ? result.rows : []
  const filtered = useMemo(() => filterSmtProductionHistory(rows, search), [rows, search])
  const totalQuantity = useMemo(() => sumSmtHistoryQuantity(filtered), [filtered])
  const pagination = useClientPagination(filtered)

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
          onSearchChange={setSearch}
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
          rows={pagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(search.trim()),
            emptyLabel: '등록된 SMT 생산 이력이 없습니다',
            actionHint: '생산입력에서 등록하세요',
          })}
          onRowClick={openDetail}
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

      <SmtHistoryModal
        open={modal.open}
        row={modal.open ? modal.row : null}
        onClose={closeModal}
        onDeleted={handleDeleted}
      />
    </>
  )
}
