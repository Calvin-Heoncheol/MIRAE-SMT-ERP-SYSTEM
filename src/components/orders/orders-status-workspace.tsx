'use client'

import { OrderStatusPanel } from '@/components/orders/order-status-panel'

export function OrdersStatusWorkspace() {
  return (
    <div className="flex min-h-[calc(100dvh-60px)] w-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">주문서 현황</h1>
      </div>
      <OrderStatusPanel />
    </div>
  )
}
