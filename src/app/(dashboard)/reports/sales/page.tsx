import { redirect } from 'next/navigation'
import { SalesReportWorkspace } from '@/components/reports/sales-report-workspace'
import {
  currentMonthRange,
  hasMonthRangeParams,
  resolveMonthRangeFromUrl,
} from '@/lib/reports/period'
import { fetchSalesReportData } from '@/lib/reports/sales-report'

export const dynamic = 'force-dynamic'

type SalesReportPageProps = {
  searchParams?: Promise<{ start?: string | string[]; end?: string | string[] }>
}

export default async function SalesReportPage({ searchParams }: SalesReportPageProps) {
  const params = searchParams ? await searchParams : {}
  if (!hasMonthRangeParams(params)) {
    const { startDate, endDate } = currentMonthRange()
    redirect(`/reports/sales?start=${startDate}&end=${endDate}`)
  }

  const resolved = resolveMonthRangeFromUrl(params)
  const result = await fetchSalesReportData(resolved.startDate, resolved.endDate)

  return (
    <SalesReportWorkspace
      result={result}
      startDate={resolved.startDate}
      endDate={resolved.endDate}
      rangeLabel={resolved.rangeLabel}
    />
  )
}
