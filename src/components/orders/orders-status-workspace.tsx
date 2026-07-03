'use client'

import { OrderStatusPanel } from '@/components/orders/order-status-panel'

export function OrdersStatusWorkspace() {
  return (
    <div className="flex min-h-[calc(100vh-60px)] w-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">주문서 현황</h1>
        <p className="mt-1 text-sm text-slate-500">주문별 SMT·후공정·납품 진행 현황을 확인합니다.</p>
      </div>
      <OrderStatusPanel />
    </div>
  )
}
