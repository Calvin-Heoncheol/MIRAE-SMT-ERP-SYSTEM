import { ProductionReportWorkspace } from '@/components/reports/production-report-workspace'
import { buildReportHrefs, resolveReportPeriod } from '@/lib/reports/period'
import { fetchProductionReportData } from '@/lib/reports/production-report'

export const dynamic = 'force-dynamic'

type ProductionReportPageProps = {
  searchParams?: Promise<{ period?: string | string[]; date?: string | string[] }>
}

export default async function ProductionReportPage({ searchParams }: ProductionReportPageProps) {
  const params = searchParams ? await searchParams : {}
  const resolved = resolveReportPeriod(params)
  const hrefs = buildReportHrefs('/reports/production', resolved)

  const result = await fetchProductionReportData(resolved.startDate, resolved.endDate)

  return (
    <ProductionReportWorkspace
      result={result}
      period={resolved.period}
      rangeLabel={resolved.rangeLabel}
      {...hrefs}
    />
  )
}
