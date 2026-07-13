import { BomWorkspace } from '@/components/bom/bom-workspace'
import { fetchBomLines } from '@/lib/bom/repository'
import { fetchItems } from '@/lib/items/repository'

export default async function MasterBomPage() {
  const [bomResult, itemsResult] = await Promise.all([fetchBomLines(), fetchItems(true)])
  return <BomWorkspace bomResult={bomResult} itemsResult={itemsResult} />
}
