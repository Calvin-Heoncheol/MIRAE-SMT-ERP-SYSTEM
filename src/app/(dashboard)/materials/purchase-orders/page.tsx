import { MaterialPurchaseOrdersListWorkspace } from '@/components/materials/purchase-orders/material-purchase-orders-list-workspace'
import { fetchMaterialPurchaseOrders } from '@/lib/materials/purchase-orders/repository'

export default async function MaterialPurchaseOrdersPage() {
  const result = await fetchMaterialPurchaseOrders()
  return <MaterialPurchaseOrdersListWorkspace result={result} />
}
