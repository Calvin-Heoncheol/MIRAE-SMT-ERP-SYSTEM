import { OrdersListWorkspace } from '@/components/orders/orders-list-workspace'
import { fetchAssemblyGroups } from '@/lib/assembly/repository'
import { fetchDeliveryCumulativeCounts } from '@/lib/delivery/repository'
import { buildFullyShippedOrderIdSet } from '@/lib/delivery/utils'
import { fetchOrders } from '@/lib/orders/repository'

export default async function OrdersPage() {
  const [result, assemblyResult, deliveryCountsResult] = await Promise.all([
    fetchOrders(),
    fetchAssemblyGroups(),
    fetchDeliveryCumulativeCounts(),
  ])

  const completedOrderIds =
    assemblyResult.ok && deliveryCountsResult.ok
      ? [...buildFullyShippedOrderIdSet(assemblyResult.groups, deliveryCountsResult.counts)]
      : []

  return <OrdersListWorkspace result={result} completedOrderIds={completedOrderIds} />
}
