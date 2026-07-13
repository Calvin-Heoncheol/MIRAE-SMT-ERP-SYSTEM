'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BomFetchError } from '@/components/bom/bom-fetch-error'
import { BomListTable } from '@/components/bom/bom-list-table'
import { BomModal } from '@/components/bom/bom-modal'
import type { FetchBomResult } from '@/lib/bom/repository'
import type { BomGroup, BomParentFilter } from '@/lib/bom/types'
import { filterBomGroups, groupBomLines } from '@/lib/bom/utils'
import type { FetchItemsResult } from '@/lib/items/repository'
import type { Item } from '@/lib/items/types'

type BomWorkspaceProps = {
  bomResult: FetchBomResult
  itemsResult: FetchItemsResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; group: BomGroup }

const PARENT_FILTER_OPTIONS: { value: BomParentFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 3, label: '반제품' },
  { value: 4, label: '완제품' },
]

export function BomWorkspace({ bomResult, itemsResult }: BomWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [parentFilter, setParentFilter] = useState<BomParentFilter>('all')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const lines = bomResult.ok ? bomResult.lines : []
  const items = itemsResult.ok ? itemsResult.items : []
  const query = search.trim()
  const hasActiveFilter = Boolean(query) || parentFilter !== 'all'

  const groups = useMemo(() => groupBomLines(lines), [lines])
  const filtered = useMemo(
    () => filterBomGroups(groups, query, parentFilter),
    [groups, query, parentFilter],
  )
  const existingParentIds = useMemo(() => groups.map((group) => group.parentProductId), [groups])

  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(group: BomGroup) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', group })
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

  if (!bomResult.ok) {
    return <BomFetchError result={bomResult} />
  }

  if (!itemsResult.ok) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <p className="font-semibold">품목 목록을 불러오지 못했습니다</p>
        <p className="mt-1 whitespace-pre-wrap">{itemsResult.detail}</p>
        <p className="mt-3 text-xs text-amber-800">
          BOM 등록 전에 기초등록 → 품목등록이 필요합니다.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">BOM등록</h1>
            <p className="mt-1 text-sm text-slate-500">
              완제품(FG) → 반제품(SFG), 반제품(SFG) → 원자재·부자재 구성을 관리합니다.
            </p>
          </div>
          <p className="text-sm font-medium text-slate-600">
            총 <span className="tabular-nums text-slate-900">{filtered.length.toLocaleString('ko-KR')}</span>
            건
            {hasActiveFilter ? (
              <span className="text-slate-400"> / {groups.length.toLocaleString('ko-KR')}건</span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="부모/구성 품목코드, 품목명 검색…"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-slate-100 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2"
          />
          <div className="flex flex-wrap gap-2">
            {PARENT_FILTER_OPTIONS.map((option) => {
              const active = parentFilter === option.value
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => setParentFilter(option.value)}
                  className={[
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                    active
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          <div className="ml-auto shrink-0">
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
            >
              BOM 등록
            </button>
          </div>
        </div>

        <BomListTable
          groups={filtered}
          emptyMessage={hasActiveFilter ? '검색 결과가 없습니다' : '등록된 BOM이 없습니다'}
          onSelectGroup={openEdit}
        />
      </div>

      {modal.open ? (
        <BomModal
          key={`${modal.mode}-${modal.mode === 'edit' ? modal.group.parentProductId : 'create'}-${modalSession}`}
          open
          mode={modal.mode}
          group={modal.mode === 'edit' ? modal.group : null}
          items={items}
          existingParentIds={existingParentIds}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  )
}
