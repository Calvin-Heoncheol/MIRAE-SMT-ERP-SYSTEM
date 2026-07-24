import { OrdersListWorkspace } from '@/components/orders/orders-list-workspace'
import { fetchAssemblyGroups } from '@/lib/assembly/repository'
import { fetchDeliveryCumulativeCounts } from '@/lib/delivery/repository'
import { buildFullyShippedOrderIdSet } from '@/lib/delivery/utils'
import { fetchOrders } from '@/lib/orders/repository'

type OrdersPageProps = {
  searchParams?: Promise<{ filter?: string | string[] }>
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = searchParams ? await searchParams : {}
  const filter = firstParam(params.filter)

  const [result, assemblyResult, deliveryCountsResult] = await Promise.all([
    fetchOrders(),
    fetchAssemblyGroups(),
    fetchDeliveryCumulativeCounts(),
  ])

  const completedOrderIds =
    assemblyResult.ok && deliveryCountsResult.ok
      ? [...buildFullyShippedOrderIdSet(assemblyResult.groups, deliveryCountsResult.counts)]
      : []

  return (
    <OrdersListWorkspace
      result={result}
      completedOrderIds={completedOrderIds}
      initialFilter={filter}
    />
  )
}
