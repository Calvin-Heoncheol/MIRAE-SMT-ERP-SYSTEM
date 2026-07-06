'use client'

import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductName, getProgressPercent } from '@/lib/production-input/utils'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import {
  DELIVERY_ORDER_PAGE_SIZE,
  getDeliveryOrderPrefix,
  getDeliveryOrderState,
} from '@/lib/delivery/utils'

type DeliveryOrderSidebarProps = {
  orders: ProductionOrderLine[]
  availabilityByGroupId: Record<string, DeliveryAvailability>
  selectedKey: string
  search: string
  page: number
  onSearchChange: (value: string) => void
  onSelect: (uiKey: string) => void
  onPageChange: (page: number) => void
}

function stateAccentClass(state: ReturnType<typeof getDeliveryOrderState>) {
  if (state === 'full') return 'border-l-violet-600'
  if (state === 'progress') return 'border-l-amber-500'
  return 'border-l-slate-300'
}

function progressBarClass(state: ReturnType<typeof getDeliveryOrderState>, complete: boolean) {
  if (complete) return 'bg-violet-600'
  if (state === 'progress') return 'bg-amber-500'
  return 'bg-slate-300'
}

export function DeliveryOrderSidebar({
  orders,
  availabilityByGroupId,
  selectedKey,
  search,
  page,
  onSearchChange,
  onSelect,
  onPageChange,
}: DeliveryOrderSidebarProps) {
  const totalPages = Math.max(1, Math.ceil(orders.length / DELIVERY_ORDER_PAGE_SIZE))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const startIdx = (currentPage - 1) * DELIVERY_ORDER_PAGE_SIZE
  const pageItems = orders.slice(startIdx, startIdx + DELIVERY_ORDER_PAGE_SIZE)
  const showPager = orders.length > DELIVERY_ORDER_PAGE_SIZE

  return (
    <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-slate-100">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <h4 className="text-sm font-bold text-slate-900">주문 선택</h4>
        <span className="text-xs font-medium text-slate-400 tabular-nums">{orders.length}건</span>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          ○ 대기
        </span>
        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          ◐ 진행중
        </span>
        <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
          ● 완료
        </span>
      </div>

      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="주문번호 · 고객사 · 제품명 검색"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {!pageItems.length ? (
          <p className="py-10 text-center text-sm text-slate-400">
            {search.trim() ? '검색 결과 없음' : '표시할 주문이 없습니다'}
          </p>
        ) : (
          pageItems.map((order) => {
            const groupId = order.assemblyGroupId || order.orderLineId
            const availability =
              availabilityByGroupId[groupId] ?? {
                targetQuantity: order.quantity,
                smtSets: 0,
                postProduced: 0,
                shipped: 0,
                productionCap: 0,
                shippable: 0,
              }
            const state = getDeliveryOrderState(availability)
            const selected = selectedKey === order.uiKey
            const shipped = availability.shipped
            const target = availability.targetQuantity
            const remaining = Math.max(0, target - shipped)
            const progress = getProgressPercent(shipped, target)
            const complete = target > 0 && shipped >= target

            return (
              <button
                key={order.uiKey}
                type="button"
                onClick={() => onSelect(order.uiKey)}
                className={[
                  'rounded-xl border border-slate-200 border-l-4 bg-white p-3 text-left transition',
                  stateAccentClass(state),
                  selected
                    ? 'border-violet-400 ring-2 ring-violet-100'
                    : 'hover:border-slate-300 hover:shadow-sm',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-slate-500">
                      {getDeliveryOrderPrefix(state)} {order.customer || '—'} · {order.orderNumber}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                      {formatProductionProductName(order)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-slate-400 tabular-nums">
                    {progress}%
                  </span>
                </div>

                <div className="mt-2.5">
                  <div className="mb-1 flex justify-between text-[11px] font-medium text-slate-500">
                    <span className="tabular-nums">
                      {shipped.toLocaleString('ko-KR')}
                      {target > 0 ? ` / ${target.toLocaleString('ko-KR')}` : ''}
                    </span>
                    <span>
                      남음{' '}
                      <span className="font-bold text-slate-700 tabular-nums">
                        {remaining.toLocaleString('ko-KR')}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${progressBarClass(state, complete)}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      {showPager ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-200 bg-white px-3 py-2.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>
          <span className="min-w-[72px] text-center text-xs font-medium text-slate-500 tabular-nums">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </div>
      ) : null}
    </aside>
  )
}
