import { ProductionStatusWorkspace } from '@/components/production-status/production-status-workspace'
import { fetchProductionStatusPageData } from '@/lib/production-status/repository'

export default async function ProductionStatusPage() {
  const result = await fetchProductionStatusPageData()
  return <ProductionStatusWorkspace result={result} />
}
