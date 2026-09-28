import { ItemsWorkspace } from '@/components/items/items-workspace'
import { fetchBomLines } from '@/lib/bom/repository'
import { fetchItems } from '@/lib/items/repository'
import type { ItemCategory } from '@/lib/items/types'

export const dynamic = 'force-dynamic'

type MasterProductsPageProps = {
  searchParams?: Promise<{ category?: string | string[] }>
}

function parseCategory(raw: string | string[] | undefined): ItemCategory | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  const n = Number(value)
  if (n === 1 || n === 2 || n === 3 || n === 4) return n
  return null
}

export default async function MasterProductsPage({ searchParams }: MasterProductsPageProps) {
  const params = searchParams ? await searchParams : {}
  const [result, bomResult] = await Promise.all([fetchItems(false), fetchBomLines()])
  return (
    <ItemsWorkspace
      result={result}
      bomResult={bomResult}
      initialCategory={parseCategory(params.category)}
    />
  )
}
