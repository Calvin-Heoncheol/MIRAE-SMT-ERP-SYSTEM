import type { OrderListGroup } from '@/lib/orders/types'
import type { PostProcessCounts, PostProcessOrderLine, PostProcessOrderState } from './types'

export const POST_ORDER_PAGE_SIZE = 8

export function buildPostProcessOrderLines(orders: OrderListGroup[]): PostProcessOrderLine[] {
  const lines: PostProcessOrderLine[] = []

  for (const order of orders) {
    order.items.forEach((item, index) => {
      const productName = item.productName.trim()
      const productCode = item.productCode.trim()
      if (!productName && !productCode) return

      const labelParts: string[] = []
      if (productName) labelParts.push(productName)
      if (productCode) labelParts.push(`[${productCode}]`)
      labelParts.push(`수량${item.quantity}`)
      labelParts.push(`단가${Math.round(item.unitPrice)}`)

      const productLabel = labelParts.join(' · ')
      const uiKey = `${order.orderNumber}\u001e${index}\u001e${lines.length}`
      const countKey = `${order.orderNumber}\u001f${productLabel}`

      lines.push({
        uiKey,
        countKey,
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        customer: order.customer,
        productCode,
        productName,
        productLabel,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineSeq: index,
        productKind: 'semi',
        productKindLabel: '반제품',
      })
    })
  }

  return lines
}

export function resolvePostCount(order: PostProcessOrderLine, counts: PostProcessCounts) {
  if (counts[order.countKey] != null) {
    return Math.max(0, Math.floor(Number(counts[order.countKey]) || 0))
  }
  return 0
}

export function getPostOrderState(order: PostProcessOrderLine, counts: PostProcessCounts): PostProcessOrderState {
  const total = Math.max(0, Math.floor(order.quantity))
  const cumulative = resolvePostCount(order, counts)
  if (cumulative <= 0) return 'none'
  if (total > 0 && cumulative >= total) return 'full'
  return 'progress'
}

export function getPostOrderPrefix(state: PostProcessOrderState) {
  if (state === 'full') return '●'
  if (state === 'progress') return '◐'
  return '○'
}

export function formatPostProductName(order: PostProcessOrderLine) {
  return order.productName.trim() || order.productCode.trim() || '—'
}

export function filterPostOrders(orders: PostProcessOrderLine[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return orders
  return orders.filter((order) => {
    const haystack = [
      order.orderNumber,
      order.customer,
      order.productName,
      order.productCode,
      order.productLabel,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function getProgressPercent(cumulative: number, target: number) {
  if (target <= 0) return 0
  return Math.min(100, Math.round((cumulative / target) * 100))
}
