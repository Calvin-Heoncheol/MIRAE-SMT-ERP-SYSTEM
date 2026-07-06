import { MaterialPurchaseOrdersWorkspace } from '@/components/materials/purchase-orders/material-purchase-orders-workspace'
import { fetchMaterialPurchaseOrders } from '@/lib/materials/purchase-orders/repository'

export default async function MaterialPurchaseOrdersPage() {
  const result = await fetchMaterialPurchaseOrders()
  return <MaterialPurchaseOrdersWorkspace result={result} />
}
