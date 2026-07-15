'use client'

import { useMemo, useState } from 'react'
import { PostProcessHistoryFetchError } from '@/components/post-process/post-process-history-fetch-error'
import { PostProcessHistoryTable } from '@/components/post-process/post-process-history-table'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchPostProcessProductionHistoryResult } from '@/lib/post-process/repository'
import {
  filterPostProcessProductionHistory,
  POST_PROCESS_HISTORY_PAGE_SIZE,
  sumPostProcessHistoryQuantity,
} from '@/lib/post-process/history-utils'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type PostProcessHistoryWorkspaceProps = {
  result: FetchPostProcessProductionHistoryResult
}

export function PostProcessHistoryWorkspace({ result }: PostProcessHistoryWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const rows = result.ok ? result.rows : []
  const filtered = useMemo(() => filterPostProcessProductionHistory(rows, search), [rows, search])
  const totalQuantity = useMemo(() => sumPostProcessHistoryQuantity(filtered), [filtered])

  const totalPages = Math.max(1, Math.ceil(filtered.length / POST_PROCESS_HISTORY_PAGE_SIZE))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const startIdx = (currentPage - 1) * POST_PROCESS_HISTORY_PAGE_SIZE
  const pageRows = filtered.slice(startIdx, startIdx + POST_PROCESS_HISTORY_PAGE_SIZE)
  const showPager = filtered.length > POST_PROCESS_HISTORY_PAGE_SIZE

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  if (!result.ok) {
    return <PostProcessHistoryFetchError result={result} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <WorkspaceHeader
        subtitle="후공정 생산입력에서 등록된 완제품 세트 실적을 최신순으로 보여줍니다."
        totalCount={rows.length}
        filteredCount={filtered.length}
        hasQuery={Boolean(search.trim())}
        search={search}
        onSearchChange={handleSearchChange}
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
        rows={pageRows}
        emptyMessage={formatEmptyListMessage({
          hasQuery: Boolean(search.trim()),
          emptyLabel: '등록된 후공정 생산 이력이 없습니다',
          actionHint: '생산입력에서 등록하세요',
        })}
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
  )
}
