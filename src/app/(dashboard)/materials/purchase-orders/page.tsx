import { MaterialPurchaseOrdersWorkspace } from '@/components/materials/purchase-orders/material-purchase-orders-workspace'
import { fetchMaterialPurchaseOrderRegisterData } from '@/lib/materials/purchase-orders/repository'

export default async function MaterialPurchaseOrdersRegisterPage() {
  const result = await fetchMaterialPurchaseOrderRegisterData()
  return <MaterialPurchaseOrdersWorkspace result={result} view="register" />
}
