'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BomFetchError } from '@/components/bom/bom-fetch-error'
import { BomListTable } from '@/components/bom/bom-list-table'
import { BomModal } from '@/components/bom/bom-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchBomResult } from '@/lib/bom/repository'
import type { BomGroup, BomParentFilter } from '@/lib/bom/types'
import { filterBomGroups, groupBomLines } from '@/lib/bom/utils'
import type { FetchItemsResult } from '@/lib/items/repository'
import {
  ERP_FILTER_CHIP_ACTIVE_CLASS,
  ERP_FILTER_CHIP_IDLE_CLASS,
  formatEmptyListMessage,
} from '@/lib/ui/tokens'

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
        <WorkspaceHeader
          title="BOM등록"
          totalCount={groups.length}
          filteredCount={filtered.length}
          hasQuery={hasActiveFilter}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="부모/구성 품목코드, 품목명 검색…"
          accent="slate"
          filters={
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
                      active ? ERP_FILTER_CHIP_ACTIVE_CLASS : ERP_FILTER_CHIP_IDLE_CLASS,
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          }
          actions={<ErpButton onClick={openCreate}>BOM 등록</ErpButton>}
        />

        <BomListTable
          groups={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '등록된 BOM이 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
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
