'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ItemBulkModal } from '@/components/items/item-bulk-modal'
import { ItemFetchError } from '@/components/items/item-fetch-error'
import { ItemListTable } from '@/components/items/item-list-table'
import { ItemModal } from '@/components/items/item-modal'
import { ItemNewMenu } from '@/components/items/item-new-menu'
import { FilterChipBar } from '@/components/ui/filter-chip'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchItemsResult } from '@/lib/items/repository'
import { filterItemsForSearch } from '@/lib/items/utils'
import {
  ITEM_CATEGORIES,
  ITEM_CATEGORY_FILTER_IDLE_CLASS,
  ITEM_CATEGORY_LABELS,
  type Item,
  type ItemCategory,
} from '@/lib/items/types'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type ItemsWorkspaceProps = {
  result: FetchItemsResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; initialCategory: ItemCategory }
  | { open: true; mode: 'edit'; item: Item }
  | { open: true; mode: 'bulk'; initialCategory: ItemCategory }

export function ItemsWorkspace({ result }: ItemsWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ItemCategory>(1)
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
        tone: { idleClassName: ITEM_CATEGORY_FILTER_IDLE_CLASS[category] },
      })),
    [categoryCounts],
  )

  const pagination = useClientPagination(filtered)

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

  function handleSaved() {
    closeModal()
    router.refresh()
  }

  function handleDeleted() {
    closeModal()
    router.refresh()
  }

  if (!result.ok) {
    return <ItemFetchError result={result} />
  }

  return (
    <>
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
        <WorkspaceHeader
          title="품목등록"
          totalCount={items.length}
          filteredCount={filtered.length}
          hasQuery={hasActiveFilter}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="품목코드, 품목명, 규격, MPN 검색…"
          accent="slate"
          filters={
            <FilterChipBar
              options={categoryFilterOptions}
              value={categoryFilter}
              onChange={setCategoryFilter}
            />
          }
          actions={<ItemNewMenu onOpenCreate={openCreate} onOpenBulk={openBulk} />}
        />

        <ItemListTable
          items={pagination.pageItems}
          categoryFilter={categoryFilter}
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '등록된 품목이 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectItem={openEdit}
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
