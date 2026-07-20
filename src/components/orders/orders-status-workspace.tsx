'use client'

import { OrderStatusPanel } from '@/components/orders/order-status-panel'
import { PageShell } from '@/components/ui/page-shell'

export function OrdersStatusWorkspace() {
  return (
    <PageShell>
      <OrderStatusPanel />
    </PageShell>
  )
}
