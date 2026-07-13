import {
  ensureAssemblyGroupsForOrders,
  fetchAssemblyGroups,
} from '@/lib/assembly/repository'
import { fetchDeliveryCumulativeCounts } from '@/lib/delivery/repository'
import { excludeDeliveryCompleteProductionOrders } from '@/lib/delivery/utils'
import { fetchOrders } from '@/lib/orders/repository'
import { fetchProducts } from '@/lib/products/repository'
import { fetchPostProcessCumulativeCounts } from '@/lib/post-process/repository'
import { fetchSmtCumulativeCounts } from '@/lib/smt/repository'
import { buildPostProcessAssemblyLines, buildProductionOrderLines } from './utils'
import type { ProductionInputConfig, ProductionCounts, ProductionPageData } from './types'

export type FetchProductionInputPageResult =
  | { ok: true; data: ProductionPageData }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export async function fetchProductionInputPageData(
  config: Pick<ProductionInputConfig, 'productKindLabel' | 'productionModule'>,
): Promise<FetchProductionInputPageResult> {
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

  // Vercel 서버리스 타임아웃 방지: 조립 그룹 동기화가 길면 목록 조회를 막지 않음
  await Promise.race([
    ensureAssemblyGroupsForOrders(orderIds),
    new Promise<void>((resolve) => setTimeout(resolve, 6000)),
  ])

  let counts: ProductionCounts = {}

  if (config.productionModule === 'smt') {
    const [countsResult, smtOrdersResult, assemblyResult, deliveryCountsResult] = await Promise.all([
      fetchSmtCumulativeCounts(),
      fetchOrders({ includeDerivedLines: true }),
      fetchAssemblyGroups(productById),
      fetchDeliveryCumulativeCounts(),
    ])

    if (!countsResult.ok) {
      return countsResult
    }
    if (!smtOrdersResult.ok) {
      return smtOrdersResult
    }
    if (!assemblyResult.ok) {
      return assemblyResult
    }
    if (!deliveryCountsResult.ok) {
      return deliveryCountsResult
    }

    counts = countsResult.counts

    const orders = excludeDeliveryCompleteProductionOrders(
      buildProductionOrderLines(
        smtOrdersResult.orders,
        config.productKindLabel,
        productById,
        config.productionModule,
      ),
      assemblyResult.groups,
      deliveryCountsResult.counts,
    )

    return {
      ok: true,
      data: {
        orders,
        counts,
      },
    }
  }

  if (config.productionModule === 'post_process') {
    const [assemblyResult, countsResult, deliveryCountsResult] = await Promise.all([
      fetchAssemblyGroups(productById),
      fetchPostProcessCumulativeCounts(),
      fetchDeliveryCumulativeCounts(),
    ])

    if (!assemblyResult.ok) {
      return assemblyResult
    }
    if (!countsResult.ok) {
      return countsResult
    }
    if (!deliveryCountsResult.ok) {
      return deliveryCountsResult
    }

    const orders = excludeDeliveryCompleteProductionOrders(
      buildPostProcessAssemblyLines(
        assemblyResult.groups,
        ordersResult.orders,
        productById,
      ),
      assemblyResult.groups,
      deliveryCountsResult.counts,
    )

    return {
      ok: true,
      data: {
        orders,
        counts: countsResult.counts,
      },
    }
  }

  return {
    ok: true,
    data: {
      orders: buildProductionOrderLines(
        ordersResult.orders,
        config.productKindLabel,
        productById,
        config.productionModule,
      ),
      counts,
    },
  }
}
