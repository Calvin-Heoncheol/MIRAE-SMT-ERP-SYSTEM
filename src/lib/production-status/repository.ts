import { fetchAssemblyGroups, repairChildrenOnlyAssemblyGroups } from '@/lib/assembly/repository'
import { fetchDeliveryCumulativeCounts } from '@/lib/delivery/repository'
import {
  buildDeliveryAvailabilityMap,
  buildDeliveryInputOrders,
} from '@/lib/delivery/utils'
import { fetchOrders } from '@/lib/orders/repository'
import {
  buildPostProcessAssemblyLines,
  buildProductionOrderLines,
} from '@/lib/production-input/utils'
import { fetchProducts } from '@/lib/products/repository'
import { fetchPostProcessCumulativeCounts } from '@/lib/post-process/repository'
import { fetchSmtCumulativeCounts } from '@/lib/smt/repository'
import { buildProductionStatusLines } from './utils'
import type { ProductionStatusPageData } from './types'

export type FetchProductionStatusResult =
  | { ok: true; data: ProductionStatusPageData }
  | { ok: false; reason: 'env' | 'query'; detail: string }

/**
 * 조립그룹 전체 동기화(ensureAssemblyGroupsForOrders)는 페이지 로드에서 제외.
 * 주문 저장·출하 입력 시 동기화되며, 여기서 await 하면 TTFB가 급증함.
 * 단, 반제품→완제품으로 잘못 합쳐진 그룹만 소량 복구한다.
 */
export async function fetchProductionStatusPageData(): Promise<FetchProductionStatusResult> {
  const [
    ordersResult,
    productsResult,
    smtCountsResult,
    postCountsResult,
    deliveryCountsResult,
    smtOrdersResult,
  ] = await Promise.all([
    fetchOrders(),
    fetchProducts(),
    fetchSmtCumulativeCounts(),
    fetchPostProcessCumulativeCounts(),
    fetchDeliveryCumulativeCounts(),
    fetchOrders({ includeDerivedLines: true }),
  ])

  if (!ordersResult.ok) return ordersResult
  if (!productsResult.ok) return productsResult
  if (!smtCountsResult.ok) return smtCountsResult
  if (!postCountsResult.ok) return postCountsResult
  if (!deliveryCountsResult.ok) return deliveryCountsResult
  if (!smtOrdersResult.ok) return smtOrdersResult

  const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
  const smtOrders = buildProductionOrderLines(smtOrdersResult.orders, 'SMT', productById, 'smt')

  let assemblyResult = await fetchAssemblyGroups(productById)
  if (!assemblyResult.ok) {
    return assemblyResult
  }

  assemblyResult = await repairChildrenOnlyAssemblyGroups(
    assemblyResult.groups,
    ordersResult.orders,
    productById,
  )
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
      lines: buildProductionStatusLines(
        ordersResult.orders,
        smtOrders,
        assemblyResult.groups,
        smtCountsResult.counts,
        postCountsResult.counts,
        deliveryCountsResult.counts,
        smtCountsResult.defectCounts,
        postCountsResult.defectCounts,
      ),
      smtOrders,
      postOrders,
      deliveryOrders,
      smtCounts: smtCountsResult.counts,
      smtDefectCounts: smtCountsResult.defectCounts,
      postCounts: postCountsResult.counts,
      postDefectCounts: postCountsResult.defectCounts,
      deliveryCounts: deliveryCountsResult.counts,
      deliveryAvailabilityByGroupId,
    },
  }
}
