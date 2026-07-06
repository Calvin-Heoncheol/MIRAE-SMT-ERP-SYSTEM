'use client'

import { useMemo, useState } from 'react'
import { SmtPlanOrderCard } from '@/components/smt/smt-plan-block'
import { SMT_PLAN_DRAG_MIME } from '@/lib/smt/plan/config'
import type { SmtPlanOrderCandidate } from '@/lib/smt/plan/types'

type SmtPlanUnassignedSidebarProps = {
  orders: SmtPlanOrderCandidate[]
  onDragOrder: (orderId: string) => void
}

export function SmtPlanUnassignedSidebar({ orders, onDragOrder }: SmtPlanUnassignedSidebarProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((order) =>
      [order.orderNumber, order.customer, order.productSummary].join(' ').toLowerCase().includes(q),
    )
  }, [orders, search])

  return (
    <aside className="flex min-h-0 w-full flex-col border-r border-slate-200 bg-slate-50 lg:w-[300px] lg:shrink-0">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-slate-900">미배정 주문</h4>
          <span className="text-xs font-medium text-slate-400 tabular-nums">{filtered.length}건</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">캘린더 칸으로 드래그해 일정을 배치하세요.</p>
      </div>

      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="주문서번호 · 고객사 · 제품 검색"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {!filtered.length ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
            <p className="text-sm font-semibold text-slate-700">미배정 주문이 없습니다</p>
            <p className="mt-1 text-xs text-slate-500">SMT 잔여 수량이 있는 주문만 표시됩니다.</p>
          </div>
        ) : (
          filtered.map((order) => (
            <div
              key={order.orderId}
              draggable
              onDragStart={(event) => {
                const payload = JSON.stringify({ kind: 'order', orderId: order.orderId })
                event.dataTransfer.setData(SMT_PLAN_DRAG_MIME, payload)
                event.dataTransfer.effectAllowed = 'move'
                onDragOrder(order.orderId)
              }}
              className="cursor-grab active:cursor-grabbing"
            >
              <SmtPlanOrderCard order={order} />
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
