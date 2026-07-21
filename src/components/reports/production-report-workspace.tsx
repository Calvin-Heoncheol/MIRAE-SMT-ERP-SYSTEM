'use client'

import { ReportBarChart } from '@/components/reports/report-bar-chart'
import { ReportPeriodControls } from '@/components/reports/report-period-controls'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { PdfDownloadButton } from '@/components/ui/pdf-download-button'
import { downloadExcelSheets, type ExcelColumn } from '@/lib/excel/export'
import { exportReportPdf } from '@/lib/reports/export-report-pdf'
import type { ReportPeriod } from '@/lib/reports/period'
import {
  PRODUCTION_REPORT_TEAMS,
  type FetchProductionReportResult,
  type ProductionReportDailyRow,
  type ProductionReportDetailRow,
  type ProductionReportTeamSummary,
} from '@/lib/reports/production-report'
import { formatWeekdayLabel, getWeekStartMondayYmd } from '@/lib/smt/plan/utils'

type ProductionReportWorkspaceProps = {
  result: FetchProductionReportResult
  period: ReportPeriod
  rangeLabel: string
  prevHref: string
  nextHref: string
  dayHref: string
  weekHref: string
  monthHref: string
}

function formatCount(value: number) {
  return value.toLocaleString('ko-KR')
}

function formatMonthDay(ymd: string) {
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
}

/** 팀 순서(생산1~4팀)에 맞춘 차트 색상 */
const TEAM_CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']

type ProductionTrendRow = {
  key: string
  label: string
  subLabel: string
  byTeam: Record<string, number>
  total: number
}

/** 일간·주간 뷰: 일별 그대로, 월간 뷰: 월요일 시작 주 단위로 합산 */
function buildTrendRows(
  daily: ProductionReportDailyRow[],
  period: ReportPeriod,
): ProductionTrendRow[] {
  if (period !== 'month') {
    return daily.map((row) => ({
      key: row.date,
      label: formatMonthDay(row.date),
      subLabel: formatWeekdayLabel(row.date),
      byTeam: row.byTeam,
      total: row.total,
    }))
  }

  const weekMap = new Map<string, { dates: string[]; byTeam: Record<string, number>; total: number }>()
  for (const row of daily) {
    const weekStart = getWeekStartMondayYmd(row.date)
    const bucket = weekMap.get(weekStart) ?? { dates: [], byTeam: {}, total: 0 }
    bucket.dates.push(row.date)
    for (const [team, value] of Object.entries(row.byTeam)) {
      bucket.byTeam[team] = (bucket.byTeam[team] ?? 0) + value
    }
    bucket.total += row.total
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
        subLabel: `${formatMonthDay(first)} ~ ${formatMonthDay(last)}`,
        byTeam: bucket.byTeam,
        total: bucket.total,
      }
    })
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
    </div>
  )
}

export function ProductionReportWorkspace({
  result,
  period,
  rangeLabel,
  prevHref,
  nextHref,
  dayHref,
  weekHref,
  monthHref,
}: ProductionReportWorkspaceProps) {
  const data = result.ok ? result.data : null

  async function handleExcelDownload() {
    if (!data) return

    const summaryColumns: ExcelColumn<ProductionReportTeamSummary>[] = [
      { header: '팀', value: (row) => row.team, width: 12 },
      { header: '생산수량', value: (row) => row.quantity, width: 12 },
      { header: '생산금액(원)', value: (row) => row.amount, width: 16 },
      { header: '원계획수량', value: (row) => row.plannedQuantity, width: 12 },
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
      ...PRODUCTION_REPORT_TEAMS.map((team) => ({
        header: team,
        value: (row: ProductionReportDailyRow) => row.byTeam[team] ?? 0,
        width: 10,
      })),
      { header: '합계', value: (row) => row.total, width: 10 },
    ]

    const detailColumns: ExcelColumn<ProductionReportDetailRow>[] = [
      { header: '기록일', value: (row) => row.recordDate, width: 12 },
      { header: '팀', value: (row) => row.team, width: 10 },
      { header: '주문서번호', value: (row) => row.orderNumber, width: 22 },
      { header: '고객사', value: (row) => row.customer, width: 18 },
      { header: '제품명', value: (row) => row.productName, width: 26 },
      { header: '수량', value: (row) => row.quantity, width: 10 },
      { header: '단가(원)', value: (row) => row.unitPrice, width: 10 },
      { header: '금액(원)', value: (row) => row.amount, width: 14 },
    ]

    await downloadExcelSheets({
      fileName: `생산실적_${data.startDate}_${data.endDate}`,
      sheets: [
        {
          sheetName: '팀별 요약',
          columns: summaryColumns as ExcelColumn<unknown>[],
          rows: data.teams as unknown[],
        },
        {
          sheetName: '일별 생산량',
          columns: dailyColumns as ExcelColumn<unknown>[],
          rows: data.daily as unknown[],
        },
        {
          sheetName: '상세 내역',
          columns: detailColumns as ExcelColumn<unknown>[],
          rows: data.details as unknown[],
        },
      ],
    })
  }

  function handlePdfDownload() {
    if (!data) return

    const trendRows = buildTrendRows(data.daily, period)
    const trendTitle =
      period === 'month' ? '월별 생산량' : period === 'week' ? '주별 생산량' : '일별 생산량'

    exportReportPdf({
      title: '생산실적 리포트',
      rangeLabel,
      stats: [
        { label: '총 생산수량', value: `${formatCount(data.totalQuantity)} EA` },
        { label: '총 생산금액', value: `${formatCount(data.totalAmount)} 원` },
        {
          label: '계획 달성률',
          value: data.totalAchievementRate != null ? `${data.totalAchievementRate}%` : '—',
          sub:
            data.totalPlannedQuantity > 0
              ? `원계획 ${formatCount(data.totalPlannedQuantity)} EA`
              : undefined,
        },
        {
          label: '납기 지연 주문',
          value: `${formatCount(data.totalOverdueOrders)} 건`,
          sub: '납기 경과 · 출하 미완료',
        },
      ],
      tables: [
        {
          title: '팀별 요약',
          columns: [
            { header: '팀' },
            { header: '생산수량', align: 'right' },
            { header: '생산금액(원)', align: 'right' },
            { header: '계획 달성률', align: 'right' },
            { header: '가동일수', align: 'right' },
            { header: '납기지연 주문', align: 'right' },
          ],
          rows: data.teams.map((team) => [
            team.team,
            formatCount(team.quantity),
            formatCount(team.amount),
            team.achievementRate != null
              ? `${team.achievementRate}% (계획 ${formatCount(team.plannedQuantity)})`
              : '—',
            `${formatCount(team.activeDays)}일`,
            `${formatCount(team.overdueOrders)}건`,
          ]),
        },
        {
          title: trendTitle,
          columns: [
            { header: period === 'month' ? '주' : '날짜' },
            ...PRODUCTION_REPORT_TEAMS.map((team) => ({ header: team, align: 'right' as const })),
            { header: '합계', align: 'right' },
          ],
          rows: trendRows.map((row) => [
            `${row.label} (${row.subLabel})`,
            ...PRODUCTION_REPORT_TEAMS.map((team) => formatCount(row.byTeam[team] ?? 0)),
            formatCount(row.total),
          ]),
        },
      ],
    })
  }

  return (
    <div className="flex w-full flex-1 flex-col gap-4">
      <ReportPeriodControls
        period={period}
        rangeLabel={rangeLabel}
        prevHref={prevHref}
        nextHref={nextHref}
        dayHref={dayHref}
        weekHref={weekHref}
        monthHref={monthHref}
        actions={
          <div className="flex items-center gap-2">
            <PdfDownloadButton onDownload={handlePdfDownload} disabled={!data} />
            <ExcelDownloadButton onDownload={handleExcelDownload} disabled={!data} />
          </div>
        }
      />

      {!result.ok ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          리포트 데이터를 불러오지 못했습니다: {result.detail}
        </div>
      ) : data ? (
        <>
          {/* 기간 합계 카드 */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="총 생산수량" value={`${formatCount(data.totalQuantity)} EA`} />
            <StatCard label="총 생산금액" value={`${formatCount(data.totalAmount)} 원`} />
            <StatCard
              label="계획 달성률"
              value={data.totalAchievementRate != null ? `${data.totalAchievementRate}%` : '—'}
              sub={
                data.totalPlannedQuantity > 0
                  ? `원계획 ${formatCount(data.totalPlannedQuantity)} EA (지난 날짜 기준)`
                  : '기간 내 마감된 계획 없음'
              }
            />
            <StatCard
              label="납기 지연 주문"
              value={`${formatCount(data.totalOverdueOrders)} 건`}
              sub="납기 경과 · 출하 미완료 (현재 기준)"
            />
          </div>

          {/* 팀별 요약 */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      팀
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      생산수량
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      생산금액
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      계획 달성률
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      가동일수
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      납기지연 주문
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.teams.map((team) => (
                    <tr key={team.team} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-sm font-bold text-slate-900">{team.team}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                        {formatCount(team.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                        {formatCount(team.amount)} 원
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums">
                        {team.achievementRate != null ? (
                          <span
                            className={[
                              'font-semibold',
                              team.achievementRate >= 100
                                ? 'text-emerald-700'
                                : team.achievementRate >= 80
                                  ? 'text-slate-900'
                                  : 'text-rose-700',
                            ].join(' ')}
                          >
                            {team.achievementRate}%
                            <span className="ml-1 text-xs font-normal text-slate-400">
                              / {formatCount(team.plannedQuantity)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                        {formatCount(team.activeDays)}일
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums">
                        {team.overdueOrders > 0 ? (
                          <span className="font-semibold text-rose-700">
                            {formatCount(team.overdueOrders)}건
                          </span>
                        ) : (
                          <span className="text-slate-400">0건</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 생산량 추이: 팀별 누적 막대 */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">
                {period === 'month' ? '월별 생산량' : period === 'week' ? '주별 생산량' : '일별 생산량'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">팀별 누적 — EA</p>
            </div>
            <div className="px-4 py-4">
              <ReportBarChart
                rows={buildTrendRows(data.daily, period).map((row) => ({
                  label: row.label,
                  subLabel: row.subLabel,
                  ...Object.fromEntries(
                    PRODUCTION_REPORT_TEAMS.map((team) => [team, row.byTeam[team] ?? 0]),
                  ),
                }))}
                series={PRODUCTION_REPORT_TEAMS.map((team, index) => ({
                  key: team,
                  label: team,
                  color: TEAM_CHART_COLORS[index % TEAM_CHART_COLORS.length],
                }))}
                unit="EA"
                stacked
              />
            </div>
          </div>

        </>
      ) : null}
    </div>
  )
}
