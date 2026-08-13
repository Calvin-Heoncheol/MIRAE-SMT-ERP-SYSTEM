import { InventoryStatusWorkspace } from '@/components/materials/inventory/inventory-status-workspace'
import { fetchMaterialInventoryStatus } from '@/lib/materials/inventory/repository'

export default async function MaterialInventoryStatusPage() {
  const result = await fetchMaterialInventoryStatus()
  return <InventoryStatusWorkspace result={result} />
}
