import { redirect } from 'next/navigation'
import { ReceivablesWorkspace } from '@/components/accounting/receivables-workspace'
import { fetchReceivablesPageData } from '@/lib/accounting/repository'
import {
  currentMonthRange,
  hasMonthRangeParams,
  resolveMonthRangeFromUrl,
} from '@/lib/reports/period'

export const dynamic = 'force-dynamic'

type ReceivablesPageProps = {
  searchParams?: Promise<{ start?: string | string[]; end?: string | string[] }>
}

export default async function ReceivablesPage({ searchParams }: ReceivablesPageProps) {
  const params = searchParams ? await searchParams : {}
  if (!hasMonthRangeParams(params)) {
    const { startDate, endDate } = currentMonthRange()
    redirect(`/accounting/receivables?start=${startDate}&end=${endDate}`)
  }

  const resolved = resolveMonthRangeFromUrl(params)
  const result = await fetchReceivablesPageData(resolved.startDate, resolved.endDate)

  return (
    <ReceivablesWorkspace
      result={result}
      startDate={resolved.startDate}
      endDate={resolved.endDate}
      rangeLabel={resolved.rangeLabel}
    />
  )
}
