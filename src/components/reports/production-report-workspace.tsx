'use client'

import { useEffect, useState } from 'react'
import { useDashboardChrome } from '@/components/dashboard/dashboard-chrome'
import { ReportPeriodControls } from '@/components/reports/report-period-controls'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { PdfDownloadButton } from '@/components/ui/pdf-download-button'
import { PageShell } from '@/components/ui/page-shell'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import {
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'
import { downloadExcelSheets, type ExcelColumn } from '@/lib/excel/export'
import { exportReportPdf } from '@/lib/reports/export-report-pdf'
import type { ReportPeriod } from '@/lib/reports/period'
import {
  PRODUCTION_REPORT_TEAMS,
  SMT_REPORT_TEAM,
  type FetchProductionReportResult,
  type ProductionReportDailyRow,
  type ProductionReportDetailRow,
  type ProductionReportTeamSummary,
} from '@/lib/reports/production-report'
import { formatWeekdayLabel, getWeekStartMondayYmd } from '@/lib/smt/plan/utils'

function teamButtonLabel(team: string) {
  return team.replace(/팀$/, '')
}

type ProductionReportWorkspaceProps = {
  result: FetchProductionReportResult
  period: ReportPeriod
  rangeLabel: string
  prevHref: string
  nextHref: string
  weekHref: string
  monthHref: string
}

function formatCount(value: number) {
  return value.toLocaleString('ko-KR')
}

function formatMonthDay(ymd: string) {
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
}

function rateLabel(planned: number, actual: number) {
  if (planned <= 0) return '—'
  return `${Math.round((actual / planned) * 100)}%`
}

type PlanActualTrendRow = {
  key: string
  label: string
  subLabel: string
  planned: number
  actual: number
}

/** 주간: 일별 계획/실적, 월간: 월요일 시작 주 단위 합산 (표시 팀만) */
function buildPlanActualTrendRows(
  daily: ProductionReportDailyRow[],
  period: ReportPeriod,
  teams: readonly string[],
): PlanActualTrendRow[] {
  const teamPlanned = (row: ProductionReportDailyRow) =>
    teams.reduce((sum, team) => sum + (row.plannedByTeam[team] ?? 0), 0)
  const teamActual = (row: ProductionReportDailyRow) =>
    teams.reduce((sum, team) => sum + (row.byTeam[team] ?? 0), 0)

  if (period !== 'month') {
    return daily.map((row) => ({
      key: row.date,
      label: formatMonthDay(row.date),
      subLabel: formatWeekdayLabel(row.date),
      planned: teamPlanned(row),
      actual: teamActual(row),
    }))
  }

  const weekMap = new Map<string, { dates: string[]; planned: number; actual: number }>()
  for (const row of daily) {
    const weekStart = getWeekStartMondayYmd(row.date)
    const bucket = weekMap.get(weekStart) ?? { dates: [], planned: 0, actual: 0 }
    bucket.dates.push(row.date)
    bucket.planned += teamPlanned(row)
    bucket.actual += teamActual(row)
    weekMap.set(weekStart, bucket)
  }

  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, bucket], index) => {
      const first = bucket.dates[0]
      const last = bucket.dates[bucket.dates.length - 1]
      return {
        key: weekStart,
        // X축에 날짜 구간이 먼저 보이도록
        label: `${formatMonthDay(first)}~${formatMonthDay(last)}`,
        subLabel: `${index + 1}주차`,
        planned: bucket.planned,
        actual: bucket.actual,
      }
    })
}

type MatrixColumn = {
  key: string
  label: string
  subLabel: string
  planned: number
  actual: number
  plannedByTeam: Record<string, number>
  actualByTeam: Record<string, number>
  plannedByLine: Record<number, number>
  actualByLine: Record<number, number>
}

type MatrixGroup = {
  key: string
  label: string
  planned: (col: MatrixColumn) => number
  actual: (col: MatrixColumn) => number
}

function smtLineLabel(lineNo: number) {
  return `LINE ${lineNo}`
}

/** 후공정 팀은 팀 행, 생산1팀(SMT)은 라인별 행 */
function buildMatrixGroups(teams: readonly string[], smtLines: number[]): MatrixGroup[] {
  return [
    ...teams.map((team) => ({
      key: team,
      label: team,
      planned: (col: MatrixColumn) => col.plannedByTeam[team] ?? 0,
      actual: (col: MatrixColumn) => col.actualByTeam[team] ?? 0,
    })),
    ...smtLines.map((lineNo) => ({
      key: `line-${lineNo}`,
      label: smtLineLabel(lineNo),
      planned: (col: MatrixColumn) => col.plannedByLine[lineNo] ?? 0,
      actual: (col: MatrixColumn) => col.actualByLine[lineNo] ?? 0,
    })),
  ]
}

function addLineValues(target: Record<number, number>, source: Record<number, number>) {
  for (const [lineNo, value] of Object.entries(source)) {
    const key = Number(lineNo)
    target[key] = (target[key] ?? 0) + value
  }
}

function buildMatrixColumns(
  daily: ProductionReportDailyRow[],
  period: ReportPeriod,
  teams: readonly string[],
): MatrixColumn[] {
  const teamPlanned = (row: ProductionReportDailyRow) =>
    teams.reduce((sum, team) => sum + (row.plannedByTeam[team] ?? 0), 0)
  const teamActual = (row: ProductionReportDailyRow) =>
    teams.reduce((sum, team) => sum + (row.byTeam[team] ?? 0), 0)
  const pickTeams = (source: Record<string, number>) =>
    Object.fromEntries(teams.map((team) => [team, source[team] ?? 0]))

  if (period !== 'month') {
    return daily.map((row) => ({
      key: row.date,
      label: formatMonthDay(row.date),
      subLabel: formatWeekdayLabel(row.date),
      planned: teamPlanned(row),
      actual: teamActual(row),
      plannedByTeam: pickTeams(row.plannedByTeam),
      actualByTeam: pickTeams(row.byTeam),
      plannedByLine: row.smtPlannedByLine,
      actualByLine: row.smtByLine,
    }))
  }

  const weekMap = new Map<
    string,
    {
      dates: string[]
      planned: number
      actual: number
      plannedByTeam: Record<string, number>
      actualByTeam: Record<string, number>
      plannedByLine: Record<number, number>
      actualByLine: Record<number, number>
    }
  >()

  for (const row of daily) {
    const weekStart = getWeekStartMondayYmd(row.date)
    const bucket = weekMap.get(weekStart) ?? {
      dates: [],
      planned: 0,
      actual: 0,
      plannedByTeam: {},
      actualByTeam: {},
      plannedByLine: {},
      actualByLine: {},
    }
    bucket.dates.push(row.date)
    addLineValues(bucket.plannedByLine, row.smtPlannedByLine)
    addLineValues(bucket.actualByLine, row.smtByLine)
    bucket.planned += teamPlanned(row)
    bucket.actual += teamActual(row)
    for (const team of teams) {
      bucket.plannedByTeam[team] =
        (bucket.plannedByTeam[team] ?? 0) + (row.plannedByTeam[team] ?? 0)
      bucket.actualByTeam[team] = (bucket.actualByTeam[team] ?? 0) + (row.byTeam[team] ?? 0)
    }
    weekMap.set(weekStart, bucket)
  }

  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, bucket], index) => {
      const first = bucket.dates[0]
      const last = bucket.dates[bucket.dates.length - 1]
      return {
        key: weekStart,
        label: `${index + 1}주차`,
        subLabel: `${formatMonthDay(first)}~${formatMonthDay(last)}`,
        planned: bucket.planned,
        actual: bucket.actual,
        plannedByTeam: bucket.plannedByTeam,
        actualByTeam: bucket.actualByTeam,
        plannedByLine: bucket.plannedByLine,
        actualByLine: bucket.actualByLine,
      }
    })
}

export function ProductionReportWorkspace({
  result,
  period,
  rangeLabel,
  prevHref,
  nextHref,
  weekHref,
  monthHref,
}: ProductionReportWorkspaceProps) {
  const { focusMode, toggleFocusMode, setFocusMode } = useDashboardChrome()

  useEffect(() => {
    return () => setFocusMode(false)
  }, [setFocusMode])

  const [selectedTeam, setSelectedTeam] = useState<string>(SMT_REPORT_TEAM)
  const teams = [selectedTeam]
  const isSmtTeam = selectedTeam === SMT_REPORT_TEAM

  const data = result.ok ? result.data : null
  const visibleTeams = data ? data.teams.filter((team) => teams.includes(team.team)) : []
  const teamSummary = visibleTeams[0] ?? null
  const visibleDetails = data ? data.details.filter((row) => teams.includes(row.team)) : []
  const smtLines = data && isSmtTeam ? data.smtLines : []
  const trendRows = data ? buildPlanActualTrendRows(data.daily, period, teams) : []
  const matrixColumns = data ? buildMatrixColumns(data.daily, period, teams) : []
  const matrixGroups = buildMatrixGroups(isSmtTeam ? [] : teams, smtLines)

  function rateToneClass(planned: number, actual: number) {
    if (planned <= 0) return 'text-slate-400'
    const rate = Math.round((actual / planned) * 100)
    if (rate >= 100) return 'font-semibold text-emerald-700'
    if (rate >= 80) return 'text-slate-800'
    return 'font-semibold text-rose-700'
  }

  async function handleExcelDownload() {
    if (!data || !teamSummary) return

    const summaryColumns: ExcelColumn<ProductionReportTeamSummary>[] = [
      { header: '팀', value: (row) => row.team, width: 12 },
      { header: '생산수량', value: (row) => row.quantity, width: 12 },
      { header: '생산금액(원)', value: (row) => row.amount, width: 16 },
      { header: '계획수량', value: (row) => row.plannedQuantity, width: 12 },
      {
        header: '계획 달성률(%)',
        value: (row) => (row.achievementRate != null ? row.achievementRate : ''),
        width: 12,
      },
      { header: '가동일수', value: (row) => row.activeDays, width: 10 },
      { header: '납기지연 주문', value: (row) => row.overdueOrders, width: 12 },
    ]

    const dailyColumns: ExcelColumn<ProductionReportDailyRow>[] = [
      { header: '날짜', value: (row) => row.date, width: 12 },
      ...teams.flatMap((team) => [
        {
          header: `${team} 계획`,
          value: (row: ProductionReportDailyRow) => row.plannedByTeam[team] ?? 0,
          width: 10,
        },
        {
          header: `${team} 실적`,
          value: (row: ProductionReportDailyRow) => row.byTeam[team] ?? 0,
          width: 10,
        },
      ]),
      ...smtLines.flatMap((lineNo) => [
        {
          header: `${smtLineLabel(lineNo)} 계획`,
          value: (row: ProductionReportDailyRow) => row.smtPlannedByLine[lineNo] ?? 0,
          width: 10,
        },
        {
          header: `${smtLineLabel(lineNo)} 실적`,
          value: (row: ProductionReportDailyRow) => row.smtByLine[lineNo] ?? 0,
          width: 10,
        },
      ]),
    ]

    const detailColumns: ExcelColumn<ProductionReportDetailRow>[] = [
      { header: '기록일', value: (row) => row.recordDate, width: 12 },
      { header: '팀', value: (row) => row.team, width: 10 },
      { header: '발주번호', value: (row) => row.orderNumber, width: 22 },
      { header: '고객사', value: (row) => row.customer, width: 18 },
      { header: '제품명', value: (row) => row.productName, width: 26 },
      { header: '수량', value: (row) => row.quantity, width: 10 },
      { header: '단가(원)', value: (row) => row.unitPrice, width: 10 },
      { header: '금액(원)', value: (row) => row.amount, width: 14 },
    ]

    await downloadExcelSheets({
      fileName: `생산실적_${selectedTeam}_${data.startDate}_${data.endDate}`,
      sheets: [
        {
          sheetName: '팀 요약',
          columns: summaryColumns as ExcelColumn<unknown>[],
          rows: visibleTeams as unknown[],
        },
        {
          sheetName: '일별 계획대비',
          columns: dailyColumns as ExcelColumn<unknown>[],
          rows: data.daily as unknown[],
        },
        {
          sheetName: '상세 내역',
          columns: detailColumns as ExcelColumn<unknown>[],
          rows: visibleDetails as unknown[],
        },
      ],
    })
  }

  function handlePdfDownload() {
    if (!data || !teamSummary) return

    exportReportPdf({
      title: `생산실적 리포트 (${selectedTeam})`,
      rangeLabel,
      stats: [
        { label: '총 생산수량', value: `${formatCount(teamSummary.quantity)} EA` },
        { label: '총 생산금액', value: `${formatCount(teamSummary.amount)} 원` },
        {
          label: '계획 달성률',
          value: teamSummary.achievementRate != null ? `${teamSummary.achievementRate}%` : '—',
          sub:
            teamSummary.plannedQuantity > 0
              ? `계획배정 ${formatCount(teamSummary.plannedQuantity)} EA`
              : undefined,
        },
        {
          label: '납기 지연 주문',
          value: `${formatCount(teamSummary.overdueOrders)} 건`,
          sub: '납기 경과 · 출하 미완료',
        },
      ],
      tables: [
        {
          title: period === 'month' ? '주차별 계획 대비 실적' : '일별 계획 대비 실적',
          columns: [
            { header: period === 'month' ? '주' : '날짜' },
            { header: '계획', align: 'right' },
            { header: '실적', align: 'right' },
            { header: '달성률', align: 'right' },
          ],
          rows: trendRows.map((row) => [
            `${row.label} (${row.subLabel})`,
            formatCount(row.planned),
            formatCount(row.actual),
            rateLabel(row.planned, row.actual),
          ]),
        },
        ...(smtLines.length > 0
          ? [
              {
                title: period === 'month' ? '라인별 주차별 계획 대비 실적' : '라인별 일별 계획 대비 실적',
                columns: [
                  { header: period === 'month' ? '주' : '날짜' },
                  { header: '라인' },
                  { header: '계획', align: 'right' as const },
                  { header: '실적', align: 'right' as const },
                  { header: '달성률', align: 'right' as const },
                ],
                rows: matrixColumns.flatMap((col) =>
                  smtLines.map((lineNo) => {
                    const planned = col.plannedByLine[lineNo] ?? 0
                    const actual = col.actualByLine[lineNo] ?? 0
                    return [
                      `${col.label} (${col.subLabel})`,
                      smtLineLabel(lineNo),
                      formatCount(planned),
                      formatCount(actual),
                      rateLabel(planned, actual),
                    ]
                  }),
                ),
              },
            ]
          : []),
      ],
    })
  }

  return (
    <PageShell>
      <WorkspaceHeader
        inlineFilters={
          <ReportPeriodControls
            period={period}
            rangeLabel={rangeLabel}
            prevHref={prevHref}
            nextHref={nextHref}
            weekHref={weekHref}
            monthHref={monthHref}
          />
        }
        actions={
          <>
            <PdfDownloadButton onDownload={handlePdfDownload} disabled={!data} />
            <ExcelDownloadButton onDownload={handleExcelDownload} disabled={!data} />
            <button
              type="button"
              onClick={toggleFocusMode}
              title={focusMode ? '전체화면 종료 (Esc)' : '전체화면 — 실적만 보기'}
              aria-label={focusMode ? '전체화면 종료' : '전체화면'}
              aria-pressed={focusMode}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                focusMode
                  ? 'border-slate-800 bg-slate-800 text-white hover:bg-slate-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {focusMode ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9H4V4M15 9h5V4M9 15H4v5M15 15h5v5" />
                </svg>
              )}
            </button>
          </>
        }
      />

      {!result.ok ? (
        <FetchErrorBanner title="리포트 데이터를 불러오지 못했습니다" detail={result.detail} />
      ) : data ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden">
          <div className={`${ERP_TABLE_WRAP_CLASS} !min-h-[200px]`}>
            <div className="shrink-0 border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">
                {selectedTeam} {period === 'month' ? '주차별' : '일별'} 계획 대비 실적
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="팀 선택">
                {PRODUCTION_REPORT_TEAMS.map((team) => {
                  const active = team === selectedTeam
                  return (
                    <button
                      key={team}
                      type="button"
                      onClick={() => setSelectedTeam(team)}
                      aria-pressed={active}
                      className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                        active
                          ? 'border-slate-800 bg-slate-800 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {teamButtonLabel(team)}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className={ERP_TABLE_SCROLL_CLASS}>
              <table className={`${ERP_TABLE_CLASS} min-w-max`}>
                <thead className={ERP_TABLE_HEAD_CLASS}>
                  <tr>
                    <th
                      className={`${ERP_TABLE_TH_CLASS} sticky left-0 z-20 min-w-[5.5rem] bg-slate-50 text-left`}
                    >
                      {isSmtTeam ? '라인' : '팀'}
                    </th>
                    <th
                      className={`${ERP_TABLE_TH_CLASS} sticky left-[5.5rem] z-20 min-w-[3.5rem] bg-slate-50 text-left`}
                    >
                      구분
                    </th>
                    {matrixColumns.map((col) => (
                      <th
                        key={col.key}
                        className={`${ERP_TABLE_TH_CLASS} min-w-[4.5rem] text-center`}
                      >
                        <div>{col.label}</div>
                        <div className="mt-0.5 text-[10px] font-medium text-slate-400">
                          {col.subLabel}
                        </div>
                      </th>
                    ))}
                    <th className={`${ERP_TABLE_TH_CLASS} min-w-[4.5rem] text-center`}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixGroups.length === 0 ? (
                    <tr>
                      <td
                        colSpan={matrixColumns.length + 3}
                        className={`${ERP_TABLE_TD_CLASS} py-8 text-center text-slate-400`}
                      >
                        이 기간에 라인별 생산계획이 없습니다.
                      </td>
                    </tr>
                  ) : null}
                  {matrixGroups.map((group) => {
                    const teamPlannedTotal = matrixColumns.reduce(
                      (sum, col) => sum + (group.planned(col)),
                      0,
                    )
                    const teamActualTotal = matrixColumns.reduce(
                      (sum, col) => sum + (group.actual(col)),
                      0,
                    )
                    const metrics = [
                      {
                        key: 'plan',
                        label: '계획',
                        labelClass: 'text-slate-600',
                        valueClass: 'text-slate-700',
                        totalClass: 'font-semibold text-slate-800',
                        value: (col: (typeof matrixColumns)[number]) => group.planned(col),
                        total: teamPlannedTotal,
                        format: (value: number) => (value > 0 ? formatCount(value) : '—'),
                      },
                      {
                        key: 'actual',
                        label: '실적',
                        labelClass: 'text-blue-800',
                        valueClass: 'text-slate-900',
                        totalClass: 'font-semibold text-slate-900',
                        value: (col: (typeof matrixColumns)[number]) => group.actual(col),
                        total: teamActualTotal,
                        format: (value: number) => (value > 0 ? formatCount(value) : '—'),
                      },
                      {
                        key: 'rate',
                        label: '달성률',
                        labelClass: 'text-slate-600',
                        valueClass: '',
                        totalClass: rateToneClass(teamPlannedTotal, teamActualTotal),
                        value: (col: (typeof matrixColumns)[number]) => {
                          const planned = group.planned(col)
                          const actual = group.actual(col)
                          return planned > 0 ? Math.round((actual / planned) * 100) : null
                        },
                        total: null as number | null,
                        format: (value: number | null) => (value == null ? '—' : `${value}%`),
                      },
                    ] as const

                    return metrics.map((metric, metricIndex) => (
                      <tr
                        key={`${group.key}-${metric.key}`}
                        className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                          metricIndex === 0 ? 'border-t-slate-200' : ''
                        }`}
                      >
                        {metricIndex === 0 ? (
                          <td
                            rowSpan={3}
                            className={`${ERP_TABLE_TD_CLASS} sticky left-0 z-10 border-r border-slate-100 bg-white align-middle font-bold text-slate-900`}
                          >
                            {group.label}
                          </td>
                        ) : null}
                        <td
                          className={`${ERP_TABLE_TD_CLASS} sticky left-[5.5rem] z-10 bg-white font-medium ${metric.labelClass}`}
                        >
                          {metric.label}
                        </td>
                        {matrixColumns.map((col) => {
                          if (metric.key === 'rate') {
                            const planned = group.planned(col)
                            const actual = group.actual(col)
                            return (
                              <td
                                key={`${group.key}-${metric.key}-${col.key}`}
                                className={`${ERP_TABLE_TD_CLASS} text-center tabular-nums ${rateToneClass(planned, actual)}`}
                              >
                                {rateLabel(planned, actual)}
                              </td>
                            )
                          }
                          const value = metric.value(col) as number
                          return (
                            <td
                              key={`${group.key}-${metric.key}-${col.key}`}
                              className={`${ERP_TABLE_TD_CLASS} text-center tabular-nums ${metric.valueClass}`}
                            >
                              {metric.format(value)}
                            </td>
                          )
                        })}
                        <td
                          className={`${ERP_TABLE_TD_CLASS} text-center tabular-nums ${metric.totalClass}`}
                        >
                          {metric.key === 'rate'
                            ? rateLabel(teamPlannedTotal, teamActualTotal)
                            : metric.format(metric.total as number)}
                        </td>
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
