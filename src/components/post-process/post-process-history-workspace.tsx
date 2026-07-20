'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PostProcessHistoryFetchError } from '@/components/post-process/post-process-history-fetch-error'
import { PostProcessHistoryModal } from '@/components/post-process/post-process-history-modal'
import { PostProcessHistoryTable } from '@/components/post-process/post-process-history-table'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchPostProcessProductionHistoryResult } from '@/lib/post-process/repository'
import type { PostProcessProductionHistoryRow } from '@/lib/post-process/types'
import {
  filterPostProcessProductionHistory,
  sumPostProcessHistoryQuantity,
} from '@/lib/post-process/history-utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type PostProcessHistoryWorkspaceProps = {
  result: FetchPostProcessProductionHistoryResult
}

type ModalState = { open: false } | { open: true; row: PostProcessProductionHistoryRow }

export function PostProcessHistoryWorkspace({ result }: PostProcessHistoryWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })

  const rows = result.ok ? result.rows : []
  const filtered = useMemo(() => filterPostProcessProductionHistory(rows, search), [rows, search])
  const totalQuantity = useMemo(() => sumPostProcessHistoryQuantity(filtered), [filtered])
  const pagination = useClientPagination(filtered)

  function openDetail(row: PostProcessProductionHistoryRow) {
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
    return <PostProcessHistoryFetchError result={result} />
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <WorkspaceHeader
          subtitle="후공정 생산입력에서 등록된 완제품 세트 실적을 최신순으로 보여줍니다. 행을 클릭하면 삭제할 수 있습니다."
          totalCount={rows.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(search.trim())}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="주문서번호, 고객사, 완제품명, 기록일 검색…"
          accent="emerald"
          meta={
            <p className="mt-0.5 text-slate-500">
              수량 합계{' '}
              <span className="tabular-nums font-semibold text-emerald-800">
                {totalQuantity.toLocaleString('ko-KR')}
              </span>
            </p>
          }
        />

        <PostProcessHistoryTable
          rows={pagination.pageItems}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(search.trim()),
            emptyLabel: '등록된 후공정 생산 이력이 없습니다',
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

      <PostProcessHistoryModal
        open={modal.open}
        row={modal.open ? modal.row : null}
        onClose={closeModal}
        onDeleted={handleDeleted}
      />
    </>
  )
}
