'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DirectStockModal } from '@/components/materials/inventory/direct-stock-modal'
import { InventoryFetchError } from '@/components/materials/inventory/inventory-fetch-error'
import { InventoryStatusTable } from '@/components/materials/inventory/inventory-status-table'
import { ErpButton } from '@/components/ui/erp-button'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchMaterialInventoryResult } from '@/lib/materials/inventory/repository'
import type { InventoryFilterMode } from '@/lib/materials/inventory/types'
import { matchesInventoryFilter, matchesInventoryQuery } from '@/lib/materials/inventory/utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
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
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<InventoryFilterMode>('all')
  const [directStockOpen, setDirectStockOpen] = useState(false)

  const rows = result.ok ? result.rows : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () =>
      rows.filter(
        (row) => matchesInventoryQuery(row, query) && matchesInventoryFilter(row, filterMode),
      ),
    [rows, query, filterMode],
  )
  const pagination = useClientPagination(filtered)

  return (
    <div className="flex w-full flex-1 flex-col gap-4">
      {result.ok ? (
        <WorkspaceHeader
          totalCount={rows.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(query) || filterMode !== 'all'}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="품목코드, 품목명, MPN, 규격 검색…"
          accent="blue"
          actions={<ErpButton onClick={() => setDirectStockOpen(true)}>직접재고</ErpButton>}
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
      ) : null}

      {!result.ok ? (
        <InventoryFetchError result={result} />
      ) : (
        <>
          <InventoryStatusTable
            rows={pagination.pageItems}
            emptyMessage={formatEmptyListMessage({
              hasQuery: Boolean(query) || filterMode !== 'all',
              emptyLabel: '등록된 품목이 없습니다',
              actionHint: '품목등록에서 자재를 등록하세요',
            })}
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

      {directStockOpen ? (
        <DirectStockModal
          open
          rows={rows}
          onClose={() => setDirectStockOpen(false)}
          onSaved={() => {
            setDirectStockOpen(false)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}
