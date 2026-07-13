import { fetchAssemblyGroups } from '@/lib/assembly/repository'
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
  // 조립 그룹 동기화는 주문 저장/수정 시 수행. 탭 로드는 조회만 해서 Vercel 응답을 빠르게 유지.
  if (config.productionModule === 'smt') {
    const productsResult = await fetchProducts()
    if (!productsResult.ok) {
      return productsResult
    }

    const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))

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
        counts: countsResult.counts,
      },
    }
  }

  if (config.productionModule === 'post_process') {
    const [ordersResult, productsResult] = await Promise.all([fetchOrders(), fetchProducts()])

    if (!ordersResult.ok) {
      return ordersResult
    }
    if (!productsResult.ok) {
      return productsResult
    }

    const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))

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
      buildPostProcessAssemblyLines(assemblyResult.groups, ordersResult.orders, productById),
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

  const [ordersResult, productsResult] = await Promise.all([fetchOrders(), fetchProducts()])

  if (!ordersResult.ok) {
    return ordersResult
  }
  if (!productsResult.ok) {
    return productsResult
  }

  const productById = Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
  const counts: ProductionCounts = {}

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
