import {
  ensureAssemblyGroupsForOrders,
  fetchAssemblyGroups,
} from '@/lib/assembly/repository'
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

  await ensureAssemblyGroupsForOrders(orderIds)

  let counts: ProductionCounts = {}

  if (config.productionModule === 'smt') {
    const [countsResult, smtOrdersResult] = await Promise.all([
      fetchSmtCumulativeCounts(),
      fetchOrders({ includeDerivedLines: true }),
    ])

    if (!countsResult.ok) {
      return countsResult
    }
    if (!smtOrdersResult.ok) {
      return smtOrdersResult
    }

    counts = countsResult.counts

    return {
      ok: true,
      data: {
        orders: buildProductionOrderLines(
          smtOrdersResult.orders,
          config.productKindLabel,
          productById,
          config.productionModule,
        ),
        counts,
      },
    }
  }

  if (config.productionModule === 'post_process') {
    const [assemblyResult, countsResult] = await Promise.all([
      fetchAssemblyGroups(productById),
      fetchPostProcessCumulativeCounts(),
    ])

    if (!assemblyResult.ok) {
      return assemblyResult
    }
    if (!countsResult.ok) {
      return countsResult
    }

    return {
      ok: true,
      data: {
        orders: buildPostProcessAssemblyLines(
          assemblyResult.groups,
          ordersResult.orders,
          productById,
        ),
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
