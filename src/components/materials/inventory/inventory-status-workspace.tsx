'use client'

import { useMemo, useState } from 'react'
import { InventoryFetchError } from '@/components/materials/inventory/inventory-fetch-error'
import { InventoryStatusTable } from '@/components/materials/inventory/inventory-status-table'
import type { FetchMaterialInventoryResult } from '@/lib/materials/inventory/repository'
import type { InventoryFilterMode } from '@/lib/materials/inventory/types'
import {
  matchesInventoryFilter,
  matchesInventoryQuery,
  summarizeInventoryRows,
} from '@/lib/materials/inventory/utils'

type InventoryStatusWorkspaceProps = {
  result: FetchMaterialInventoryResult
}

const FILTER_OPTIONS: { value: InventoryFilterMode; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '입고예정 있음' },
  { value: 'negative', label: '현재고 마이너스' },
]

export function InventoryStatusWorkspace({ result }: InventoryStatusWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<InventoryFilterMode>('all')

  const rows = result.ok ? result.rows : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) => matchesInventoryQuery(row, query) && matchesInventoryFilter(row, filterMode),
      ),
    [rows, query, filterMode],
  )

  const summary = useMemo(() => summarizeInventoryRows(rows), [rows])

  return (
    <div className="flex w-full flex-col gap-4">
      {result.ok ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">등록 자재</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                {summary.total.toLocaleString('ko-KR')}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase">입고예정 있음</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900">
                {summary.expectedInboundCount.toLocaleString('ko-KR')}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold tracking-wide text-rose-800 uppercase">현재고 마이너스</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-rose-900">
                {summary.negativeCount.toLocaleString('ko-KR')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {FILTER_OPTIONS.map((option) => {
                const active = filterMode === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilterMode(option.value)}
                    className={[
                      'rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors',
                      active
                        ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            <p className="text-sm font-medium text-slate-600">
              표시{' '}
              <span className="tabular-nums text-blue-700">{filtered.length.toLocaleString('ko-KR')}</span>건
              {query || filterMode !== 'all' ? (
                <span className="text-slate-400"> / {rows.length.toLocaleString('ko-KR')}건</span>
              ) : null}
            </p>
          </div>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="자재코드, 고객사, 자재명, MPN 검색…"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-blue-100 placeholder:text-slate-400 focus:border-blue-300 focus:ring-2"
          />
        </>
      ) : null}

      {!result.ok ? (
        <InventoryFetchError result={result} />
      ) : (
        <InventoryStatusTable
          rows={filtered}
          emptyMessage={
            query || filterMode !== 'all' ? '조건에 맞는 재고 항목이 없습니다' : '등록된 자재가 없습니다'
          }
        />
      )}
    </div>
  )
}
