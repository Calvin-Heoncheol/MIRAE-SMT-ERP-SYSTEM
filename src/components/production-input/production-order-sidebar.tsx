'use client'

import type { ProductionOrderLine, ProductionOrderState } from '@/lib/production-input/types'
import {
  formatProductionProductName,
  formatProductionSideProgressLabel,
  getProductionOrderPrefix,
  getProductionOrderState,
  getProgressPercent,
  PRODUCTION_ORDER_PAGE_SIZE,
  resolveProductionCount,
} from '@/lib/production-input/utils'

type ProductionOrderSidebarProps = {
  orders: ProductionOrderLine[]
  counts: Record<string, number>
  selectedKey: string
  search: string
  page: number
  onSearchChange: (value: string) => void
  onSelect: (uiKey: string) => void
  onPageChange: (page: number) => void
}

function stateAccentClass(state: ProductionOrderState) {
  if (state === 'full') return 'border-l-emerald-500'
  if (state === 'progress') return 'border-l-amber-500'
  return 'border-l-slate-300'
}

function progressBarClass(state: ProductionOrderState, complete: boolean) {
  if (complete) return 'bg-emerald-500'
  if (state === 'progress') return 'bg-amber-500'
  return 'bg-slate-300'
}

export function ProductionOrderSidebar({
  orders,
  counts,
  selectedKey,
  search,
  page,
  onSearchChange,
  onSelect,
  onPageChange,
}: ProductionOrderSidebarProps) {
  const totalPages = Math.max(1, Math.ceil(orders.length / PRODUCTION_ORDER_PAGE_SIZE))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const startIdx = (currentPage - 1) * PRODUCTION_ORDER_PAGE_SIZE
  const pageItems = orders.slice(startIdx, startIdx + PRODUCTION_ORDER_PAGE_SIZE)
  const showPager = orders.length > PRODUCTION_ORDER_PAGE_SIZE

  return (
    <aside className="flex min-h-0 min-w-0 flex-col border-b border-slate-200 bg-slate-100 lg:border-b-0 lg:border-r">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
        <h4 className="text-sm font-bold text-slate-900">주문 선택</h4>
        <span className="text-xs font-medium text-slate-400 tabular-nums">{orders.length}건</span>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-slate-200 bg-white px-3 py-2">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          ○ 대기
        </span>
        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
          ◐ 진행중
        </span>
        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          ● 완료
        </span>
      </div>

      <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="주문번호 · 고객사 · 제품명 검색"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-2.5 py-2.5">
        {!pageItems.length ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {search.trim() ? '검색 결과 없음' : '표시할 주문이 없습니다'}
          </p>
        ) : (
          pageItems.map((order) => {
            const state = getProductionOrderState(order, counts)
            const selected = selectedKey === order.uiKey
            const cumulative = resolveProductionCount(order, counts)
            const target = Math.max(0, Math.floor(order.quantity))
            const progress = getProgressPercent(cumulative, target)
            const complete = target > 0 && cumulative >= target

            return (
              <button
                key={order.uiKey}
                type="button"
                onClick={() => onSelect(order.uiKey)}
                aria-pressed={selected}
                className={[
                  'shrink-0 rounded-xl bg-white px-3 py-2 text-left transition',
                  selected
                    ? 'border-2 border-sky-500 bg-sky-50 shadow-md ring-2 ring-sky-200'
                    : [
                        'border border-slate-200 border-l-4 hover:border-slate-300 hover:shadow-sm',
                        stateAccentClass(state),
                      ].join(' '),
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-slate-500">
                      {getProductionOrderPrefix(state)} {order.customer || '—'} · {order.orderNumber}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                      {formatProductionProductName(order)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-slate-400 tabular-nums">
                    {progress}%
                  </span>
                </div>

                <div className="mt-1.5">
                  <div className="mb-1 flex justify-between text-[11px] font-medium text-slate-500">
                    <span className="tabular-nums">
                      {formatProductionSideProgressLabel(order, counts)}
                      {target > 0 ? ` / ${target.toLocaleString('ko-KR')}` : ''}
                    </span>
                    <span>
                      {order.splitPcbSides ? '병목 남음 ' : '남음 '}
                      <span className="font-bold text-slate-700 tabular-nums">
                        {Math.max(0, target - cumulative).toLocaleString('ko-KR')}
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
