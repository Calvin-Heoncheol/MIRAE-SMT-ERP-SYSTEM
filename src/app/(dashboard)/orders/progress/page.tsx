import { OrdersProgressWorkspace } from '@/components/orders/orders-progress-workspace'
import { fetchOrderProgressPageData } from '@/lib/orders/progress-repository'

export const dynamic = 'force-dynamic'

export default async function OrdersProgressPage() {
  const result = await fetchOrderProgressPageData()
  return <OrdersProgressWorkspace result={result} />
}
