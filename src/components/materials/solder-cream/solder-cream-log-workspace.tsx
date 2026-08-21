'use client'

import { useMemo, useState } from 'react'
import { SolderCreamLogFetchError } from '@/components/materials/solder-cream/solder-cream-log-fetch-error'
import { SolderCreamLogImportModal } from '@/components/materials/solder-cream/solder-cream-log-import-modal'
import { SolderCreamStatusEditModal } from '@/components/materials/solder-cream/solder-cream-status-edit-modal'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { ErpButton } from '@/components/ui/erp-button'
import { PageShell } from '@/components/ui/page-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { deleteSolderCreamEquipmentLogs } from '@/lib/materials/solder-cream/repository'
import type { FetchSolderCreamLogPageResult } from '@/lib/materials/solder-cream/repository'
import type {
  SolderCreamHistoryLotRow,
  SolderCreamLotStatus,
  SolderCreamStatusRow,
} from '@/lib/materials/solder-cream/types'
import {
  buildSolderCreamHistoryLotRows,
  buildSolderCreamStatusRows,
  formatSolderCreamDate,
  formatSolderCreamDateTime,
  matchesSolderCreamFridgeSearch,
  matchesSolderCreamHistoryLotSearch,
  SOLDER_CREAM_LOT_STATUS_LABELS,
  type SolderCreamStatusFilter,
} from '@/lib/materials/solder-cream/utils'
import {
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_ROW_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TD_FIXED_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
  erpSearchFocusClass,
  formatEmptyListMessage,
} from '@/lib/ui/tokens'
import type { ErpStatusTone } from '@/lib/ui/tokens'

type SolderCreamLogWorkspaceProps = {
  result: FetchSolderCreamLogPageResult
}

type ViewMode = 'status' | 'history'

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'status', label: '솔더크림 현황' },
  { value: 'history', label: '이력' },
]

function lotStatusTone(status: SolderCreamLotStatus): ErpStatusTone {
  switch (status) {
    case 'cold':
      return 'info'
    case 'discarded':
      return 'neutral'
    case 'scrapped':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function SolderCreamLogWorkspace({ result }: SolderCreamLogWorkspaceProps) {
  const { afterSave, afterDelete, toast } = useSaveFeedback()
  const [view, setView] = useState<ViewMode>('status')
  const [statusFilter, setStatusFilter] = useState<SolderCreamStatusFilter>('all')
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [editRow, setEditRow] = useState<SolderCreamStatusRow | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const logs = result.ok ? result.logs : []
  const statusOverrides = result.ok ? result.statusOverrides : []
  const query = search.trim()

  const statusRows = useMemo(
    () => buildSolderCreamStatusRows(logs, statusOverrides),
    [logs, statusOverrides],
  )

  const statusCounts = useMemo(() => {
    const counts: Record<SolderCreamStatusFilter, number> = {
      all: statusRows.length,
      cold: 0,
      discarded: 0,
      scrapped: 0,
    }
    for (const row of statusRows) {
      if (row.status === 'cold' || row.status === 'discarded' || row.status === 'scrapped') {
        counts[row.status] += 1
      }
    }
    return counts
  }, [statusRows])

  const filteredStatusRows = useMemo(() => {
    const byStatus =
      statusFilter === 'all' ? statusRows : statusRows.filter((row) => row.status === statusFilter)
    if (!query) return byStatus
    return byStatus.filter((row) => matchesSolderCreamFridgeSearch(row, query))
  }, [statusRows, statusFilter, query])

  const historyRows = useMemo(() => buildSolderCreamHistoryLotRows(logs), [logs])

  const filteredHistoryRows = useMemo(
    () => historyRows.filter((row) => matchesSolderCreamHistoryLotSearch(row, query)),
    [historyRows, query],
  )

  const selectedCount = useMemo(
    () =>
      filteredHistoryRows.reduce(
        (count, row) => (selectedIds.has(row.lotNumber) ? count + 1 : count),
        0,
      ),
    [filteredHistoryRows, selectedIds],
  )
  const allFilteredSelected =
    filteredHistoryRows.length > 0 &&
    filteredHistoryRows.every((row) => selectedIds.has(row.lotNumber))

  function setViewMode(next: ViewMode) {
    setView(next)
    setSelectedIds(new Set())
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const row of filteredHistoryRows) next.delete(row.lotNumber)
        return next
      })
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const row of filteredHistoryRows) next.add(row.lotNumber)
      return next
    })
  }

  function toggleSelectOne(lotNumber: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(lotNumber)) next.delete(lotNumber)
      else next.add(lotNumber)
      return next
    })
  }

  async function handleDeleteSelected() {
    if (deleting || selectedCount === 0) return
    const selectedLots = filteredHistoryRows.filter((row) => selectedIds.has(row.lotNumber))
    const ids = selectedLots.flatMap((row) => row.logIds)
    if (
      !window.confirm(
        `선택한 LOT ${selectedLots.length}건의 이력을 삭제할까요?\n현황도 함께 다시 계산됩니다.`,
      )
    ) {
      return
    }

    setDeleting(true)
    const deleteResult = await deleteSolderCreamEquipmentLogs(ids)
    setDeleting(false)

    if (!deleteResult.ok) {
      toast.error(deleteResult.detail)
      return
    }

    setSelectedIds(new Set())
    afterDelete(`LOT ${selectedLots.length}건 이력을 삭제했습니다.`)
  }

  function formatRoundTime(value: string | null) {
    return value ? formatSolderCreamDateTime(value) : '—'
  }

  function renderRoundCells(
    times: SolderCreamHistoryLotRow['storeAt'],
    tone: 'store' | 'discard',
  ) {
    const cellTone =
      tone === 'store'
        ? 'bg-sky-50/80 text-sky-900'
        : 'bg-amber-50/80 text-amber-950'
    const edge =
      tone === 'store'
        ? 'border-l border-sky-200'
        : 'border-l border-amber-200'
    return times.map((value, index) => (
      <td
        key={`${tone}-${index}`}
        className={[
          ERP_TABLE_TD_CLASS,
          ERP_TABLE_TD_FIXED_CLASS,
          'whitespace-nowrap text-xs',
          cellTone,
          index === 0 ? edge : '',
        ].join(' ')}
      >
        {formatRoundTime(value)}
      </td>
    ))
  }

  return (
    <PageShell>
      {result.ok ? (
        <>
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">솔더크림</h1>
            </div>
            <div className="flex items-center gap-2">
              {view === 'history' ? (
                <ErpButton
                  variant="danger"
                  disabled={selectedCount === 0}
                  loading={deleting}
                  onClick={() => void handleDeleteSelected()}
                >
                  {deleting
                    ? '삭제 중…'
                    : selectedCount > 0
                      ? `삭제 (${selectedCount})`
                      : '삭제'}
                </ErpButton>
              ) : null}
              <ErpButton onClick={() => setImportOpen(true)}>Log 가져오기</ErpButton>
            </div>
          </div>
        </>
      ) : null}

      {!result.ok ? <SolderCreamLogFetchError result={result} /> : null}

      {result.ok ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
              {VIEW_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setViewMode(option.value)}
                  className={[
                    'rounded-md px-3 py-1.5 text-xs font-semibold transition',
                    view === option.value
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={view === 'status' ? '품목 바코드·상태 검색' : 'LOT 검색'}
              className={`w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 ${erpSearchFocusClass('sky')}`}
            />
          </div>

          {view === 'status' ? (
            <FilterChipBar
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: '전체', count: statusCounts.all },
                {
                  value: 'cold',
                  label: SOLDER_CREAM_LOT_STATUS_LABELS.cold,
                  count: statusCounts.cold,
                  tone: STATUS_FILTER_TONES.waiting,
                },
                {
                  value: 'discarded',
                  label: SOLDER_CREAM_LOT_STATUS_LABELS.discarded,
                  count: statusCounts.discarded,
                  tone: STATUS_FILTER_TONES.progress,
                },
                {
                  value: 'scrapped',
                  label: SOLDER_CREAM_LOT_STATUS_LABELS.scrapped,
                  count: statusCounts.scrapped,
                  tone: STATUS_FILTER_TONES.waiting,
                },
              ]}
            />
          ) : null}

          <div className={ERP_TABLE_WRAP_CLASS}>
            <div className={ERP_TABLE_SCROLL_CLASS}>
              {view === 'status' ? (
                <table className={ERP_TABLE_CLASS}>
                  <thead className={ERP_TABLE_HEAD_CLASS}>
                    <tr>
                      <th className={`${ERP_TABLE_TH_CLASS} text-center`}>No.</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>품목 바코드</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>제조일자</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>유통기한</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-center`}>입고횟수</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStatusRows.length ? (
                      filteredStatusRows.map((row, index) => {
                        const canScrap = row.status === 'discarded'
                        return (
                        <tr
                          key={row.barcode}
                          className={[
                            ERP_TABLE_ROW_CLASS,
                            canScrap ? 'cursor-pointer hover:bg-slate-50' : '',
                          ].join(' ')}
                          onClick={canScrap ? () => setEditRow(row) : undefined}
                        >
                          <td
                            className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-center tabular-nums text-slate-500`}
                          >
                            {index + 1}
                          </td>
                          <td
                            className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-mono text-xs font-semibold text-blue-800`}
                          >
                            {row.barcode}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-slate-600`}>
                            {formatSolderCreamDate(row.manufacturedAt)}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-slate-600`}>
                            {formatSolderCreamDate(row.expiresAt)}
                          </td>
                          <td
                            className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-center tabular-nums text-slate-600`}
                          >
                            {row.inboundCount}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
                            <StatusBadge
                              label={SOLDER_CREAM_LOT_STATUS_LABELS[row.status]}
                              tone={lotStatusTone(row.status)}
                            />
                          </td>
                        </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                          {formatEmptyListMessage({
                            hasQuery: Boolean(query) || statusFilter !== 'all',
                            emptyLabel: '표시할 솔더크림이 없습니다.',
                            actionHint: '일 종료 후 로그 파일을 가져와 주세요.',
                          })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : null}

              {view === 'history' ? (
                <table className={`${ERP_TABLE_CLASS} table-fixed`}>
                  <colgroup>
                    <col className="w-10" />
                    <col className="w-[18%]" />
                    <col className="w-[13%]" />
                    <col className="w-[13%]" />
                    <col className="w-[13%]" />
                    <col className="w-[13%]" />
                    <col className="w-[13%]" />
                    <col className="w-[13%]" />
                  </colgroup>
                  <thead className={ERP_TABLE_HEAD_CLASS}>
                    <tr>
                      <th className={`${ERP_TABLE_TH_CLASS} text-center`} rowSpan={2}>
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          disabled={!filteredHistoryRows.length || deleting}
                          onChange={toggleSelectAll}
                          aria-label="전체 선택"
                          className="size-4 accent-slate-700"
                        />
                      </th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`} rowSpan={2}>
                        LOT
                      </th>
                      <th
                        className={`${ERP_TABLE_TH_CLASS} border-l border-sky-200 bg-sky-50 text-center text-sky-800`}
                        colSpan={3}
                      >
                        입고
                      </th>
                      <th
                        className={`${ERP_TABLE_TH_CLASS} border-l border-amber-200 bg-amber-50 text-center text-amber-900`}
                        colSpan={3}
                      >
                        출고
                      </th>
                    </tr>
                    <tr>
                      <th
                        className={`${ERP_TABLE_TH_CLASS} border-l border-sky-200 bg-sky-50/80 text-left text-sky-700`}
                      >
                        1차
                      </th>
                      <th className={`${ERP_TABLE_TH_CLASS} bg-sky-50/80 text-left text-sky-700`}>
                        2차
                      </th>
                      <th className={`${ERP_TABLE_TH_CLASS} bg-sky-50/80 text-left text-sky-700`}>
                        3차
                      </th>
                      <th
                        className={`${ERP_TABLE_TH_CLASS} border-l border-amber-200 bg-amber-50/80 text-left text-amber-800`}
                      >
                        1차
                      </th>
                      <th className={`${ERP_TABLE_TH_CLASS} bg-amber-50/80 text-left text-amber-800`}>
                        2차
                      </th>
                      <th className={`${ERP_TABLE_TH_CLASS} bg-amber-50/80 text-left text-amber-800`}>
                        3차
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistoryRows.length ? (
                      filteredHistoryRows.map((row) => {
                        const selected = selectedIds.has(row.lotNumber)
                        return (
                          <tr key={row.lotNumber} className={ERP_TABLE_ROW_CLASS}>
                            <td
                              className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-center`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                disabled={deleting}
                                onChange={() => toggleSelectOne(row.lotNumber)}
                                aria-label={`${row.lotNumber} 이력 선택`}
                                className="size-4 accent-slate-700"
                              />
                            </td>
                            <td
                              className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-mono text-xs font-semibold text-blue-800`}
                            >
                              {row.lotNumber}
                            </td>
                            {renderRoundCells(row.storeAt, 'store')}
                            {renderRoundCells(row.discardAt, 'discard')}
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                          {formatEmptyListMessage({
                            hasQuery: Boolean(query),
                            emptyLabel: '가져온 설비 로그가 없습니다.',
                            actionHint: '일 종료 후 로그 파일을 가져와 주세요.',
                          })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <SolderCreamLogImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(message) => {
          setImportOpen(false)
          afterSave(message || '가져오기 완료')
        }}
      />

      <SolderCreamStatusEditModal
        open={Boolean(editRow)}
        row={editRow}
        onClose={() => setEditRow(null)}
        onSaved={(message) => {
          setEditRow(null)
          afterSave(message || '저장했습니다.')
        }}
      />
    </PageShell>
  )
}
