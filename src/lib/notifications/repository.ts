import { fetchAssemblyGroups } from '@/lib/assembly/repository'
import { fetchApprovals } from '@/lib/approvals/repository'
import { getApprovalCategory } from '@/lib/approvals/categories'
import { getSignoffProgress, getSignoffStatusLabel } from '@/lib/approvals/signoffs'
import type { AuthProfile } from '@/lib/auth/types'
import { fetchDeliveryCumulativeCounts } from '@/lib/delivery/repository'
import { fetchExpenseReports } from '@/lib/expense-reports/repository'
import { fetchLeaveRequests } from '@/lib/leave-requests/repository'
import { fetchOnHandByMaterialId } from '@/lib/materials/inventory/stock'
import { fetchMaterialPurchaseOrders } from '@/lib/materials/purchase-orders/repository'
import { fetchOrders } from '@/lib/orders/repository'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { fetchProducts } from '@/lib/products/repository'
import {
  buildDeliveryDueNotifications,
  buildNegativeStockNotification,
  buildPendingPurchaseNotification,
} from './ops-alerts'
import {
  notificationCategoriesForProfile,
  type AppNotification,
  type NotificationFeed,
} from './types'

const MAX_DOC_ALERTS = 6

function sortNotifications(items: AppNotification[]) {
  const toneRank = { danger: 0, warn: 1, info: 2 }
  return [...items].sort((a, b) => {
    const toneDiff = toneRank[a.tone] - toneRank[b.tone]
    if (toneDiff !== 0) return toneDiff
    return a.key.localeCompare(b.key)
  })
}

export async function fetchNotificationFeed(
  profile: AuthProfile | null,
): Promise<NotificationFeed> {
  const categories = new Set(
    notificationCategoriesForProfile({
      role: profile?.role ?? 'operator',
      department: profile?.department ?? null,
    }),
  )

  const today = todayYmdSeoul()
  const needOps =
    categories.has('delivery') || categories.has('stock') || categories.has('purchase')
  const needApprovals = categories.has('approval')
  const needExpense = categories.has('expense')
  const needLeave = categories.has('leave')

  const [
    ordersResult,
    productsResult,
    deliveryCountsResult,
    purchaseOrdersResult,
    onHandResult,
    approvalsResult,
    expenseResult,
    leaveResult,
  ] = await Promise.all([
    needOps ? fetchOrders() : Promise.resolve(null),
    needOps && categories.has('delivery') ? fetchProducts() : Promise.resolve(null),
    needOps && categories.has('delivery')
      ? fetchDeliveryCumulativeCounts()
      : Promise.resolve(null),
    categories.has('purchase') ? fetchMaterialPurchaseOrders() : Promise.resolve(null),
    categories.has('stock') ? fetchOnHandByMaterialId() : Promise.resolve(null),
    needApprovals ? fetchApprovals() : Promise.resolve(null),
    needExpense ? fetchExpenseReports() : Promise.resolve(null),
    needLeave ? fetchLeaveRequests() : Promise.resolve(null),
  ])

  const items: AppNotification[] = []

  if (categories.has('delivery') && ordersResult?.ok && deliveryCountsResult?.ok) {
    const productById = productsResult?.ok
      ? Object.fromEntries(productsResult.products.map((product) => [product.id, product]))
      : {}
    const assemblyResult = await fetchAssemblyGroups(productById)
    if (assemblyResult.ok) {
      items.push(
        ...buildDeliveryDueNotifications({
          today,
          orders: ordersResult.orders,
          assemblyGroups: assemblyResult.groups,
          deliveryCounts: deliveryCountsResult.counts,
        }),
      )
    }
  }

  if (categories.has('stock') && onHandResult?.ok) {
    let negative = 0
    for (const onHand of onHandResult.onHandByMaterialId.values()) {
      if (onHand < 0) negative += 1
    }
    const stockAlert = buildNegativeStockNotification(negative)
    if (stockAlert) items.push(stockAlert)
  }

  if (categories.has('purchase') && purchaseOrdersResult?.ok) {
    const pending = purchaseOrdersResult.orders.filter((order) =>
      order.items.some((item) => item.inboundQuantity < item.quantity),
    ).length
    const purchaseAlert = buildPendingPurchaseNotification(pending)
    if (purchaseAlert) items.push(purchaseAlert)
  }

  if (categories.has('approval') && approvalsResult?.ok) {
    const pending = approvalsResult.approvals
      .filter((doc) => !getSignoffProgress(doc.detailInfo.signoffs).isComplete)
      .slice(0, MAX_DOC_ALERTS)
    for (const doc of pending) {
      const category = getApprovalCategory(doc.category)
      items.push({
        key: `approval:${doc.id}`,
        category: 'approval',
        label: doc.subject.trim() || doc.docNumber,
        detail: `품의 · ${getSignoffStatusLabel(doc.detailInfo.signoffs)}`,
        href: category?.href ?? '/approvals',
        tone: 'warn',
      })
    }
  }

  if (categories.has('expense') && expenseResult?.ok) {
    const pending = expenseResult.reports
      .filter((doc) => !getSignoffProgress(doc.detailInfo.signoffs).isComplete)
      .slice(0, MAX_DOC_ALERTS)
    for (const doc of pending) {
      items.push({
        key: `expense:${doc.id}`,
        category: 'expense',
        label: (doc.processingDetails || doc.accountCategory || doc.docNumber).trim(),
        detail: `지출결의 · ${getSignoffStatusLabel(doc.detailInfo.signoffs)}`,
        href: '/expense-reports',
        tone: 'warn',
      })
    }
  }

  if (categories.has('leave') && leaveResult?.ok) {
    const pending = leaveResult.requests
      .filter((doc) => !getSignoffProgress(doc.detailInfo.signoffs).isComplete)
      .slice(0, MAX_DOC_ALERTS)
    for (const doc of pending) {
      items.push({
        key: `leave:${doc.id}`,
        category: 'leave',
        label: `${doc.author || '신청자'} · ${doc.docNumber}`,
        detail: `휴가원 · ${getSignoffStatusLabel(doc.detailInfo.signoffs)}`,
        href: '/leave-requests',
        tone: 'info',
      })
    }
  }

  return {
    items: sortNotifications(items),
    fetchedAt: new Date().toISOString(),
  }
}
