'use client'

import { useMemo, useState } from 'react'
import { SolderCreamLogFetchError } from '@/components/materials/solder-cream/solder-cream-log-fetch-error'
import { SolderCreamLogImportModal } from '@/components/materials/solder-cream/solder-cream-log-import-modal'
import { SolderCreamLotHistoryModal } from '@/components/materials/solder-cream/solder-cream-lot-history-modal'
import { SolderCreamStatusEditModal } from '@/components/materials/solder-cream/solder-cream-status-edit-modal'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { ErpButton } from '@/components/ui/erp-button'
import { PageShell } from '@/components/ui/page-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
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
  matchesSolderCreamFridgeSearch,
  SOLDER_CREAM_LOT_STATUS_LABELS,
  type SolderCreamStatusFilter,
} from '@/lib/materials/solder-cream/utils'
import {
  ERP_CODE_TEXT_CLASS,
  ERP_MODULE_ACCENT,
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_ROW_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TD_FIXED_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
  formatEmptyListMessage,
} from '@/lib/ui/tokens'
import type { ErpStatusTone } from '@/lib/ui/tokens'

type SolderCreamLogWorkspaceProps = {
  result: FetchSolderCreamLogPageResult
}

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
  const { afterSave, afterDelete } = useSaveFeedback()
  const [statusFilter, setStatusFilter] = useState<SolderCreamStatusFilter>('all')
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [historyStatusRow, setHistoryStatusRow] = useState<SolderCreamStatusRow | null>(null)
  const [scrapRow, setScrapRow] = useState<SolderCreamStatusRow | null>(null)

  const logs = result.ok ? result.logs : []
  const statusOverrides = result.ok ? result.statusOverrides : []
  const query = search.trim()

  const statusRows = useMemo(
    () => buildSolderCreamStatusRows(logs, statusOverrides),
    [logs, statusOverrides],
  )

  const historyByLot = useMemo(() => {
    const map = new Map<string, SolderCreamHistoryLotRow>()
    for (const row of buildSolderCreamHistoryLotRows(logs)) {
      map.set(row.lotNumber, row)
    }
    return map
  }, [logs])

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

  const activeHistoryRow = historyStatusRow
    ? historyByLot.get(historyStatusRow.barcode) ?? null
    : null

  if (!result.ok) {
    return (
      <PageShell>
        <SolderCreamLogFetchError result={result} />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <WorkspaceHeader
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="품목 바코드·상태 검색"
        accent={ERP_MODULE_ACCENT.solderCream}
        meta={<span>행을 클릭하면 해당 LOT 이력을 볼 수 있습니다.</span>}
        filters={
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
        }
        actions={<ErpButton onClick={() => setImportOpen(true)}>Log 가져오기</ErpButton>}
      />

      <div className={ERP_TABLE_WRAP_CLASS}>
        <div className={ERP_TABLE_SCROLL_CLASS}>
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
                filteredStatusRows.map((row, index) => (
                  <tr
                    key={row.barcode}
                    className={`${ERP_TABLE_ROW_CLASS} cursor-pointer`}
                    onClick={() => setHistoryStatusRow(row)}
                  >
                    <td
                      className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-center tabular-nums text-slate-500`}
                    >
                      {index + 1}
                    </td>
                    <td
                      className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} ${ERP_CODE_TEXT_CLASS} font-semibold`}
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
                ))
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
        </div>
      </div>

      <SolderCreamLogImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(message) => {
          setImportOpen(false)
          afterSave(message || '가져오기 완료')
        }}
      />

      <SolderCreamLotHistoryModal
        open={Boolean(historyStatusRow)}
        statusRow={historyStatusRow}
        historyRow={activeHistoryRow}
        onClose={() => setHistoryStatusRow(null)}
        onDeleted={(message) => {
          setHistoryStatusRow(null)
          afterDelete(message || '삭제했습니다.')
        }}
        onRequestScrap={() => {
          if (!historyStatusRow) return
          setScrapRow(historyStatusRow)
          setHistoryStatusRow(null)
        }}
      />

      <SolderCreamStatusEditModal
        open={Boolean(scrapRow)}
        row={scrapRow}
        onClose={() => setScrapRow(null)}
        onSaved={(message) => {
          setScrapRow(null)
          afterSave(message || '저장했습니다.')
        }}
      />
    </PageShell>
  )
}
