'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DirectStockModal } from '@/components/materials/inventory/direct-stock-modal'
import { InventoryFetchError } from '@/components/materials/inventory/inventory-fetch-error'
import { InventoryStatusTable } from '@/components/materials/inventory/inventory-status-table'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { downloadExcel } from '@/lib/excel/export'
import type { FetchMaterialInventoryResult } from '@/lib/materials/inventory/repository'
import type { InventoryFilterMode, MaterialInventoryRow } from '@/lib/materials/inventory/types'
import { matchesInventoryFilter, matchesInventoryQuery } from '@/lib/materials/inventory/utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type InventoryStatusWorkspaceProps = {
  result: FetchMaterialInventoryResult
}

const FILTER_OPTIONS: { value: InventoryFilterMode; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '입고예정 있음' },
  { value: 'below', label: '안전재고 미달' },
  { value: 'negative', label: '현재고 마이너스' },
]

export function InventoryStatusWorkspace({ result }: InventoryStatusWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<InventoryFilterMode>('all')
  const [directStockRow, setDirectStockRow] = useState<MaterialInventoryRow | null>(null)

  const rows = result.ok ? result.rows : []
  const query = search.trim().toLowerCase()

  const searched = useMemo(
    () => rows.filter((row) => matchesInventoryQuery(row, query)),
    [rows, query],
  )

  const filtered = useMemo(
    () => searched.filter((row) => matchesInventoryFilter(row, filterMode)),
    [searched, filterMode],
  )
  const pagination = useClientPagination(filtered)

  const filterOptions = useMemo(
    () =>
      FILTER_OPTIONS.map((option) => ({
        ...option,
        count: searched.filter((row) => matchesInventoryFilter(row, option.value)).length,
        tone:
          option.value === 'pending'
            ? STATUS_FILTER_TONES.progress
            : option.value === 'below'
              ? {
                  idleClassName:
                    'border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
                  activeClassName: 'bg-amber-700 text-white shadow-sm',
                  activeCountClassName: 'text-amber-100',
                }
            : option.value === 'negative'
              ? {
                  idleClassName:
                    'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
                  activeClassName: 'bg-rose-700 text-white shadow-sm',
                  activeCountClassName: 'text-rose-100',
                }
              : undefined,
      })),
    [searched],
  )

  async function handleExcelDownload() {
    await downloadExcel({
      fileName: '자재재고현황',
      sheetName: '재고현황',
      rows: filtered,
      columns: [
        { header: '품목코드', value: (row) => row.id, width: 16 },
        { header: '품목명', value: (row) => row.materialName, width: 24 },
        { header: '규격', value: (row) => row.specification, width: 24 },
        { header: 'MPN', value: (row) => row.mpn, width: 20 },
        { header: '구분', value: (row) => row.type, width: 10 },
        { header: '도급/사급', value: (row) => row.supplyType, width: 10 },
        { header: '입고예정', value: (row) => row.expectedInboundQuantity, width: 10 },
        { header: '현재고', value: (row) => row.onHandQuantity, width: 10 },
        { header: '안전재고', value: (row) => row.safetyStock, width: 10 },
      ],
    })
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
      {result.ok ? (
        <WorkspaceHeader
          totalCount={rows.length}
          filteredCount={filtered.length}
          hasQuery={Boolean(query) || filterMode !== 'all'}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="품목코드, 품목명, MPN, 규격 검색…"
          accent="slate"
          actions={
            <ExcelDownloadButton onDownload={handleExcelDownload} disabled={!filtered.length} />
          }
          filters={
            <FilterChipBar
              options={filterOptions}
              value={filterMode}
              onChange={setFilterMode}
            />
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
            onSelectRow={setDirectStockRow}
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

      {directStockRow ? (
        <DirectStockModal
          open
          row={directStockRow}
          onClose={() => setDirectStockRow(null)}
          onSaved={() => {
            setDirectStockRow(null)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}
