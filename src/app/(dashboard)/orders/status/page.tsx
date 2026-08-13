import { OrdersStatusWorkspace } from '@/components/orders/orders-status-workspace'
import { fetchProductionStatusPageData } from '@/lib/production-status/repository'

export const dynamic = 'force-dynamic'

export default async function OrdersStatusPage() {
  const result = await fetchProductionStatusPageData()
  return <OrdersStatusWorkspace result={result} />
}
