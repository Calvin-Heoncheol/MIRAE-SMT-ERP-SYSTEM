import { InboundWorkspace } from '@/components/materials/inbound/inbound-workspace'
import { fetchMaterialInboundPageData } from '@/lib/materials/inbound/repository'

export default async function MaterialInboundRegisterPage() {
  const result = await fetchMaterialInboundPageData()
  return <InboundWorkspace result={result} view="register" />
}
