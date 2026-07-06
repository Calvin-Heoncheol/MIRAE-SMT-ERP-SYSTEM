import { DeliveryInputWorkspace } from '@/components/delivery/delivery-input-workspace'
import { fetchDeliveryInputPageData } from '@/lib/delivery/repository'

export default async function DeliveryInputPage() {
  const result = await fetchDeliveryInputPageData()
  return <DeliveryInputWorkspace result={result} />
}
