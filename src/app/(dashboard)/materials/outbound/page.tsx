import { OutboundWorkspace } from '@/components/materials/outbound/outbound-workspace'
import { fetchMaterialOutboundPageData } from '@/lib/materials/outbound/repository'

export default async function MaterialOutboundRegisterPage() {
  const result = await fetchMaterialOutboundPageData()
  return <OutboundWorkspace result={result} view="register" />
}
