import { ProductionHistoryWorkspace } from '@/components/production-history/production-history-workspace'
import { fetchProductionHistory } from '@/lib/production-history/repository'

export default async function ProductionHistoryPage() {
  const result = await fetchProductionHistory()
  return <ProductionHistoryWorkspace result={result} />
}
