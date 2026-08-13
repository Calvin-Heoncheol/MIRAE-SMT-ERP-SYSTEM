'use client'

import { useMemo, useState } from 'react'
import { DirectStockModal } from '@/components/materials/inventory/direct-stock-modal'
import { InventoryFetchError } from '@/components/materials/inventory/inventory-fetch-error'
import { InventoryStatusTable } from '@/components/materials/inventory/inventory-status-table'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { FilterChipBar } from '@/components/ui/filter-chip'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { downloadExcel } from '@/lib/excel/export'
import type { FetchMaterialInventoryResult } from '@/lib/materials/inventory/repository'
import type { InventoryFilterMode, MaterialInventoryRow } from '@/lib/materials/inventory/types'
import {
  listInventoryConsigneeCustomers,
  matchesInventoryCustomer,
  matchesInventoryFilter,
  matchesInventoryQuery,
} from '@/lib/materials/inventory/utils'
import { formatMaterialDisplayCode } from '@/lib/materials/utils'
import { ERP_SEARCH_INPUT_BASE, formatEmptyListMessage } from '@/lib/ui/tokens'

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
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<InventoryFilterMode>('all')
  const [customerQuery, setCustomerQuery] = useState('')
  const [directStockRow, setDirectStockRow] = useState<MaterialInventoryRow | null>(null)

  const rows = result.ok ? result.rows : []
  const query = search.trim().toLowerCase()
  const showCustomerFilter = filterMode === '사급'

  const searched = useMemo(
    () => rows.filter((row) => matchesInventoryQuery(row, query)),
    [rows, query],
  )

  const supplyFiltered = useMemo(
    () => searched.filter((row) => matchesInventoryFilter(row, filterMode)),
    [searched, filterMode],
  )

  const filtered = useMemo(() => {
    if (!showCustomerFilter) return supplyFiltered
    return supplyFiltered.filter((row) => matchesInventoryCustomer(row, customerQuery))
  }, [supplyFiltered, showCustomerFilter, customerQuery])

  const consigneeCustomers = useMemo(
    () => listInventoryConsigneeCustomers(searched),
    [searched],
  )

  const filterOptions = useMemo(
    () =>
      FILTER_OPTIONS.map((option) => ({
        ...option,
        count: searched.filter((row) => matchesInventoryFilter(row, option.value)).length,
      })),
    [searched],
  )

  const hasExtraFilter = Boolean(query) || filterMode !== 'all' || Boolean(customerQuery.trim())

  async function handleExcelDownload() {
    await downloadExcel({
      fileName: filterMode === '사급' ? '사급자재재고현황' : '자재재고현황',
      sheetName: '재고현황',
      rows: filtered,
      columns: [
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
          searchPlaceholder="품목코드, 품목명, MPN, 규격, 패키지 검색…"
          accent="slate"
          actions={
            <ExcelDownloadButton onDownload={handleExcelDownload} disabled={!filtered.length} />
          }
          filters={
            <div className="flex w-full flex-col gap-2.5">
              <FilterChipBar
                options={filterOptions}
                value={filterMode}
                onChange={(value) => {
                  setFilterMode(value)
                  if (value !== '사급') setCustomerQuery('')
                }}
              />
              {showCustomerFilter ? (
                <div className="flex w-full flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor="inventory-consignee-customer">
                    고객사
                  </label>
                  <input
                    id="inventory-consignee-customer"
                    type="search"
                    list="inventory-consignee-customer-list"
                    value={customerQuery}
                    onChange={(event) => setCustomerQuery(event.target.value)}
                    placeholder="고객사 검색 (사급 공급사)"
                    className={`${ERP_SEARCH_INPUT_BASE} min-w-[14rem] max-w-md flex-1`}
                  />
                  <datalist id="inventory-consignee-customer-list">
                    {consigneeCustomers.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  {customerQuery.trim() ? (
                    <button
                      type="button"
                      onClick={() => setCustomerQuery('')}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      고객사 초기화
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
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
    </PageShell>
  )
}
