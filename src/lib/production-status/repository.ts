import {
  ensureAssemblyGroupsForOrders,
  fetchAssemblyGroups,
} from '@/lib/assembly/repository'
import { fetchOrders } from '@/lib/orders/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { buildProductionOrderLines } from '@/lib/production-input/utils'
import { fetchProducts } from '@/lib/products/repository'
import { fetchPostProcessCumulativeCounts, fetchPostProcessTodayProduction } from '@/lib/post-process/repository'
import { fetchSmtCumulativeCounts, fetchSmtTodayProduction } from '@/lib/smt/repository'
import { buildProductionStatusLines, buildTodayProductionStages } from './utils'
import type { ProductionStatusPageData } from './types'

export type FetchProductionStatusResult =
  | { ok: true; data: ProductionStatusPageData }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export async function fetchProductionStatusPageData(): Promise<FetchProductionStatusResult> {
  const ordersResult = await fetchOrders()
  if (!ordersResult.ok) {
    return ordersResult
  }

  const productsResult = await fetchProducts()
  if (!productsResult.ok) {
    return productsResult
  }

  const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
  const orderIds = ordersResult.orders.map((order) => order.orderId)

  await ensureAssemblyGroupsForOrders(orderIds)

  const [smtCountsResult, todaySmtResult, postCountsResult, todayPostResult, smtOrdersResult] =
    await Promise.all([
      fetchSmtCumulativeCounts(),
      fetchSmtTodayProduction(),
      fetchPostProcessCumulativeCounts(),
      fetchPostProcessTodayProduction(),
      fetchOrders({ includeDerivedLines: true }),
    ])

  if (!smtCountsResult.ok) {
    return smtCountsResult
  }
  if (!todaySmtResult.ok) {
    return todaySmtResult
  }
  if (!postCountsResult.ok) {
    return postCountsResult
  }
  if (!todayPostResult.ok) {
    return todayPostResult
  }
  if (!smtOrdersResult.ok) {
    return smtOrdersResult
  }

  const smtLines = buildProductionOrderLines(smtOrdersResult.orders, 'SMT', productById, 'smt')

  const assemblyResult = await fetchAssemblyGroups(productById)
  if (!assemblyResult.ok) {
    return assemblyResult
  }

  const smtCounts = smtCountsResult.counts
  const postCounts = postCountsResult.counts
  const shipCounts: Record<string, number> = {}
  const todaySmtRecords = todaySmtResult.rows
  const todayPostRecords = todayPostResult.rows

  return {
    ok: true,
    data: {
      todayDate: todayYmdSeoul(),
      todayStages: buildTodayProductionStages(todaySmtRecords, todayPostRecords),
      todaySmtRecords,
      lines: buildProductionStatusLines(
        smtLines,
        assemblyResult.groups,
        smtCounts,
        postCounts,
        shipCounts,
      ),
    },
  }
}
