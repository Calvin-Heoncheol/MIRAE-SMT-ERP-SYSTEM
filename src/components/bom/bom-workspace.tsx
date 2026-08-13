'use client'

import { useMemo, useState } from 'react'
import { BomFetchError } from '@/components/bom/bom-fetch-error'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { BomListTable } from '@/components/bom/bom-list-table'
import { BomModal } from '@/components/bom/bom-modal'
import { FilterChipBar } from '@/components/ui/filter-chip'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchBomResult } from '@/lib/bom/repository'
import type { BomGroup, BomListRow, BomParentFilter } from '@/lib/bom/types'
import { buildBomListRows, filterBomListRows, groupBomLines } from '@/lib/bom/utils'
import type { FetchItemsResult } from '@/lib/items/repository'
import { ITEM_CATEGORY_FILTER_IDLE_CLASS, ITEM_CATEGORY_LABELS } from '@/lib/items/types'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type BomWorkspaceProps = {
  bomResult: FetchBomResult
  itemsResult: FetchItemsResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; parentProductId?: string }
  | { open: true; mode: 'edit'; group: BomGroup }

export function BomWorkspace({ bomResult, itemsResult }: BomWorkspaceProps) {
  const { afterSave, afterDelete } = useSaveFeedback()
  const [search, setSearch] = useState('')
  const [parentFilter, setParentFilter] = useState<BomParentFilter>('all')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const lines = bomResult.ok ? bomResult.lines : []
  const items = itemsResult.ok ? itemsResult.items : []
  const query = search.trim()
  const hasActiveFilter = Boolean(query) || parentFilter !== 'all'

  const bomGroups = useMemo(() => groupBomLines(lines), [lines])
  const listRows = useMemo(() => buildBomListRows(items, bomGroups), [items, bomGroups])
  const filtered = useMemo(
    () => filterBomListRows(listRows, query, parentFilter),
    [listRows, query, parentFilter],
  )
  const parentCounts = useMemo(() => {
    const base = filterBomListRows(listRows, query, 'all')
    return {
      all: base.length,
      3: base.filter((row) => row.parentItemCategory === 3).length,
      4: base.filter((row) => row.parentItemCategory === 4).length,
    }
  }, [listRows, query])
  const parentFilterOptions = useMemo(
    () => [
      { value: 'all' as const, label: '전체', count: parentCounts.all },
      {
        value: 3 as BomParentFilter,
        label: ITEM_CATEGORY_LABELS[3],
        count: parentCounts[3],
        tone: { idleClassName: ITEM_CATEGORY_FILTER_IDLE_CLASS[3] },
      },
      {
        value: 4 as BomParentFilter,
        label: ITEM_CATEGORY_LABELS[4],
        count: parentCounts[4],
        tone: { idleClassName: ITEM_CATEGORY_FILTER_IDLE_CLASS[4] },
      },
    ],
    [parentCounts],
  )
  const existingParentIds = useMemo(
    () => bomGroups.map((group) => group.parentProductId),
    [bomGroups],
  )

  function openCreate(parentProductId?: string) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create', parentProductId })
  }

  function openEdit(group: BomGroup) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', group })
  }

  function openRow(row: BomListRow) {
    if (row.bomRegistered) {
      openEdit(row)
      return
    }
    openCreate(row.parentProductId)
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleSaved(message?: string) {
    afterSave(message ?? 'BOM이 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? 'BOM이 삭제되었습니다.', { close: closeModal })
  }

  function handleVersioned(newGroup: BomGroup) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', group: newGroup })
    afterSave('BOM이 버전업되었습니다.')
  }

  if (!bomResult.ok) {
    return <BomFetchError result={bomResult} />
  }

  if (!itemsResult.ok) {
    return (
      <FetchErrorBanner
        title="품목 목록을 불러오지 못했습니다"
        detail={itemsResult.detail}
        hint="BOM 등록 전에 기초등록 → 품목등록이 필요합니다."
      />
    )
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="품목코드, 품목명, 버전, 미등록/등록완료 검색…"
          accent="slate"
          filters={
            <FilterChipBar
              options={parentFilterOptions}
              value={parentFilter}
              onChange={setParentFilter}
            />
          }
        />

        <BomListTable
          rows={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: hasActiveFilter,
            emptyLabel: '표시할 반제품·조립제품이 없습니다',
            actionHint: '미등록 행을 클릭해 BOM을 등록하세요',
          })}
          onSelectRow={openRow}
        />
      </PageShell>

      {modal.open ? (
        <BomModal
          key={`${modal.mode}-${modal.mode === 'edit' ? modal.group.parentProductId : modal.parentProductId || 'create'}-${modalSession}`}
          open
          mode={modal.mode}
          group={modal.mode === 'edit' ? modal.group : null}
          initialParentProductId={modal.mode === 'create' ? modal.parentProductId : undefined}
          items={items}
          existingParentIds={existingParentIds}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onVersioned={handleVersioned}
        />
      ) : null}
    </>
  )
}
