import { ItemsWorkspace } from '@/components/items/items-workspace'
import { fetchItems } from '@/lib/items/repository'

export default async function MasterProductsPage() {
  const result = await fetchItems(false)
  return <ItemsWorkspace result={result} />
}
