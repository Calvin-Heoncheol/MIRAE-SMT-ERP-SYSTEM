'use client'

import { useMemo, useState } from 'react'
import { BomModal } from '@/components/bom/bom-modal'
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
import type { FetchBomResult } from '@/lib/bom/repository'
import type { BomGroup } from '@/lib/bom/types'
import { groupBomLines } from '@/lib/bom/utils'
import { downloadExcel } from '@/lib/excel/export'
import type { FetchItemsResult } from '@/lib/items/repository'
import { excelProductionStdTopBot } from '@/lib/items/production-std'
import {
  displayItemDipUnitPrice,
  displayItemMaterialUnitPrice,
  displayItemSmdUnitPrice,
  filterItemsForSearch,
  formatItemDisplayCode,
  formatItemPcbSideModeLabel,
  formatItemProductionProcessLabel,
  formatItemUnitPrice,
} from '@/lib/items/utils'
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
  bomResult?: FetchBomResult
  /** URL ?category=3|4 등으로 초기 탭 */
  initialCategory?: ItemCategory | null
}

type ItemModalState =
  | { open: false }
  | { open: true; mode: 'create'; initialCategory: ItemCategory | null }
  | { open: true; mode: 'edit'; item: Item }
  | { open: true; mode: 'bulk'; initialCategory: ItemCategory | null }

type BomModalState =
  | { open: false }
  | { open: true; mode: 'create'; parentProductId: string }
  | { open: true; mode: 'edit'; group: BomGroup }

function resolveInitialCategory(value: ItemCategory | null | undefined): ItemCategory {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value
  return ITEM_CATEGORIES[0]
}

export function ItemsWorkspace({
  result,
  bomResult,
  initialCategory = null,
}: ItemsWorkspaceProps) {
  const { afterSave, afterDelete } = useSaveFeedback()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory>(() =>
    resolveInitialCategory(initialCategory),
  )
  const [modal, setModal] = useState<ItemModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)
  const [bomModal, setBomModal] = useState<BomModalState>({ open: false })
  const [bomModalSession, setBomModalSession] = useState(0)

  const items = result.ok ? result.items : []
  const bomLines = bomResult?.ok ? bomResult.lines : []
  const query = search.trim()
  const hasActiveFilter = Boolean(query)

  const bomGroups = useMemo(() => groupBomLines(bomLines), [bomLines])
  const bomRegisteredByItemId = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const group of bomGroups) {
      map.set(group.parentProductId, true)
    }
    return map
  }, [bomGroups])
  const bomGroupByParentId = useMemo(
    () => new Map(bomGroups.map((group) => [group.parentProductId, group])),
    [bomGroups],
  )
  const existingParentIds = useMemo(
    () => bomGroups.map((group) => group.parentProductId),
    [bomGroups],
  )

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

  function openBom(item: Item) {
    if (!isProductItemCategory(item.itemCategory)) return
    setBomModalSession((value) => value + 1)
    const group = bomGroupByParentId.get(item.id)
    if (group) {
      setBomModal({ open: true, mode: 'edit', group })
      return
    }
    setBomModal({ open: true, mode: 'create', parentProductId: item.id })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function closeBomModal() {
    setBomModal({ open: false })
  }

  function handleSaved(message?: string) {
    afterSave(message ?? '품목이 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '품목이 삭제되었습니다.', { close: closeModal })
  }

  function handleBomSaved(message?: string) {
    afterSave(message ?? 'BOM이 저장되었습니다.', { close: closeBomModal })
  }

  function handleBomDeleted(message?: string) {
    afterDelete(message ?? 'BOM이 삭제되었습니다.', { close: closeBomModal })
  }

  function handleBomVersioned(newGroup: BomGroup) {
    setBomModalSession((value) => value + 1)
    setBomModal({ open: true, mode: 'edit', group: newGroup })
    afterSave('BOM이 버전업되었습니다.')
  }

  async function handleExcelDownload() {
    const hideMaterialDetailColumns = isProductItemCategory(categoryFilter)
    const showProductionProcessColumn = categoryFilter === 4
    const showBomColumn = isProductItemCategory(categoryFilter)

    function moneyExcel(value: number) {
      const amount = Math.max(0, Math.round(Number(value) || 0))
      return amount > 0 ? formatItemUnitPrice(amount) : ''
    }

    const priceColumns = isProductItemCategory(categoryFilter)
      ? [
          {
            header: 'SMD',
            value: (row: Item) => moneyExcel(displayItemSmdUnitPrice(row)),
            width: 12,
          },
          {
            header: '후공정',
            value: (row: Item) => moneyExcel(displayItemDipUnitPrice(row)),
            width: 12,
          },
          {
            header: '자재비',
            value: (row: Item) => moneyExcel(displayItemMaterialUnitPrice(row)),
            width: 12,
          },
          ...(categoryFilter === 3
            ? [
                {
                  header: '면',
                  value: (row: Item) => formatItemPcbSideModeLabel(row.pcbSideMode),
                  width: 10,
                },
                {
                  header: 'Array',
                  value: (row: Item) =>
                    row.productionStd.arrayCount > 0 ? String(row.productionStd.arrayCount) : '',
                  width: 8,
                },
                {
                  header: '종수 TOP',
                  value: (row: Item) =>
                    excelProductionStdTopBot(row.pcbSideMode, row.productionStd).partCountTop,
                  width: 10,
                },
                {
                  header: '종수 BOT',
                  value: (row: Item) =>
                    excelProductionStdTopBot(row.pcbSideMode, row.productionStd).partCountBot,
                  width: 10,
                  cellStyle: (row: Item) =>
                    row.pcbSideMode !== 'double'
                      ? {
                          fill: { patternType: 'solid' as const, fgColor: { rgb: 'FFCDD2' } },
                        }
                      : undefined,
                },
                {
                  header: 'Tech Time TOP(초·패널)',
                  value: (row: Item) =>
                    excelProductionStdTopBot(row.pcbSideMode, row.productionStd).tactTimeTopSec,
                  width: 16,
                },
                {
                  header: 'Tech Time BOT(초·패널)',
                  value: (row: Item) =>
                    excelProductionStdTopBot(row.pcbSideMode, row.productionStd).tactTimeBotSec,
                  width: 16,
                  cellStyle: (row: Item) =>
                    row.pcbSideMode !== 'double'
                      ? {
                          fill: { patternType: 'solid' as const, fgColor: { rgb: 'FFCDD2' } },
                        }
                      : undefined,
                },
              ]
            : []),
        ]
      : []

    const processAndPriceColumns = showProductionProcessColumn
      ? [
          {
            header: '생산 공정',
            value: (row: Item) => formatItemProductionProcessLabel(row),
            width: 12,
          },
          ...priceColumns,
        ]
      : priceColumns

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
              ...processAndPriceColumns,
            ]),
        ...(showBomColumn
          ? [
              {
                header: 'BOM',
                value: (row: Item) =>
                  bomRegisteredByItemId.get(row.id) ? '등록완료' : '미등록',
                width: 10,
              },
            ]
          : []),
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
          bomRegisteredByItemId={
            isProductItemCategory(categoryFilter) ? bomRegisteredByItemId : undefined
          }
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '등록된 품목이 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectItem={openEdit}
          onSelectBom={openBom}
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

      {bomModal.open ? (
        <BomModal
          key={`${bomModal.mode}-${bomModal.mode === 'edit' ? bomModal.group.parentProductId : bomModal.parentProductId}-${bomModalSession}`}
          open
          mode={bomModal.mode}
          group={bomModal.mode === 'edit' ? bomModal.group : null}
          initialParentProductId={bomModal.mode === 'create' ? bomModal.parentProductId : undefined}
          items={items}
          existingParentIds={existingParentIds}
          onClose={closeBomModal}
          onSaved={handleBomSaved}
          onDeleted={handleBomDeleted}
          onVersioned={handleBomVersioned}
        />
      ) : null}
    </>
  )
}
