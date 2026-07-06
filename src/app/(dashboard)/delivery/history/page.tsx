import { DeliveryHistoryWorkspace } from '@/components/delivery/delivery-history-workspace'
import { fetchDeliveryHistory } from '@/lib/delivery/repository'

export default async function DeliveryHistoryPage() {
  const result = await fetchDeliveryHistory()
  return <DeliveryHistoryWorkspace result={result} />
}
