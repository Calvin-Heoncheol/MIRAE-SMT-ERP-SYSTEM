import { fetchOrders } from '@/lib/orders/repository'
import { buildPostProcessOrderLines } from './utils'
import type { PostProcessPageData } from './types'

export type FetchPostProcessPageResult =
  | { ok: true; data: PostProcessPageData }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export async function fetchPostProcessPageData(): Promise<FetchPostProcessPageResult> {
  const ordersResult = await fetchOrders()
  if (!ordersResult.ok) {
    return ordersResult
  }

  return {
    ok: true,
    data: {
      orders: buildPostProcessOrderLines(ordersResult.orders),
      counts: {},
    },
  }
}
