'use client'

import { useMemo, useState } from 'react'
import { ItemBulkModal } from '@/components/items/item-bulk-modal'
import { ItemFetchError } from '@/components/items/item-fetch-error'
import { ItemListTable } from '@/components/items/item-list-table'
import { ItemModal } from '@/components/items/item-modal'
import { ItemNewMenu } from '@/components/items/item-new-menu'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { FilterChipBar } from '@/components/ui/filter-chip'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import { downloadExcel } from '@/lib/excel/export'
import type { FetchItemsResult } from '@/lib/items/repository'
import { updateItem } from '@/lib/items/repository'
import { itemPriceUpdatePayload, type ItemPriceField } from '@/lib/items/form-state'
import { displayItemUnitPrice, filterItemsForSearch, formatItemDisplayCode, formatItemProductionProcessLabel, formatItemUnitPrice } from '@/lib/items/utils'
import {
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  isProductItemCategory,
  type Item,
  type ItemCategory,
} from '@/lib/items/types'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type ItemsWorkspaceProps = {
  result: FetchItemsResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; initialCategory: ItemCategory | null }
  | { open: true; mode: 'edit'; item: Item }
  | { open: true; mode: 'bulk'; initialCategory: ItemCategory | null }

export function ItemsWorkspace({ result }: ItemsWorkspaceProps) {
  const { afterSave, afterDelete, afterUpdate } = useSaveFeedback()
  const { notifyAuthOrFailure } = useWriteFailureToast()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory>(ITEM_CATEGORIES[0])
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const items = result.ok ? result.items : []
  const query = search.trim()
  const hasActiveFilter = Boolean(query)

  const filtered = useMemo(() => {
    const searched = filterItemsForSearch(items, query)
    return searched.filter((item) => item.itemCategory === categoryFilter)
  }, [items, query, categoryFilter])

  const categoryCounts = useMemo(() => {
    const searched = filterItemsForSearch(items, query)
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<ItemCategory, number>
    for (const item of searched) {
      counts[item.itemCategory] += 1
    }
    return counts
  }, [items, query])

  const categoryFilterOptions = useMemo(
    () =>
      ITEM_CATEGORIES.map((category) => ({
        value: category,
        label: ITEM_CATEGORY_LABELS[category],
        count: categoryCounts[category],
      })),
    [categoryCounts],
  )

  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({
      open: true,
      mode: 'create',
      initialCategory: categoryFilter,
    })
  }

  function openBulk() {
    setModalSession((value) => value + 1)
    setModal({
      open: true,
      mode: 'bulk',
      initialCategory: categoryFilter,
    })
  }

  function openEdit(item: Item) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', item })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleSaved(message?: string) {
    afterSave(message ?? '품목이 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '품목이 삭제되었습니다.', { close: closeModal })
  }

  async function handlePriceFieldSave(item: Item, field: ItemPriceField, value: number) {
    const payload = itemPriceUpdatePayload(item, field, value)
    const result = await updateItem(item.id, payload)
    if (!result.ok) {
      notifyAuthOrFailure(result, { toastAllFailures: true, title: '단가 저장 실패' })
      return false
    }
    afterUpdate(undefined, { refresh: true })
    return true
  }

  async function handleExcelDownload() {
    const hideMaterialDetailColumns = isProductItemCategory(categoryFilter)
    const showProductionProcessColumn = categoryFilter === 4
    const showSemiFinishedPriceBreakdown = categoryFilter === 3

    function moneyExcel(value: number) {
      const amount = Math.max(0, Math.round(Number(value) || 0))
      return amount > 0 ? formatItemUnitPrice(amount) : ''
    }

    const processAndPriceColumns = showSemiFinishedPriceBreakdown
      ? [
          { header: 'SET-UP', value: (row: Item) => moneyExcel(row.setupUnitPrice), width: 12 },
          { header: 'SMD', value: (row: Item) => moneyExcel(row.smdUnitPrice), width: 12 },
          { header: '후공정', value: (row: Item) => moneyExcel(row.dipUnitPrice), width: 12 },
          { header: '자재', value: (row: Item) => moneyExcel(row.materialUnitPrice), width: 12 },
        ]
      : showProductionProcessColumn
        ? [
            {
              header: '생산 공정',
              value: (row: Item) => formatItemProductionProcessLabel(row),
              width: 12,
            },
            {
              header: '단가',
              value: (row: Item) => {
                const total = displayItemUnitPrice(row)
                return total > 0 ? formatItemUnitPrice(total) : ''
              },
              width: 12,
            },
          ]
        : []

    await downloadExcel({
      fileName: '품목등록',
      sheetName: '품목',
      rows: filtered,
      columns: [
        { header: '고객사명', value: (row) => row.customerName, width: 18 },
        { header: '품목코드', value: (row) => formatItemDisplayCode(row), width: 16 },
        { header: '품목구분', value: (row) => ITEM_CATEGORY_LABELS[row.itemCategory], width: 10 },
        { header: '품목명', value: (row) => row.name, width: 24 },
        ...(hideMaterialDetailColumns
          ? [
              { header: '버전', value: (row: Item) => row.version, width: 10 },
              ...processAndPriceColumns,
            ]
          : [
              { header: '공정구분', value: (row: Item) => row.materialType, width: 10 },
              { header: '패키지', value: (row: Item) => row.package, width: 12 },
              { header: '사양', value: (row: Item) => row.specification, width: 20 },
              { header: 'MPN', value: (row: Item) => row.mpn, width: 18 },
              { header: '도급/사급', value: (row: Item) => row.supplyType, width: 10 },
              ...processAndPriceColumns,
            ]),
        { header: '사용여부', value: (row) => (row.isActive === false ? '사용중지' : '사용중'), width: 10 },
      ],
    })
  }

  if (!result.ok) {
    return <ItemFetchError result={result} />
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="고객사, 품목코드, 품목명, 패키지, 사양, MPN 검색…"
          accent="slate"
          filters={
            <FilterChipBar
              options={categoryFilterOptions}
              value={categoryFilter}
              onChange={setCategoryFilter}
            />
          }
          actions={
            <div className="flex items-center gap-2">
              <ExcelDownloadButton onDownload={handleExcelDownload} disabled={!filtered.length} />
              <ItemNewMenu onOpenCreate={openCreate} onOpenBulk={openBulk} />
            </div>
          }
        />

        <ItemListTable
          items={filtered}
          categoryFilter={categoryFilter}
          inlineEditPrices={categoryFilter === 3}
          onPriceFieldSave={handlePriceFieldSave}
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '등록된 품목이 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectItem={openEdit}
        />
      </PageShell>

      {modal.open && modal.mode !== 'bulk' ? (
        <ItemModal
          key={`${modal.mode}-${modal.mode === 'edit' ? modal.item.id : 'create'}-${modalSession}`}
          open
          mode={modal.mode}
          item={modal.mode === 'edit' ? modal.item : null}
          initialCategory={modal.mode === 'create' ? modal.initialCategory : null}
          existingItems={items}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}

      {modal.open && modal.mode === 'bulk' ? (
        <ItemBulkModal
          key={`bulk-${modalSession}`}
          open
          initialCategory={modal.initialCategory}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      ) : null}
    </>
  )
}
