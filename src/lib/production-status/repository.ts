import { fetchAssemblyGroups } from '@/lib/assembly/repository'
import { fetchOrders } from '@/lib/orders/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { buildProductionOrderLines } from '@/lib/production-input/utils'
import { fetchProducts } from '@/lib/products/repository'
import { fetchDeliveryCumulativeCounts, fetchDeliveryTodayRecords } from '@/lib/delivery/repository'
import { fetchPostProcessCumulativeCounts, fetchPostProcessTodayProduction } from '@/lib/post-process/repository'
import { fetchSmtCumulativeCounts, fetchSmtTodayProduction } from '@/lib/smt/repository'
import { buildProductionStatusLines, buildTodayProductionStages } from './utils'
import type { ProductionStatusPageData } from './types'

export type FetchProductionStatusResult =
  | { ok: true; data: ProductionStatusPageData }
  | { ok: false; reason: 'env' | 'query'; detail: string }

/**
 * 조립그룹 동기화(ensureAssemblyGroupsForOrders)는 페이지 로드에서 제외.
 * 주문 저장·출하 입력 시 동기화되며, 여기서 await 하면 TTFB가 급증함.
 */
export async function fetchProductionStatusPageData(): Promise<FetchProductionStatusResult> {
  const [
    ordersResult,
    productsResult,
    smtCountsResult,
    todaySmtResult,
    postCountsResult,
    todayPostResult,
    deliveryCountsResult,
    todayDeliveryResult,
    smtOrdersResult,
  ] = await Promise.all([
    fetchOrders(),
    fetchProducts(),
    fetchSmtCumulativeCounts(),
    fetchSmtTodayProduction(),
    fetchPostProcessCumulativeCounts(),
    fetchPostProcessTodayProduction(),
    fetchDeliveryCumulativeCounts(),
    fetchDeliveryTodayRecords(),
    fetchOrders({ includeDerivedLines: true }),
  ])

  if (!ordersResult.ok) return ordersResult
  if (!productsResult.ok) return productsResult
  if (!smtCountsResult.ok) return smtCountsResult
  if (!todaySmtResult.ok) return todaySmtResult
  if (!postCountsResult.ok) return postCountsResult
  if (!todayPostResult.ok) return todayPostResult
  if (!deliveryCountsResult.ok) return deliveryCountsResult
  if (!todayDeliveryResult.ok) return todayDeliveryResult
  if (!smtOrdersResult.ok) return smtOrdersResult

  const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
  const smtLines = buildProductionOrderLines(smtOrdersResult.orders, 'SMT', productById, 'smt')

  const assemblyResult = await fetchAssemblyGroups(productById)
  if (!assemblyResult.ok) {
    return assemblyResult
  }

  return {
    ok: true,
    data: {
      todayDate: todayYmdSeoul(),
      todayStages: buildTodayProductionStages(todaySmtResult.rows, todayPostResult.rows),
      todaySmtRecords: todaySmtResult.rows,
      lines: buildProductionStatusLines(
        ordersResult.orders,
        smtLines,
        assemblyResult.groups,
        smtCountsResult.counts,
        postCountsResult.counts,
        deliveryCountsResult.counts,
      ),
    },
  }
}
