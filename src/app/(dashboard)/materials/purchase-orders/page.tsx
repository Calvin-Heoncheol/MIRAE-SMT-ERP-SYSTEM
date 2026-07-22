import { MaterialOrderPurchaseWorkspace } from '@/components/materials/purchase-orders/material-order-purchase-workspace'
import { fetchMaterialPurchaseOrderByOrderData } from '@/lib/materials/purchase-orders/repository'

export default async function MaterialPurchaseOrdersByOrderPage() {
  const result = await fetchMaterialPurchaseOrderByOrderData()
  return <MaterialOrderPurchaseWorkspace result={result} />
}
