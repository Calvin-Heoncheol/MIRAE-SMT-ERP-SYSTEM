'use client'

import { useMemo, useState } from 'react'
import { DirectStockBulkModal } from '@/components/materials/inventory/direct-stock-bulk-modal'
import { DirectStockModal } from '@/components/materials/inventory/direct-stock-modal'
import { InventoryFetchError } from '@/components/materials/inventory/inventory-fetch-error'
import { InventoryStatusTable } from '@/components/materials/inventory/inventory-status-table'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { ErpButton } from '@/components/ui/erp-button'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { FilterChipBar } from '@/components/ui/filter-chip'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { downloadExcel } from '@/lib/excel/export'
import type { FetchMaterialInventoryResult } from '@/lib/materials/inventory/repository'
import type { InventoryFilterMode, MaterialInventoryRow } from '@/lib/materials/inventory/types'
import {
  listInventoryCustomers,
  inventoryCustomerLabel,
  matchesInventoryCustomer,
  matchesInventoryFilter,
  matchesInventoryQuery,
} from '@/lib/materials/inventory/utils'
import { formatMaterialDisplayCode } from '@/lib/materials/utils'
import { erpSearchFocusClass, formatEmptyListMessage } from '@/lib/ui/tokens'

type InventoryStatusWorkspaceProps = {
  result: FetchMaterialInventoryResult
}

const FILTER_OPTIONS: { value: InventoryFilterMode; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: '도급', label: '도급' },
  { value: '사급', label: '사급' },
]

export function InventoryStatusWorkspace({ result }: InventoryStatusWorkspaceProps) {
  const { afterSave } = useSaveFeedback()
  const canAdjustStock = useCanDeleteRecords()
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<InventoryFilterMode>('all')
  const [customerFilter, setCustomerFilter] = useState('')
  const [directStockRow, setDirectStockRow] = useState<MaterialInventoryRow | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  const rows = result.ok ? result.rows : []
  const query = search.trim().toLowerCase()

  const searched = useMemo(
    () => rows.filter((row) => matchesInventoryQuery(row, query)),
    [rows, query],
  )

  const supplyFiltered = useMemo(
    () => searched.filter((row) => matchesInventoryFilter(row, filterMode)),
    [searched, filterMode],
  )

  const filtered = useMemo(
    () => supplyFiltered.filter((row) => matchesInventoryCustomer(row, customerFilter)),
    [supplyFiltered, customerFilter],
  )

  const customers = useMemo(() => listInventoryCustomers(rows), [rows])

  const filterOptions = useMemo(
    () =>
      FILTER_OPTIONS.map((option) => ({
        ...option,
        count: searched.filter((row) => matchesInventoryFilter(row, option.value)).length,
      })),
    [searched],
  )

  const hasExtraFilter = Boolean(query) || filterMode !== 'all' || Boolean(customerFilter.trim())

  async function handleExcelDownload() {
    await downloadExcel({
      fileName: filterMode === '사급' ? '사급자재재고현황' : '자재재고현황',
      sheetName: '재고현황',
      rows: filtered,
      columns: [
        { header: '고객사', value: (row) => inventoryCustomerLabel(row), width: 16 },
        { header: '품목코드', value: (row) => formatMaterialDisplayCode(row), width: 16 },
        { header: '품목명', value: (row) => row.materialName, width: 24 },
        { header: '규격', value: (row) => row.specification, width: 24 },
        { header: '패키지', value: (row) => row.package, width: 12 },
        { header: 'MPN', value: (row) => row.mpn, width: 20 },
        { header: '구분', value: (row) => row.type, width: 10 },
        { header: '입고예정', value: (row) => row.expectedInboundQuantity, width: 10 },
        { header: '현재고', value: (row) => row.onHandQuantity, width: 10 },
      ],
    })
  }

  return (
    <PageShell>
      {result.ok ? (
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="품목코드, 품목명, 고객사, MPN, 규격, 패키지 검색…"
          accent="slate"
          inlineFilters={
            <label className="block min-w-[12rem] max-w-[16rem] shrink-0">
              <span className="sr-only">고객사</span>
              <select
                value={customerFilter}
                onChange={(event) => setCustomerFilter(event.target.value)}
                className={`w-full min-w-[12rem] rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ${erpSearchFocusClass('slate')}`}
                aria-label="고객사"
              >
                <option value="">전체 고객사</option>
                {customers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          }
          actions={
            <>
              {canAdjustStock ? (
                <ErpButton variant="secondary" onClick={() => setBulkOpen(true)}>
                  일괄등록
                </ErpButton>
              ) : null}
              <ExcelDownloadButton onDownload={handleExcelDownload} disabled={!filtered.length} />
            </>
          }
          filters={
            <FilterChipBar options={filterOptions} value={filterMode} onChange={setFilterMode} />
          }
        />
      ) : null}

      {!result.ok ? (
        <InventoryFetchError result={result} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <InventoryStatusTable
            rows={filtered}
            emptyMessage={formatEmptyListMessage({
              hasQuery: hasExtraFilter,
              emptyLabel: '등록된 품목이 없습니다',
              actionHint: '품목등록에서 자재를 등록하세요',
            })}
            onSelectRow={setDirectStockRow}
          />
        </div>
      )}

      {directStockRow ? (
        <DirectStockModal
          open
          row={directStockRow}
          onClose={() => setDirectStockRow(null)}
          onSaved={() => {
            setDirectStockRow(null)
            afterSave('현재고가 반영되었습니다.')
          }}
        />
      ) : null}

      {bulkOpen ? (
        <DirectStockBulkModal
          open
          rows={rows}
          onClose={() => setBulkOpen(false)}
          onSaved={(message) => {
            setBulkOpen(false)
            afterSave(message ?? '현재고가 일괄 반영되었습니다.')
          }}
        />
      ) : null}
    </PageShell>
  )
}
