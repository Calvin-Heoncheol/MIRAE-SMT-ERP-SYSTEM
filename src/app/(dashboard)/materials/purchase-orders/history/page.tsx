import { MaterialPurchaseOrdersWorkspace } from '@/components/materials/purchase-orders/material-purchase-orders-workspace'
import { fetchMaterialPurchaseOrderHistoryData } from '@/lib/materials/purchase-orders/repository'

export default async function MaterialPurchaseOrdersHistoryPage() {
  const result = await fetchMaterialPurchaseOrderHistoryData()
  return <MaterialPurchaseOrdersWorkspace result={result} view="history" />
}
