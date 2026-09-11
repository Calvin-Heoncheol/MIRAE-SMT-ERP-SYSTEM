'use client'

import { ReportBarChart } from '@/components/reports/report-bar-chart'
import { ReportPeriodControls } from '@/components/reports/report-period-controls'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { KpiStatCard } from '@/components/ui/kpi-stat-card'
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
  SMT_REPORT_TEAM,
  type FetchProductionReportResult,
  type ProductionReportDailyRow,
  type ProductionReportDetailRow,
  type ProductionReportTeamSummary,
} from '@/lib/reports/production-report'
import { formatWeekdayLabel, getWeekStartMondayYmd } from '@/lib/smt/plan/utils'

/** 당분간 생산실적 화면은 생산1팀(SMT)만 표시 */
const PERFORMANCE_TEAMS = [SMT_REPORT_TEAM] as const

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
): PlanActualTrendRow[] {
  const teamPlanned = (row: ProductionReportDailyRow) =>
    PERFORMANCE_TEAMS.reduce((sum, team) => sum + (row.plannedByTeam[team] ?? 0), 0)
  const teamActual = (row: ProductionReportDailyRow) =>
    PERFORMANCE_TEAMS.reduce((sum, team) => sum + (row.byTeam[team] ?? 0), 0)

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
}

function buildMatrixColumns(
  daily: ProductionReportDailyRow[],
  period: ReportPeriod,
): MatrixColumn[] {
  const teamPlanned = (row: ProductionReportDailyRow) =>
    PERFORMANCE_TEAMS.reduce((sum, team) => sum + (row.plannedByTeam[team] ?? 0), 0)
  const teamActual = (row: ProductionReportDailyRow) =>
    PERFORMANCE_TEAMS.reduce((sum, team) => sum + (row.byTeam[team] ?? 0), 0)
  const pickTeams = (source: Record<string, number>) =>
    Object.fromEntries(PERFORMANCE_TEAMS.map((team) => [team, source[team] ?? 0]))

  if (period !== 'month') {
    return daily.map((row) => ({
      key: row.date,
      label: formatMonthDay(row.date),
      subLabel: formatWeekdayLabel(row.date),
      planned: teamPlanned(row),
      actual: teamActual(row),
      plannedByTeam: pickTeams(row.plannedByTeam),
      actualByTeam: pickTeams(row.byTeam),
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
    }
    bucket.dates.push(row.date)
    bucket.planned += teamPlanned(row)
    bucket.actual += teamActual(row)
    for (const team of PERFORMANCE_TEAMS) {
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
  const data = result.ok ? result.data : null
  const visibleTeams = data
    ? data.teams.filter((team) =>
        (PERFORMANCE_TEAMS as readonly string[]).includes(team.team),
      )
    : []
  const teamSummary = visibleTeams[0] ?? null
  const visibleDetails = data
    ? data.details.filter((row) => (PERFORMANCE_TEAMS as readonly string[]).includes(row.team))
    : []
  const trendRows = data ? buildPlanActualTrendRows(data.daily, period) : []
  const matrixColumns = data ? buildMatrixColumns(data.daily, period) : []

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
      ...PERFORMANCE_TEAMS.flatMap((team) => [
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
      fileName: `생산실적_생산1팀_${data.startDate}_${data.endDate}`,
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
      title: '생산실적 리포트 (생산1팀)',
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
      ],
    })
  }

  return (
    <PageShell>
      {data && teamSummary ? (
        <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
          <KpiStatCard label="총 생산수량" value={teamSummary.quantity} unit="EA" />
          <KpiStatCard label="총 생산금액" value={teamSummary.amount} unit="원" />
          <KpiStatCard
            label="계획 달성률"
            value={teamSummary.achievementRate != null ? `${teamSummary.achievementRate}%` : null}
            hint={
              teamSummary.plannedQuantity > 0
                ? `계획배정 ${formatCount(teamSummary.plannedQuantity)} EA (지난 날짜 · 생산계획 보드 배정분)`
                : '기간 내 생산계획 보드 배정 없음'
            }
            tone={
              teamSummary.achievementRate == null
                ? 'slate'
                : teamSummary.achievementRate >= 100
                  ? 'emerald'
                  : teamSummary.achievementRate >= 80
                    ? 'default'
                    : 'rose'
            }
          />
          <KpiStatCard
            label="납기 지연 주문"
            value={teamSummary.overdueOrders}
            unit="건"
            hint="납기 경과 · 출하 미완료 (현재 기준)"
            tone={teamSummary.overdueOrders > 0 ? 'rose' : 'default'}
          />
        </div>
      ) : null}

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
          </>
        }
      />

      {!result.ok ? (
        <FetchErrorBanner title="리포트 데이터를 불러오지 못했습니다" detail={result.detail} />
      ) : data ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden">
          <div className={`${ERP_TABLE_WRAP_CLASS} flex min-h-[300px] flex-[0.9] flex-col !overflow-visible`}>
            <div className="shrink-0 border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">계획 대비 실적 (생산1팀)</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {period === 'month' ? '주차별' : '일별'} 계획 · 실적 수량 (EA)
              </p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-6 pt-4">
              <ReportBarChart
                rows={trendRows.map((row) => ({
                  label: row.label,
                  subLabel: row.subLabel,
                  planned: row.planned,
                  actual: row.actual,
                }))}
                series={[
                  { key: 'planned', label: '계획', color: '#94a3b8' },
                  { key: 'actual', label: '실적', color: '#2563eb' },
                ]}
                unit="EA"
                height={280}
              />
            </div>
          </div>

          <div className={`${ERP_TABLE_WRAP_CLASS} min-h-0 flex-1`}>
            <div className="shrink-0 border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">
                {period === 'month' ? '생산1팀 주차별 계획 대비 실적' : '생산1팀 일별 계획 대비 실적'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">날짜별 계획 수량과 생산등록(실적) 수량</p>
            </div>
            <div className={ERP_TABLE_SCROLL_CLASS}>
              <table className={`${ERP_TABLE_CLASS} min-w-max`}>
                <thead className={ERP_TABLE_HEAD_CLASS}>
                  <tr>
                    <th
                      className={`${ERP_TABLE_TH_CLASS} sticky left-0 z-20 min-w-[5.5rem] bg-slate-50 text-left`}
                    >
                      팀
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
                  {PERFORMANCE_TEAMS.map((team) => {
                    const teamPlannedTotal = matrixColumns.reduce(
                      (sum, col) => sum + (col.plannedByTeam[team] ?? 0),
                      0,
                    )
                    const teamActualTotal = matrixColumns.reduce(
                      (sum, col) => sum + (col.actualByTeam[team] ?? 0),
                      0,
                    )
                    const metrics = [
                      {
                        key: 'plan',
                        label: '계획',
                        labelClass: 'text-slate-600',
                        valueClass: 'text-slate-700',
                        totalClass: 'font-semibold text-slate-800',
                        value: (col: (typeof matrixColumns)[number]) => col.plannedByTeam[team] ?? 0,
                        total: teamPlannedTotal,
                        format: (value: number) => (value > 0 ? formatCount(value) : '—'),
                      },
                      {
                        key: 'actual',
                        label: '실적',
                        labelClass: 'text-blue-800',
                        valueClass: 'text-slate-900',
                        totalClass: 'font-semibold text-slate-900',
                        value: (col: (typeof matrixColumns)[number]) => col.actualByTeam[team] ?? 0,
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
                          const planned = col.plannedByTeam[team] ?? 0
                          const actual = col.actualByTeam[team] ?? 0
                          return planned > 0 ? Math.round((actual / planned) * 100) : null
                        },
                        total: null as number | null,
                        format: (value: number | null) => (value == null ? '—' : `${value}%`),
                      },
                    ] as const

                    return metrics.map((metric, metricIndex) => (
                      <tr
                        key={`${team}-${metric.key}`}
                        className={`border-t border-slate-100 hover:bg-slate-50/80 ${
                          metricIndex === 0 ? 'border-t-slate-200' : ''
                        }`}
                      >
                        {metricIndex === 0 ? (
                          <td
                            rowSpan={3}
                            className={`${ERP_TABLE_TD_CLASS} sticky left-0 z-10 border-r border-slate-100 bg-white align-middle font-bold text-slate-900`}
                          >
                            {team}
                          </td>
                        ) : null}
                        <td
                          className={`${ERP_TABLE_TD_CLASS} sticky left-[5.5rem] z-10 bg-white font-medium ${metric.labelClass}`}
                        >
                          {metric.label}
                        </td>
                        {matrixColumns.map((col) => {
                          if (metric.key === 'rate') {
                            const planned = col.plannedByTeam[team] ?? 0
                            const actual = col.actualByTeam[team] ?? 0
                            return (
                              <td
                                key={`${team}-${metric.key}-${col.key}`}
                                className={`${ERP_TABLE_TD_CLASS} text-center tabular-nums ${rateToneClass(planned, actual)}`}
                              >
                                {rateLabel(planned, actual)}
                              </td>
                            )
                          }
                          const value = metric.value(col) as number
                          return (
                            <td
                              key={`${team}-${metric.key}-${col.key}`}
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
