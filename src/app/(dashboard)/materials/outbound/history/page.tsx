import { OutboundWorkspace } from '@/components/materials/outbound/outbound-workspace'
import { fetchMaterialOutboundPageData } from '@/lib/materials/outbound/repository'

export default async function MaterialOutboundHistoryPage() {
  const result = await fetchMaterialOutboundPageData()
  return <OutboundWorkspace result={result} view="history" />
}
