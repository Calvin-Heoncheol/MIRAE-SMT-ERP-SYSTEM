import { MetalMasksWorkspace } from '@/components/smt/metal-masks-workspace'
import { fetchItems } from '@/lib/items/repository'
import { isSemiFinishedItemCategory } from '@/lib/items/types'
import { fetchMetalMaskAssets } from '@/lib/metal-masks/repository'

export default async function SmtMetalMasksPage() {
  const [result, itemsResult] = await Promise.all([fetchMetalMaskAssets(), fetchItems(true)])
  const semiFinishedItems =
    itemsResult.ok ? itemsResult.items.filter((item) => isSemiFinishedItemCategory(item.itemCategory)) : []

  return <MetalMasksWorkspace result={result} semiFinishedItems={semiFinishedItems} />
}
