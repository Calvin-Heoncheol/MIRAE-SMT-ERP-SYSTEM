import { OrdersListWorkspace } from '@/components/orders/orders-list-workspace'
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
  const result = await fetchOrders()

  return <OrdersListWorkspace result={result} initialFilter={filter} />
}
