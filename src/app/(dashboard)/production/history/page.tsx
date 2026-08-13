import { ProductionHistoryWorkspace } from '@/components/production-history/production-history-workspace'
import { fetchProductionHistory } from '@/lib/production-history/repository'
import { isProductionHistoryTeam } from '@/lib/production-history/types'

type ProductionHistoryPageProps = {
  searchParams?: Promise<{ team?: string | string[] }>
}

export default async function ProductionHistoryPage({ searchParams }: ProductionHistoryPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawTeam = params.team
  const team = Array.isArray(rawTeam) ? rawTeam[0] : rawTeam
  const initialTeamFilter = team && isProductionHistoryTeam(team) ? team : 'all'
  const result = await fetchProductionHistory()
  return <ProductionHistoryWorkspace result={result} initialTeamFilter={initialTeamFilter} />
}
