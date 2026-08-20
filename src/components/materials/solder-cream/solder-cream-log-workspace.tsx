'use client'

import { useMemo, useState } from 'react'
import { SolderCreamLogFetchError } from '@/components/materials/solder-cream/solder-cream-log-fetch-error'
import { SolderCreamLogImportModal } from '@/components/materials/solder-cream/solder-cream-log-import-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { PageShell } from '@/components/ui/page-shell'
import { StatusBadge } from '@/components/ui/status-badge'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import type { FetchSolderCreamLogPageResult } from '@/lib/materials/solder-cream/repository'
import type { SolderCreamLotStatus } from '@/lib/materials/solder-cream/types'
import {
  buildSolderCreamLotSummaries,
  formatSolderCreamDateTime,
  matchesSolderCreamSearch,
  SOLDER_CREAM_EQUIPMENT_LABELS,
  SOLDER_CREAM_EVENT_LABELS,
  SOLDER_CREAM_LOT_STATUS_LABELS,
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

type ViewMode = 'lots' | 'logs' | 'imports'

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'lots', label: 'LOT 현황' },
  { value: 'logs', label: '로그 전체' },
  { value: 'imports', label: '가져오기 이력' },
]

function lotStatusTone(status: SolderCreamLotStatus): ErpStatusTone {
  switch (status) {
    case 'ready':
      return 'success'
    case 'alarm':
      return 'danger'
    case 'mixed':
      return 'info'
    case 'opened':
      return 'warning'
    case 'cold':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function SolderCreamLogWorkspace({ result }: SolderCreamLogWorkspaceProps) {
  const { afterSave } = useSaveFeedback()
  const [view, setView] = useState<ViewMode>('lots')
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const logs = result.ok ? result.logs : []
  const imports = result.ok ? result.imports : []
  const query = search.trim()

  const lotSummaries = useMemo(() => buildSolderCreamLotSummaries(logs), [logs])

  const filteredLots = useMemo(() => {
    if (!query) return lotSummaries
    const q = query.toLowerCase()
    return lotSummaries.filter(
      (row) =>
        row.lotNumber.toLowerCase().includes(q) ||
        SOLDER_CREAM_LOT_STATUS_LABELS[row.status].toLowerCase().includes(q),
    )
  }, [lotSummaries, query])

  const filteredLogs = useMemo(
    () => logs.filter((row) => matchesSolderCreamSearch(row, query)),
    [logs, query],
  )

  const readyCount = lotSummaries.filter((row) => row.status === 'ready').length
  const alarmCount = lotSummaries.filter((row) => row.status === 'alarm').length

  return (
    <PageShell>
      {result.ok ? (
        <WorkspaceHeader
          title="솔더페이스트"
          description="설비 PC가 D:\\Log\\년\\월\\일.txt 로그를 자동 전송합니다. 수동 가져오기도 가능합니다."
          actions={
            <ErpButton onClick={() => setImportOpen(true)}>가져오기</ErpButton>
          }
        />
      ) : null}

      {!result.ok ? <SolderCreamLogFetchError result={result} /> : null}

      {result.ok ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>
              LOT <strong className="text-slate-900">{lotSummaries.length}</strong>개
            </span>
            <span>
              사용 가능 <strong className="text-emerald-700">{readyCount}</strong>개
            </span>
            {alarmCount ? (
              <span>
                알람 <strong className="text-rose-700">{alarmCount}</strong>개
              </span>
            ) : null}
            <span>
              로그 <strong className="text-slate-900">{logs.length}</strong>건
            </span>
          </div>

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

            {view !== 'imports' ? (
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="LOT·설비·이벤트 검색"
                className={`w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 ${erpSearchFocusClass('smt')}`}
              />
            ) : null}
          </div>

          <div className={ERP_TABLE_WRAP_CLASS}>
            <div className={ERP_TABLE_SCROLL_CLASS}>
              {view === 'lots' ? (
                <table className={ERP_TABLE_CLASS}>
                  <thead className={ERP_TABLE_HEAD_CLASS}>
                    <tr>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>LOT</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>상태</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>최근 이벤트</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-left`}>최근 시각</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-right`}>온도</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-right`}>교반초</th>
                      <th className={`${ERP_TABLE_TH_CLASS} text-right`}>이벤트 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLots.length ? (
                      filteredLots.map((row) => (
                        <tr key={row.lotNumber} className={ERP_TABLE_ROW_CLASS}>
                          <td
                            className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-mono text-xs font-semibold text-blue-800`}
                          >
                            {row.lotNumber}
                          </td>
                          <td className={ERP_TABLE_TD_CLASS}>
                            <StatusBadge
                              label={SOLDER_CREAM_LOT_STATUS_LABELS[row.status]}
                              tone={lotStatusTone(row.status)}
                            />
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
                            {SOLDER_CREAM_EVENT_LABELS[row.lastEventType]}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-slate-600`}>
                            {formatSolderCreamDateTime(row.lastRecordedAt)}
                          </td>
                          <td
                            className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right tabular-nums text-slate-600`}
                          >
                            {row.lastTemperature ?? '—'}
                          </td>
                          <td
                            className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right tabular-nums text-slate-600`}
                          >
                            {row.lastMixSeconds ?? '—'}
                          </td>
                          <td
                            className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right tabular-nums text-slate-600`}
                          >
                            {row.eventCount}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                          {formatEmptyListMessage(
                            query ? '검색 결과가 없습니다.' : '가져온 설비 로그가 없습니다.',
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : null}

              {view === 'logs' ? (
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
                          {formatEmptyListMessage(
                            query ? '검색 결과가 없습니다.' : '가져온 설비 로그가 없습니다.',
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : null}

              {view === 'imports' ? (
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
                          <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
                            {row.sourceName || '—'}
                          </td>
                          <td
                            className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right tabular-nums`}
                          >
                            {row.rowCount}
                          </td>
                          <td className={ERP_TABLE_TD_CLASS}>{row.note || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-500">
                          {formatEmptyListMessage('가져오기 이력이 없습니다.')}
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
