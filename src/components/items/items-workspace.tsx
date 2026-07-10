'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ItemFetchError } from '@/components/items/item-fetch-error'
import { ItemListTable } from '@/components/items/item-list-table'
import { ItemModal } from '@/components/items/item-modal'
import type { FetchItemsResult } from '@/lib/items/repository'
import { filterItemsForSearch } from '@/lib/items/utils'
import type { Item } from '@/lib/items/types'

type ItemsWorkspaceProps = {
  result: FetchItemsResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; item: Item }

export function ItemsWorkspace({ result }: ItemsWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const items = result.ok ? result.items : []
  const query = search.trim()

  const filtered = useMemo(() => filterItemsForSearch(items, query), [items, query])

  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create' })
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">품목등록</h1>
            <p className="mt-1 text-sm text-slate-500">
              품목구분 1=원자재(코드 직접입력), 2=부자재(SUB-), 3=반제품(SFG-), 4=완제품(FG-) · 필수: 품목명, 품목구분
            </p>
          </div>
          <p className="text-sm font-medium text-slate-600">
            총 <span className="tabular-nums text-slate-900">{filtered.length.toLocaleString('ko-KR')}</span>건
            {query ? (
              <span className="text-slate-400"> / {items.length.toLocaleString('ko-KR')}건</span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="품목코드, 품목명, 규격, MPN 검색…"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-slate-100 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2"
          />
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
          >
            품목 등록
          </button>
        </div>

        <ItemListTable
          items={filtered}
          emptyMessage={query ? '검색 결과가 없습니다' : '등록된 품목이 없습니다'}
          onSelectItem={openEdit}
        />
      </div>

      {modal.open ? (
        <ItemModal
          key={`${modal.mode}-${modal.mode === 'edit' ? modal.item.id : 'create'}-${modalSession}`}
          open
          mode={modal.mode}
          item={modal.mode === 'edit' ? modal.item : null}
          existingItems={items}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  )
}
