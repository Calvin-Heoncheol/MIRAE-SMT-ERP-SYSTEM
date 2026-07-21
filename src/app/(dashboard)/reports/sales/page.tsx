import { SalesReportWorkspace } from '@/components/reports/sales-report-workspace'
import { buildReportHrefs, resolveReportPeriod } from '@/lib/reports/period'
import { fetchSalesReportData } from '@/lib/reports/sales-report'

export const dynamic = 'force-dynamic'

type SalesReportPageProps = {
  searchParams?: Promise<{ period?: string | string[]; date?: string | string[] }>
}

export default async function SalesReportPage({ searchParams }: SalesReportPageProps) {
  const params = searchParams ? await searchParams : {}
  const resolved = resolveReportPeriod(params)
  const hrefs = buildReportHrefs('/reports/sales', resolved)

  const result = await fetchSalesReportData(resolved.startDate, resolved.endDate)

  return (
    <SalesReportWorkspace
      result={result}
      period={resolved.period}
      rangeLabel={resolved.rangeLabel}
      {...hrefs}
    />
  )
}
