import { fetchAssemblyGroups } from '@/lib/assembly/repository'
import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import {
  computeAssemblySmtSets,
  resolveSmtProducedForLine,
} from '@/lib/delivery/utils'
import { fetchDeliveryCumulativeCounts } from '@/lib/delivery/repository'
import { fetchItems } from '@/lib/items/repository'
import {
  ITEM_CATEGORY_LABELS,
  isFinishedItemCategory,
  isProductItemCategory,
  type Item,
  type ItemCategory,
} from '@/lib/items/types'
import { fetchPostProcessCumulativeCounts } from '@/lib/post-process/repository'
import { fetchProducts } from '@/lib/products/repository'
import type { Product } from '@/lib/products/types'
import { fetchSmtCumulativeCounts } from '@/lib/smt/repository'

export type ProductStockRow = {
  itemId: string
  itemName: string
  itemCategory: ItemCategory
  itemCategoryLabel: string
  processType: string
  producedQuantity: number
  shippedQuantity: number
  bomConsumedQuantity: number
  onHandQuantity: number
}

export type FetchProductStockResult =
  | { ok: true; rows: ProductStockRow[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

function addQty(map: Map<string, number>, key: string, qty: number) {
  if (!key || qty === 0) return
  map.set(key, (map.get(key) ?? 0) + qty)
}

/** 조립그룹 생산완료 수량 — 부모 품목 공정에 맞춤 */
function computeGroupProductionCap(
  group: OrderAssemblyGroup,
  smtCounts: Record<string, number>,
  postCounts: Record<string, number>,
  productById: Record<string, Product>,
) {
  const parent = productById[group.parentProductId]
  const processType = parent?.processType || ''
  const smtSets = computeAssemblySmtSets(group, smtCounts, productById)
  const postProduced = Math.max(0, Math.floor(Number(postCounts[group.id]) || 0))

  if (processType === 'smt') return smtSets
  if (processType === 'post') return postProduced
  return Math.min(smtSets, postProduced)
}

/** FG 자식 라인의 창고 입고(주로 SMT). 부모=자식 1:1 그룹은 부모 cap으로만 가산 */
function computeChildLineProduced(
  group: OrderAssemblyGroup,
  line: OrderAssemblyGroup['lines'][number],
  smtCounts: Record<string, number>,
  productById: Record<string, Product>,
) {
  if (group.parentProductId === line.childProductId) return 0

  const product = productById[line.childProductId]
  const processType = product?.processType || ''
  const smt = resolveSmtProducedForLine(
    line.orderLineId,
    product?.pcbSideMode ?? 'single',
    smtCounts,
  )

  if (processType === 'post') return 0
  return smt
}

export function aggregateProductStockMaps(input: {
  items: Item[]
  groups: OrderAssemblyGroup[]
  smtCounts: Record<string, number>
  postCounts: Record<string, number>
  deliveryCounts: Record<string, number>
  productById: Record<string, Product>
}) {
  const produced = new Map<string, number>()
  const shipped = new Map<string, number>()
  const bomConsumed = new Map<string, number>()

  const categoryById = new Map(input.items.map((item) => [item.id, item.itemCategory]))

  for (const group of input.groups) {
    const cap = computeGroupProductionCap(
      group,
      input.smtCounts,
      input.postCounts,
      input.productById,
    )
    const shippedQty = Math.max(0, Math.floor(Number(input.deliveryCounts[group.id]) || 0))
    const parentId = group.parentProductId

    addQty(produced, parentId, cap)
    addQty(shipped, parentId, shippedQty)

    const parentCategory = categoryById.get(parentId)
    const isFinishedParent =
      parentCategory != null
        ? isFinishedItemCategory(parentCategory)
        : input.productById[parentId]?.productKind === 'assembly'

    if (isFinishedParent) {
      for (const line of group.lines) {
        const per = Math.max(1, Math.floor(Number(line.quantityPer) || 1))
        addQty(bomConsumed, line.childProductId, shippedQty * per)
        addQty(
          produced,
          line.childProductId,
          computeChildLineProduced(group, line, input.smtCounts, input.productById),
        )
      }
    }
  }

  return { produced, shipped, bomConsumed }
}

export async function fetchProductStockRows(): Promise<FetchProductStockResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const [itemsResult, productsResult, smtResult, postResult, deliveryResult] = await Promise.all([
    fetchItems(true),
    fetchProducts(),
    fetchSmtCumulativeCounts(),
    fetchPostProcessCumulativeCounts(),
    fetchDeliveryCumulativeCounts(),
  ])

  if (!itemsResult.ok) return { ok: false, reason: itemsResult.reason, detail: itemsResult.detail }
  if (!productsResult.ok) {
    return { ok: false, reason: productsResult.reason, detail: productsResult.detail }
  }
  if (!smtResult.ok) return { ok: false, reason: smtResult.reason, detail: smtResult.detail }
  if (!postResult.ok) return { ok: false, reason: postResult.reason, detail: postResult.detail }
  if (!deliveryResult.ok) {
    return { ok: false, reason: deliveryResult.reason, detail: deliveryResult.detail }
  }

  const productById = Object.fromEntries(
    productsResult.products.map((product) => [product.id, product]),
  )

  const assemblyResult = await fetchAssemblyGroups(productById)
  if (!assemblyResult.ok) {
    return { ok: false, reason: assemblyResult.reason, detail: assemblyResult.detail }
  }

  const productItems = itemsResult.items.filter((item) => isProductItemCategory(item.itemCategory))

  const { produced, shipped, bomConsumed } = aggregateProductStockMaps({
    items: productItems,
    groups: assemblyResult.groups,
    smtCounts: smtResult.counts,
    postCounts: postResult.counts,
    deliveryCounts: deliveryResult.counts,
    productById,
  })

  const rows: ProductStockRow[] = productItems
    .map((item) => {
      const producedQuantity = produced.get(item.id) ?? 0
      const shippedQuantity = shipped.get(item.id) ?? 0
      const bomConsumedQuantity = bomConsumed.get(item.id) ?? 0
      const onHandQuantity = producedQuantity - shippedQuantity - bomConsumedQuantity
      return {
        itemId: item.id,
        itemName: item.name,
        itemCategory: item.itemCategory,
        itemCategoryLabel: ITEM_CATEGORY_LABELS[item.itemCategory],
        processType: item.processType,
        producedQuantity,
        shippedQuantity,
        bomConsumedQuantity,
        onHandQuantity,
      }
    })
    .sort((a, b) => {
      if (a.itemCategory !== b.itemCategory) return a.itemCategory - b.itemCategory
      return a.itemName.localeCompare(b.itemName, 'ko')
    })

  return { ok: true, rows }
}
