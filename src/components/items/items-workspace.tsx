'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ItemBulkModal } from '@/components/items/item-bulk-modal'
import { ItemFetchError } from '@/components/items/item-fetch-error'
import { ItemListTable } from '@/components/items/item-list-table'
import { ItemModal } from '@/components/items/item-modal'
import { ItemNewMenu } from '@/components/items/item-new-menu'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchItemsResult } from '@/lib/items/repository'
import { filterItemsForSearch } from '@/lib/items/utils'
import {
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  type Item,
  type ItemCategory,
} from '@/lib/items/types'
import {
  ERP_FILTER_CHIP_ACTIVE_CLASS,
  ERP_FILTER_CHIP_IDLE_CLASS,
  formatEmptyListMessage,
} from '@/lib/ui/tokens'

type ItemsWorkspaceProps = {
  result: FetchItemsResult
}

type ItemCategoryFilter = 'all' | ItemCategory

const CATEGORY_FILTER_OPTIONS: { value: ItemCategoryFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  ...ITEM_CATEGORIES.map((category) => ({
    value: category as ItemCategoryFilter,
    label: ITEM_CATEGORY_LABELS[category],
  })),
]

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; initialCategory: ItemCategory | null }
  | { open: true; mode: 'edit'; item: Item }
  | { open: true; mode: 'bulk'; initialCategory: ItemCategory | null }

export function ItemsWorkspace({ result }: ItemsWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ItemCategoryFilter>('all')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const items = result.ok ? result.items : []
  const query = search.trim()
  const hasActiveFilter = Boolean(query) || categoryFilter !== 'all'
  const filterCategory = categoryFilter === 'all' ? null : categoryFilter

  const filtered = useMemo(() => {
    const searched = filterItemsForSearch(items, query)
    if (categoryFilter === 'all') return searched
    return searched.filter((item) => item.itemCategory === categoryFilter)
  }, [items, query, categoryFilter])

  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({
      open: true,
      mode: 'create',
      initialCategory: filterCategory,
    })
  }

  function openBulk() {
    setModalSession((value) => value + 1)
    setModal({
      open: true,
      mode: 'bulk',
      initialCategory: filterCategory,
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
      <div className="flex w-full flex-col gap-4">
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
            <div className="flex flex-wrap gap-2">
              {CATEGORY_FILTER_OPTIONS.map((option) => {
                const active = categoryFilter === option.value
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => setCategoryFilter(option.value)}
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
          actions={<ItemNewMenu onOpenCreate={openCreate} onOpenBulk={openBulk} />}
        />

        <ItemListTable
          items={filtered}
          categoryFilter={categoryFilter}
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '등록된 품목이 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectItem={openEdit}
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
