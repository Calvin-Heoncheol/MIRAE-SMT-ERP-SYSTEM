'use client'

import { ReportBarChart } from '@/components/reports/report-bar-chart'
import { ReportPeriodControls } from '@/components/reports/report-period-controls'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { PdfDownloadButton } from '@/components/ui/pdf-download-button'
import { downloadExcelSheets, type ExcelColumn } from '@/lib/excel/export'
import { exportReportPdf } from '@/lib/reports/export-report-pdf'
import type { ReportPeriod } from '@/lib/reports/period'
import type {
  FetchSalesReportResult,
  SalesReportCustomerRow,
  SalesReportDailyRow,
  SalesReportShipmentRow,
} from '@/lib/reports/sales-report'
import { formatWeekdayLabel, getWeekStartMondayYmd } from '@/lib/smt/plan/utils'

type SalesReportWorkspaceProps = {
  result: FetchSalesReportResult
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

type SalesTrendRow = {
  key: string
  label: string
  subLabel: string
  orderCount: number
  orderAmount: number
  shippedQuantity: number
  shippedAmount: number
}

/** 주간 뷰: 일별 그대로, 월간 뷰: 월요일 시작 주 단위로 합산 */
function buildTrendRows(daily: SalesReportDailyRow[], period: ReportPeriod): SalesTrendRow[] {
  if (period !== 'month') {
    return daily.map((row) => ({
      key: row.date,
      label: formatMonthDay(row.date),
      subLabel: formatWeekdayLabel(row.date),
      orderCount: row.orderCount,
      orderAmount: row.orderAmount,
      shippedQuantity: row.shippedQuantity,
      shippedAmount: row.shippedAmount,
    }))
  }

  const weekMap = new Map<
    string,
    { dates: string[]; orderCount: number; orderAmount: number; shippedQuantity: number; shippedAmount: number }
  >()
  for (const row of daily) {
    const weekStart = getWeekStartMondayYmd(row.date)
    const bucket =
      weekMap.get(weekStart) ??
      ({ dates: [], orderCount: 0, orderAmount: 0, shippedQuantity: 0, shippedAmount: 0 } as const as {
        dates: string[]
        orderCount: number
        orderAmount: number
        shippedQuantity: number
        shippedAmount: number
      })
    bucket.dates.push(row.date)
    bucket.orderCount += row.orderCount
    bucket.orderAmount += row.orderAmount
    bucket.shippedQuantity += row.shippedQuantity
    bucket.shippedAmount += row.shippedAmount
    weekMap.set(weekStart, bucket)
  }

  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, bucket], index) => ({
      key: weekStart,
      label: `${index + 1}주차`,
      subLabel: `${formatMonthDay(bucket.dates[0])} ~ ${formatMonthDay(bucket.dates[bucket.dates.length - 1])}`,
      orderCount: bucket.orderCount,
      orderAmount: bucket.orderAmount,
      shippedQuantity: bucket.shippedQuantity,
      shippedAmount: bucket.shippedAmount,
    }))
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

export function SalesReportWorkspace({
  result,
  period,
  rangeLabel,
  prevHref,
  nextHref,
  weekHref,
  monthHref,
}: SalesReportWorkspaceProps) {
  const data = result.ok ? result.data : null

  async function handleExcelDownload() {
    if (!data) return

    const customerColumns: ExcelColumn<SalesReportCustomerRow>[] = [
      { header: '고객사', value: (row) => row.customer, width: 20 },
      { header: '수주 건수', value: (row) => row.orderCount, width: 10 },
      { header: '수주 금액(원)', value: (row) => row.orderAmount, width: 16 },
      { header: '출하 수량', value: (row) => row.shippedQuantity, width: 10 },
      { header: '출하 금액(원)', value: (row) => row.shippedAmount, width: 16 },
    ]

    const dailyColumns: ExcelColumn<SalesReportDailyRow>[] = [
      { header: '날짜', value: (row) => row.date, width: 12 },
      { header: '수주 건수', value: (row) => row.orderCount, width: 10 },
      { header: '수주 금액(원)', value: (row) => row.orderAmount, width: 16 },
      { header: '출하 수량', value: (row) => row.shippedQuantity, width: 10 },
      { header: '출하 금액(원)', value: (row) => row.shippedAmount, width: 16 },
    ]

    const shipmentColumns: ExcelColumn<SalesReportShipmentRow>[] = [
      { header: '출하일', value: (row) => row.recordDate, width: 12 },
      { header: '주문서번호', value: (row) => row.orderNumber, width: 22 },
      { header: '고객사', value: (row) => row.customer, width: 18 },
      { header: '완제품명', value: (row) => row.productName, width: 26 },
      { header: '수량', value: (row) => row.quantity, width: 10 },
      { header: '판매단가(원)', value: (row) => row.unitPrice, width: 12 },
      { header: '금액(원)', value: (row) => row.amount, width: 14 },
    ]

    await downloadExcelSheets({
      fileName: `영업매출_${data.startDate}_${data.endDate}`,
      sheets: [
        {
          sheetName: '거래처별 요약',
          columns: customerColumns as ExcelColumn<unknown>[],
          rows: data.customers as unknown[],
        },
        {
          sheetName: '일별 추이',
          columns: dailyColumns as ExcelColumn<unknown>[],
          rows: data.daily as unknown[],
        },
        {
          sheetName: '출하 상세',
          columns: shipmentColumns as ExcelColumn<unknown>[],
          rows: data.shipments as unknown[],
        },
      ],
    })
  }

  function handlePdfDownload() {
    if (!data) return

    const trendRows = buildTrendRows(data.daily, period)
    const trendTitle = period === 'month' ? '월별 추이' : '주별 추이'

    exportReportPdf({
      title: '영업/매출 리포트',
      rangeLabel,
      stats: [
        { label: '수주 건수', value: `${formatCount(data.totalOrderCount)} 건`, sub: '주문일 기준' },
        { label: '수주 금액', value: `${formatCount(data.totalOrderAmount)} 원` },
        { label: '출하 수량', value: `${formatCount(data.totalShippedQuantity)} EA`, sub: '출하일 기준' },
        { label: '출하 금액', value: `${formatCount(data.totalShippedAmount)} 원` },
      ],
      tables: [
        {
          title: '거래처별 요약',
          columns: [
            { header: '고객사' },
            { header: '수주 건수', align: 'right' },
            { header: '수주 금액(원)', align: 'right' },
            { header: '출하 수량', align: 'right' },
            { header: '출하 금액(원)', align: 'right' },
          ],
          rows: data.customers.map((row) => [
            row.customer,
            `${formatCount(row.orderCount)}건`,
            formatCount(row.orderAmount),
            formatCount(row.shippedQuantity),
            formatCount(row.shippedAmount),
          ]),
        },
        {
          title: trendTitle,
          columns: [
            { header: period === 'month' ? '주' : '날짜' },
            { header: '수주 건수', align: 'right' },
            { header: '수주 금액(원)', align: 'right' },
            { header: '출하 수량', align: 'right' },
            { header: '출하 금액(원)', align: 'right' },
          ],
          rows: trendRows.map((row) => [
            `${row.label} (${row.subLabel})`,
            `${formatCount(row.orderCount)}건`,
            formatCount(row.orderAmount),
            formatCount(row.shippedQuantity),
            formatCount(row.shippedAmount),
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
            <StatCard label="수주 건수" value={`${formatCount(data.totalOrderCount)} 건`} sub="주문일 기준" />
            <StatCard label="수주 금액" value={`${formatCount(data.totalOrderAmount)} 원`} />
            <StatCard label="출하 수량" value={`${formatCount(data.totalShippedQuantity)} EA`} sub="출하일 기준" />
            <StatCard label="출하 금액" value={`${formatCount(data.totalShippedAmount)} 원`} />
          </div>

          {/* 거래처별 요약 */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">거래처별 요약</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      고객사
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      수주 건수
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      수주 금액
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      출하 수량
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      출하 금액
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers.length ? (
                    data.customers.map((row) => (
                      <tr key={row.customer} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-sm font-bold text-slate-900">{row.customer}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                          {formatCount(row.orderCount)}건
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                          {formatCount(row.orderAmount)} 원
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                          {formatCount(row.shippedQuantity)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                          {formatCount(row.shippedAmount)} 원
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-slate-100">
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                        기간 내 수주·출하 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 추이 차트: 출하 금액(막대) + 수주 금액(꺾은선) */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">
                {period === 'month' ? '월별 추이' : '주별 추이'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">출하 금액(막대) · 수주 금액(선) — 원</p>
            </div>
            <div className="px-4 py-4">
              <ReportBarChart
                rows={buildTrendRows(data.daily, period).map((row) => ({
                  label: row.label,
                  subLabel: row.subLabel,
                  수주금액: row.orderAmount,
                  출하금액: row.shippedAmount,
                }))}
                series={[
                  { key: '출하금액', label: '출하 금액', color: '#10b981' },
                  { key: '수주금액', label: '수주 금액', color: '#3b82f6', type: 'line' },
                ]}
                unit="원"
              />
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
