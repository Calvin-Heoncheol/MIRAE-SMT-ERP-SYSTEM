'use client'

import { useMemo, useState } from 'react'
import { DefectHandlingModal } from '@/components/quality/defect-handling-modal'
import { DefectHandlingTable } from '@/components/quality/defect-handling-table'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import type { FetchDefectHandlingsResult } from '@/lib/quality/defects/repository'
import type { DefectHandlingListItem, DefectStatusFilter } from '@/lib/quality/defects/types'
import { filterDefectHandlings } from '@/lib/quality/defects/utils'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type DefectHandlingWorkspaceProps = {
  result: FetchDefectHandlingsResult
}

type ModalState = { open: false } | { open: true; row: DefectHandlingListItem }

export function DefectHandlingWorkspace({ result }: DefectHandlingWorkspaceProps) {
  const { afterSave } = useSaveFeedback()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DefectStatusFilter>('pending')
  const [modal, setModal] = useState<ModalState>({ open: false })

  const rows = result.ok ? result.rows : []
  const filtered = useMemo(
    () => filterDefectHandlings(rows, search, statusFilter),
    [rows, search, statusFilter],
  )
  const hasActiveFilter = Boolean(search.trim()) || statusFilter !== 'pending'

  const statusOptions = useMemo(() => {
    const searched = filterDefectHandlings(rows, search, 'all')
    return [
      {
        value: 'pending' as const,
        label: '미대처',
        count: searched.filter((row) => row.status === 'pending').length,
        tone: STATUS_FILTER_TONES.progress,
      },
      {
        value: 'hold' as const,
        label: '보류',
        count: searched.filter((row) => row.status === 'hold').length,
        tone: STATUS_FILTER_TONES.waiting,
      },
      {
        value: 'completed' as const,
        label: '완료',
        count: searched.filter((row) => row.status === 'completed').length,
        tone: STATUS_FILTER_TONES.done,
      },
      {
        value: 'all' as const,
        label: '전체',
        count: searched.length,
      },
    ]
  }, [rows, search])

  function openRow(row: DefectHandlingListItem) {
    setModal({ open: true, row })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleSaved() {
    afterSave('불량 대처가 저장되었습니다.', { close: closeModal })
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="발주ID, 고객사, 제품, 불량사유, 대처 검색…"
          accent="slate"
          filters={
            <FilterChipBar
              options={statusOptions}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          }
        />

        {!result.ok ? (
          <FetchErrorBanner title="불량대처 목록을 불러오지 못했습니다" detail={result.detail} />
        ) : (
          <>
            <DefectHandlingTable
              rows={filtered}
              emptyMessage={formatEmptyListMessage({
                hasQuery: hasActiveFilter,
                emptyLabel: '등록된 불량이 없습니다',
                actionHint: '생산등록에서 불량을 입력하면 여기에 나타납니다.',
              })}
              onRowClick={openRow}
            />
          </>
        )}
      </PageShell>

      <DefectHandlingModal
        open={modal.open}
        row={modal.open ? modal.row : null}
        onClose={closeModal}
        onSaved={handleSaved}
      />
    </>
  )
}
