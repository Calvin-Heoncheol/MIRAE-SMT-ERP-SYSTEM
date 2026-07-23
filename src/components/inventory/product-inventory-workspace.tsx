'use client'

import { useMemo, useState } from 'react'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { FilterChipBar } from '@/components/ui/filter-chip'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { downloadExcel } from '@/lib/excel/export'
import type { FetchProductStockResult, ProductStockRow } from '@/lib/inventory/product-stock'
import { ITEM_CATEGORY_BADGE_CLASS, ITEM_PROCESS_TYPE_LABELS } from '@/lib/items/types'
import type { ItemProcessTypeValue } from '@/lib/items/types'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { ERP_TABLE_CLASS, ERP_TABLE_HEAD_CLASS, ERP_TABLE_TD_CLASS, ERP_TABLE_TH_CLASS, ERP_TABLE_WRAP_CLASS, formatEmptyListMessage } from '@/lib/ui/tokens'

type ProductInventoryWorkspaceProps = {
  result: FetchProductStockResult
}

type CategoryFilter = 'all' | '3' | '4'

function formatQty(value: number) {
  return value.toLocaleString('ko-KR')
}

function processLabel(processType: string) {
  if (processType === 'smt' || processType === 'post' || processType === 'smt_post') {
    return ITEM_PROCESS_TYPE_LABELS[processType as ItemProcessTypeValue]
  }
  return '—'
}

export function ProductInventoryWorkspace({ result }: ProductInventoryWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')

  const rows = result.ok ? result.rows : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (categoryFilter === '3' && row.itemCategory !== 3) return false
      if (categoryFilter === '4' && row.itemCategory !== 4) return false
      if (!query) return true
      const haystack = [row.itemId, row.itemName, row.itemCategoryLabel, processLabel(row.processType)]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [rows, categoryFilter, query])

  const pagination = useClientPagination(filtered)

  const categoryChips = useMemo(() => {
    const semi = rows.filter((row) => row.itemCategory === 3).length
    const finished = rows.filter((row) => row.itemCategory === 4).length
    return [
      { value: 'all' as const, label: '전체', count: rows.length },
      { value: '3' as const, label: '반제품', count: semi },
      { value: '4' as const, label: '완제품', count: finished },
    ]
  }, [rows])

  async function handleExcelDownload() {
    await downloadExcel({
      fileName: '제품재고현황',
      sheetName: '제품재고',
      rows: filtered,
      columns: [
        { header: '품목코드', value: (row) => row.itemId, width: 16 },
        { header: '품목명', value: (row) => row.itemName, width: 24 },
        { header: '구분', value: (row) => row.itemCategoryLabel, width: 10 },
        { header: '공정', value: (row) => processLabel(row.processType), width: 10 },
        { header: '생산', value: (row) => row.producedQuantity, width: 10 },
        { header: '출하', value: (row) => row.shippedQuantity, width: 10 },
        { header: '현재고', value: (row) => row.onHandQuantity, width: 10 },
      ],
    })
  }

  if (!result.ok) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <p className="font-semibold">
          {result.reason === 'env' ? '환경변수 필요' : '제품재고를 불러오지 못했습니다'}
        </p>
        <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
      <WorkspaceHeader
        subtitle="생산 − 출하(완제품 출하 시 반제품 BOM 차감 포함) = 현재고"
        totalCount={rows.length}
        filteredCount={filtered.length}
        hasQuery={Boolean(query) || categoryFilter !== 'all'}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="품목코드, 품목명 검색…"
        accent="slate"
        actions={<ExcelDownloadButton onDownload={handleExcelDownload} disabled={!filtered.length} />}
        filters={
          <FilterChipBar options={categoryChips} value={categoryFilter} onChange={setCategoryFilter} />
        }
      />

      <ProductInventoryTable
        rows={pagination.pageItems}
        emptyMessage={formatEmptyListMessage({
          hasQuery: Boolean(query) || categoryFilter !== 'all',
          emptyLabel: '등록된 반제품·완제품이 없습니다',
          actionHint: '품목등록에서 반제품·완제품을 등록하세요',
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
    </div>
  )
}

function ProductInventoryTable({
  rows,
  emptyMessage,
}: {
  rows: ProductStockRow[]
  emptyMessage: string
}) {
  if (!rows.length) {
    return <EmptyListState message={emptyMessage} hint="생산·출하 실적이 반영된 재고가 여기에 표시됩니다." />
  }

  return (
    <div className={`${ERP_TABLE_WRAP_CLASS} min-h-0 flex-1 overflow-hidden`}>
      <div className="min-h-0 flex-1 overflow-x-auto">
        <table className={`${ERP_TABLE_CLASS} min-w-[760px]`}>
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>품목코드</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>품목명</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-center`}>구분</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-center`}>공정</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-right`}>생산</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-right`}>출하</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-right`}>현재고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.itemId} className="border-t border-slate-100 hover:bg-slate-50/80">
                <td className={`${ERP_TABLE_TD_CLASS} font-semibold tabular-nums text-slate-900`}>
                  {row.itemId}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} text-slate-800`}>{row.itemName || '—'}</td>
                <td className={`${ERP_TABLE_TD_CLASS} text-center`}>
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${ITEM_CATEGORY_BADGE_CLASS[row.itemCategory]}`}
                  >
                    {row.itemCategoryLabel}
                  </span>
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} text-center text-slate-600`}>
                  {processLabel(row.processType)}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums text-slate-700`}>
                  {formatQty(row.producedQuantity)}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums text-slate-700`}>
                  {formatQty(row.shippedQuantity)}
                </td>
                <td
                  className={[
                    `${ERP_TABLE_TD_CLASS} text-right font-semibold tabular-nums`,
                    row.onHandQuantity < 0 ? 'text-rose-700' : 'text-slate-900',
                  ].join(' ')}
                >
                  {formatQty(row.onHandQuantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
