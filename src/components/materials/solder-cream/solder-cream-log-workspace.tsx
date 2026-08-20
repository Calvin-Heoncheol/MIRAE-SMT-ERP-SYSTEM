'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SolderCreamLogFetchError } from '@/components/materials/solder-cream/solder-cream-log-fetch-error'
import { SolderCreamLogImportModal } from '@/components/materials/solder-cream/solder-cream-log-import-modal'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { ErpButton } from '@/components/ui/erp-button'
import { PageShell } from '@/components/ui/page-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import type { FetchSolderCreamLogPageResult } from '@/lib/materials/solder-cream/repository'
import type { SolderCreamLotStatus } from '@/lib/materials/solder-cream/types'
import {
  buildSolderCreamStatusRows,
  formatSolderCreamDate,
  formatSolderCreamDateTime,
  matchesSolderCreamFridgeSearch,
  matchesSolderCreamSearch,
  SOLDER_CREAM_EQUIPMENT_LABELS,
  SOLDER_CREAM_EVENT_LABELS,
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

type ViewMode = 'status' | 'history' | 'sync'

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'status', label: '솔더페이스트 현황' },
  { value: 'history', label: '이력' },
  { value: 'sync', label: '로그' },
]

function lotStatusTone(status: SolderCreamLotStatus): ErpStatusTone {
  switch (status) {
    case 'ready':
      return 'success'
    case 'mixed':
      return 'info'
    case 'opened':
      return 'warning'
    case 'discarded':
      return 'neutral'
    case 'cold':
      return 'info'
    default:
      return 'neutral'
  }
}

export function SolderCreamLogWorkspace({ result }: SolderCreamLogWorkspaceProps) {
  const router = useRouter()
  const { afterSave } = useSaveFeedback()
  const [view, setView] = useState<ViewMode>('status')
  const [statusFilter, setStatusFilter] = useState<SolderCreamStatusFilter>('all')
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const logs = result.ok ? result.logs : []
  const imports = result.ok ? result.imports : []
  const query = search.trim()

  const statusRows = useMemo(() => buildSolderCreamStatusRows(logs), [logs])

  const statusCounts = useMemo(() => {
    const counts: Record<SolderCreamStatusFilter, number> = {
      all: statusRows.length,
      cold: 0,
      opened: 0,
      mixed: 0,
      ready: 0,
    }
    for (const row of statusRows) {
      if (row.status in counts) counts[row.status as SolderCreamStatusFilter] += 1
    }
    return counts
  }, [statusRows])

  const filteredStatusRows = useMemo(() => {
    const byStatus =
      statusFilter === 'all' ? statusRows : statusRows.filter((row) => row.status === statusFilter)
    if (!query) return byStatus
    return byStatus.filter((row) => matchesSolderCreamFridgeSearch(row, query))
  }, [statusRows, statusFilter, query])

  const filteredLogs = useMemo(
    () => logs.filter((row) => matchesSolderCreamSearch(row, query)),
    [logs, query],
  )

  return (
    <PageShell>
      {result.ok ? (
        <>
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-900">솔더페이스트</h1>
              <p className="mt-1 text-sm text-slate-600">
                설비 PC가 D:\Log\년\월\일.txt 로그를 자동 전송합니다. 수동 가져오기도 가능합니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ErpButton variant="secondary" onClick={() => router.refresh()}>
                새로고침
              </ErpButton>
              <ErpButton onClick={() => setImportOpen(true)}>가져오기</ErpButton>
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
                  onClick={() => setView(option.value)}
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

            {view !== 'sync' ? (
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={view === 'status' ? '품목 바코드·상태 검색' : 'LOT·설비·이벤트 검색'}
                className={`w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 ${erpSearchFocusClass('sky')}`}
              />
            ) : null}
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
                  value: 'opened',
                  label: SOLDER_CREAM_LOT_STATUS_LABELS.opened,
                  count: statusCounts.opened,
                  tone: STATUS_FILTER_TONES.progress,
                },
                {
                  value: 'mixed',
                  label: SOLDER_CREAM_LOT_STATUS_LABELS.mixed,
                  count: statusCounts.mixed,
                  tone: STATUS_FILTER_TONES.progress,
                },
                {
                  value: 'ready',
                  label: SOLDER_CREAM_LOT_STATUS_LABELS.ready,
                  count: statusCounts.ready,
                  tone: STATUS_FILTER_TONES.done,
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
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>입고시간</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-center`}>입고횟수</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStatusRows.length ? (
                      filteredStatusRows.map((row, index) => (
                        <tr key={row.barcode} className={ERP_TABLE_ROW_CLASS}>
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
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-slate-700`}>
                            {formatSolderCreamDate(row.manufacturedAt)}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-slate-700`}>
                            {formatSolderCreamDate(row.expiresAt)}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-slate-600`}>
                            {row.lastInboundAt ? formatSolderCreamDateTime(row.lastInboundAt) : '—'}
                          </td>
                          <td
                            className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-center tabular-nums text-slate-600`}
                          >
                            {row.inboundCount}
                          </td>
                          <td className={ERP_TABLE_TD_CLASS}>
                            <StatusBadge
                              label={SOLDER_CREAM_LOT_STATUS_LABELS[row.status]}
                              tone={lotStatusTone(row.status)}
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                          {formatEmptyListMessage({
                            hasQuery: Boolean(query) || statusFilter !== 'all',
                            emptyLabel: '표시할 솔더페이스트가 없습니다.',
                            actionHint: '설비 로그 동기화 후 다시 확인하세요.',
                          })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : null}

              {view === 'history' ? (
                <table className={ERP_TABLE_CLASS}>
                  <thead className={ERP_TABLE_HEAD_CLASS}>
                    <tr>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>기록시각</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>설비</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>LOT</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>이벤트</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-right`}>온도</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-right`}>교반초</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>결과</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length ? (
                      filteredLogs.map((row) => (
                        <tr key={row.id} className={ERP_TABLE_ROW_CLASS}>
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-slate-600`}>
                            {formatSolderCreamDateTime(row.recordedAt)}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
                            {SOLDER_CREAM_EQUIPMENT_LABELS[row.equipmentType]}
                            {row.equipmentId ? ` · ${row.equipmentId}` : ''}
                          </td>
                          <td
                            className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-mono text-xs font-semibold text-blue-800`}
                          >
                            {row.lotNumber}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
                            {SOLDER_CREAM_EVENT_LABELS[row.eventType]}
                          </td>
                          <td
                            className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right tabular-nums text-slate-600`}
                          >
                            {row.temperature ?? '—'}
                          </td>
                          <td
                            className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right tabular-nums text-slate-600`}
                          >
                            {row.mixSeconds ?? '—'}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
                            {row.result || '—'}
                          </td>
                          <td className={ERP_TABLE_TD_CLASS}>{row.note || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-500">
                          {formatEmptyListMessage({
                            hasQuery: Boolean(query),
                            emptyLabel: '가져온 설비 로그가 없습니다.',
                            actionHint: '가져오기 또는 설비 PC 에이전트로 로그를 전송하세요.',
                          })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : null}

              {view === 'sync' ? (
                <table className={ERP_TABLE_CLASS}>
                  <thead className={ERP_TABLE_HEAD_CLASS}>
                    <tr>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>가져온 시각</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>파일명</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-right`}>행 수</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imports.length ? (
                      imports.map((row) => (
                        <tr key={row.id} className={ERP_TABLE_ROW_CLASS}>
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-slate-600`}>
                            {formatSolderCreamDateTime(row.importedAt)}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-mono text-xs text-slate-700`}>
                            {row.sourceName || '—'}
                          </td>
                          <td
                            className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right tabular-nums text-slate-600`}
                          >
                            {row.rowCount}
                          </td>
                          <td className={ERP_TABLE_TD_CLASS}>{row.note || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                          {formatEmptyListMessage({
                            hasQuery: false,
                            emptyLabel: '가져온 파일 로그가 없습니다.',
                            actionHint: '설비 PC에서 전송 후 다시 확인하세요.',
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
    </PageShell>
  )
}
