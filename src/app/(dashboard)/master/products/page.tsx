import { ItemsWorkspace } from '@/components/items/items-workspace'
import { fetchItems } from '@/lib/items/repository'

export const dynamic = 'force-dynamic'

export default async function MasterProductsPage() {
  const result = await fetchItems(false)
  return <ItemsWorkspace result={result} />
}
