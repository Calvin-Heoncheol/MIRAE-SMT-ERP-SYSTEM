'use client'

import { useMemo, useState } from 'react'
import { SmtHistoryFetchError } from '@/components/smt/smt-history-fetch-error'
import { SmtHistoryTable } from '@/components/smt/smt-history-table'
import type { FetchSmtProductionHistoryResult } from '@/lib/smt/repository'
import {
  filterSmtProductionHistory,
  SMT_HISTORY_PAGE_SIZE,
  sumSmtHistoryQuantity,
} from '@/lib/smt/history-utils'

type SmtHistoryWorkspaceProps = {
  result: FetchSmtProductionHistoryResult
}

export function SmtHistoryWorkspace({ result }: SmtHistoryWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

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

  if (!result.ok) {
    return <SmtHistoryFetchError result={result} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            SMT 생산입력에서 등록된 실적을 최신순으로 보여줍니다.
          </p>
        </div>
        <div className="text-right text-sm font-medium text-slate-600">
          <p>
            총 <span className="tabular-nums text-sky-700">{filtered.length.toLocaleString('ko-KR')}</span>건
            {search.trim() ? (
              <span className="text-slate-400"> / {rows.length.toLocaleString('ko-KR')}건</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-slate-500">
            수량 합계{' '}
            <span className="tabular-nums font-semibold text-sky-800">
              {totalQuantity.toLocaleString('ko-KR')}
            </span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => handleSearchChange(event.target.value)}
          placeholder="주문서번호, 고객사, 제품명, 기록일 검색…"
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-100 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2"
        />
      </div>

      <SmtHistoryTable
        rows={pageRows}
        emptyMessage={search.trim() ? '검색 결과가 없습니다' : '등록된 SMT 생산 이력이 없습니다'}
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
