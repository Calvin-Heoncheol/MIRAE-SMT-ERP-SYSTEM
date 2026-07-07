import { InboundWorkspace } from '@/components/materials/inbound/inbound-workspace'
import { fetchMaterialInboundPageData } from '@/lib/materials/inbound/repository'

export default async function MaterialInventoryInboundPage() {
  const result = await fetchMaterialInboundPageData()
  return <InboundWorkspace result={result} />
}
