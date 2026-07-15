'use client'

import { useMemo, useState } from 'react'
import { InventoryFetchError } from '@/components/materials/inventory/inventory-fetch-error'
import { InventoryStatusTable } from '@/components/materials/inventory/inventory-status-table'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchMaterialInventoryResult } from '@/lib/materials/inventory/repository'
import type { InventoryFilterMode } from '@/lib/materials/inventory/types'
import {
  matchesInventoryFilter,
  matchesInventoryQuery,
  summarizeInventoryRows,
} from '@/lib/materials/inventory/utils'
import {
  ERP_FILTER_CHIP_ACTIVE_CLASS,
  ERP_FILTER_CHIP_IDLE_CLASS,
  formatEmptyListMessage,
} from '@/lib/ui/tokens'

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
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">등록 품목</p>
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

          <WorkspaceHeader
            totalCount={rows.length}
            filteredCount={filtered.length}
            hasQuery={Boolean(query) || filterMode !== 'all'}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="품목코드, 품목명, MPN, 규격 검색…"
            accent="blue"
            filters={
              <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map((option) => {
                  const active = filterMode === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFilterMode(option.value)}
                      className={[
                        'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                        active ? ERP_FILTER_CHIP_ACTIVE_CLASS : ERP_FILTER_CHIP_IDLE_CLASS,
                      ].join(' ')}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            }
          />
        </>
      ) : null}

      {!result.ok ? (
        <InventoryFetchError result={result} />
      ) : (
        <InventoryStatusTable
          rows={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query) || filterMode !== 'all',
            emptyLabel: '등록된 품목이 없습니다',
            actionHint: '품목등록에서 자재를 등록하세요',
          })}
        />
      )}
    </div>
  )
}
