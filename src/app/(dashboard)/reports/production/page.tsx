import { redirect } from 'next/navigation'

type ProductionReportPageProps = {
  searchParams?: Promise<{ period?: string | string[]; date?: string | string[] }>
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function ProductionReportPage({ searchParams }: ProductionReportPageProps) {
  const params = searchParams ? await searchParams : {}
  const query = new URLSearchParams()
  const period = firstParam(params.period)
  const date = firstParam(params.date)
  if (period) query.set('period', period)
  if (date) query.set('date', date)
  const qs = query.toString()
  redirect(qs ? `/production/performance?${qs}` : '/production/performance')
}
