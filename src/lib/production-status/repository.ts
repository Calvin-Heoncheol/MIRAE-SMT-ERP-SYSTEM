import { fetchAssemblyGroups } from '@/lib/assembly/repository'
import { fetchDeliveryCumulativeCounts } from '@/lib/delivery/repository'
import {
  buildDeliveryAvailabilityMap,
  buildDeliveryInputOrders,
} from '@/lib/delivery/utils'
import { fetchOrders } from '@/lib/orders/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import {
  buildPostProcessAssemblyLines,
  buildProductionOrderLines,
} from '@/lib/production-input/utils'
import { fetchProducts } from '@/lib/products/repository'
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
    smtOrdersResult,
  ] = await Promise.all([
    fetchOrders(),
    fetchProducts(),
    fetchSmtCumulativeCounts(),
    fetchSmtTodayProduction(),
    fetchPostProcessCumulativeCounts(),
    fetchPostProcessTodayProduction(),
    fetchDeliveryCumulativeCounts(),
    fetchOrders({ includeDerivedLines: true }),
  ])

  if (!ordersResult.ok) return ordersResult
  if (!productsResult.ok) return productsResult
  if (!smtCountsResult.ok) return smtCountsResult
  if (!todaySmtResult.ok) return todaySmtResult
  if (!postCountsResult.ok) return postCountsResult
  if (!todayPostResult.ok) return todayPostResult
  if (!deliveryCountsResult.ok) return deliveryCountsResult
  if (!smtOrdersResult.ok) return smtOrdersResult

  const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
  const smtOrders = buildProductionOrderLines(smtOrdersResult.orders, 'SMT', productById, 'smt')

  const assemblyResult = await fetchAssemblyGroups(productById)
  if (!assemblyResult.ok) {
    return assemblyResult
  }

  const postOrders = buildPostProcessAssemblyLines(
    assemblyResult.groups,
    ordersResult.orders,
    productById,
  )
  const deliveryOrders = buildDeliveryInputOrders(
    assemblyResult.groups,
    ordersResult.orders,
    productById,
  )
  const deliveryAvailabilityByGroupId = buildDeliveryAvailabilityMap(
    assemblyResult.groups,
    smtCountsResult.counts,
    postCountsResult.counts,
    deliveryCountsResult.counts,
    productById,
  )

  return {
    ok: true,
    data: {
      todayDate: todayYmdSeoul(),
      todayStages: buildTodayProductionStages(todaySmtResult.rows, todayPostResult.rows),
      todaySmtRecords: todaySmtResult.rows,
      lines: buildProductionStatusLines(
        ordersResult.orders,
        smtOrders,
        assemblyResult.groups,
        smtCountsResult.counts,
        postCountsResult.counts,
        deliveryCountsResult.counts,
      ),
      smtOrders,
      postOrders,
      deliveryOrders,
      smtCounts: smtCountsResult.counts,
      postCounts: postCountsResult.counts,
      deliveryCounts: deliveryCountsResult.counts,
      deliveryAvailabilityByGroupId,
    },
  }
}
