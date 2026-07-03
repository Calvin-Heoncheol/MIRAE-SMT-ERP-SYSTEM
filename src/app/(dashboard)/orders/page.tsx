import { OrdersListWorkspace } from '@/components/orders/orders-list-workspace'
import { fetchOrders } from '@/lib/orders/repository'

export default async function OrdersPage() {
  const result = await fetchOrders()
  return <OrdersListWorkspace result={result} />
}
