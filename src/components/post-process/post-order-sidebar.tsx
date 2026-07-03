'use client'

import type { PostProcessOrderLine, PostProcessOrderState } from '@/lib/post-process/types'
import {
  formatPostProductName,
  getPostOrderPrefix,
  getPostOrderState,
  POST_ORDER_PAGE_SIZE,
} from '@/lib/post-process/utils'

type PostOrderSidebarProps = {
  orders: PostProcessOrderLine[]
  counts: Record<string, number>
  selectedKey: string
  search: string
  page: number
  onSearchChange: (value: string) => void
  onSelect: (uiKey: string) => void
  onPageChange: (page: number) => void
}

function cardStateClass(state: PostProcessOrderState, selected: boolean) {
  const base =
    state === 'full'
      ? 'border-emerald-300 bg-gradient-to-r from-emerald-600 from-[4px] to-[4px] to-emerald-50 text-emerald-950'
      : state === 'progress'
        ? 'border-amber-300 bg-gradient-to-r from-amber-600 from-[4px] to-[4px] to-amber-50 text-amber-950'
        : 'border-slate-300 bg-gradient-to-r from-slate-400 from-[4px] to-[4px] to-slate-50 text-slate-700'

  const selectedRing = selected ? 'border-sky-500 shadow-[inset_0_0_0_1px_#0284c7,0_0_0_2px_rgba(2,132,199,0.12)]' : ''
  return `${base} ${selectedRing}`
}

export function PostOrderSidebar({
  orders,
  counts,
  selectedKey,
  search,
  page,
  onSearchChange,
  onSelect,
  onPageChange,
}: PostOrderSidebarProps) {
  const totalPages = Math.max(1, Math.ceil(orders.length / POST_ORDER_PAGE_SIZE))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const startIdx = (currentPage - 1) * POST_ORDER_PAGE_SIZE
  const pageItems = orders.slice(startIdx, startIdx + POST_ORDER_PAGE_SIZE)
  const showPager = orders.length > POST_ORDER_PAGE_SIZE

  return (
    <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-slate-100">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-200/70 px-3.5 py-3">
        <h4 className="text-[15px] font-extrabold text-slate-900">주문 선택</h4>
      </div>

      <div className="flex flex-wrap gap-2.5 border-b border-slate-200 bg-slate-50 px-3.5 py-2 text-[10px] font-bold text-slate-500">
        <span>○ 대기</span>
        <span>◐ 진행중</span>
        <span>● 완료</span>
      </div>

      <div className="px-3 py-2.5">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="주문번호 · 고객사 · 제품명 검색"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-emerald-100 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto px-3 pb-2 content-start">
        {!pageItems.length ? (
          <p className="col-span-2 py-8 text-center text-xs text-slate-400">
            {search.trim() ? '검색 결과 없음' : '표시할 주문이 없습니다'}
          </p>
        ) : (
          pageItems.map((order) => {
            const state = getPostOrderState(order, counts)
            const selected = selectedKey === order.uiKey
            return (
              <button
                key={order.uiKey}
                type="button"
                onClick={() => onSelect(order.uiKey)}
                className={`rounded-[10px] border-2 p-2.5 text-left transition hover:brightness-[0.99] ${cardStateClass(state, selected)}`}
              >
                <div className="truncate text-xs font-extrabold">
                  {getPostOrderPrefix(state)} {order.customer || '—'}
                </div>
                <div className="mt-1 grid gap-0.5">
                  <div className="flex min-w-0 gap-1 text-[11px] leading-tight">
                    <span className="shrink-0 text-[9px] font-bold text-slate-400">주문</span>
                    <span className="min-w-0 truncate font-bold">{order.orderNumber || '—'}</span>
                  </div>
                  <div className="flex min-w-0 gap-1 text-[11px] leading-tight">
                    <span className="shrink-0 text-[9px] font-bold text-slate-400">제품</span>
                    <span className="line-clamp-2 min-w-0 font-bold break-words">
                      {formatPostProductName(order)}
                    </span>
                  </div>
                  <div className="flex min-w-0 gap-1 text-[11px] leading-tight">
                    <span className="shrink-0 text-[9px] font-bold text-slate-400">수량</span>
                    <span className="font-extrabold tabular-nums">
                      {order.quantity > 0 ? order.quantity.toLocaleString('ko-KR') : '—'}
                    </span>
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>

      {showPager ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>
          <span className="min-w-[72px] text-center text-xs font-bold text-slate-500 tabular-nums">
            {currentPage} / {totalPages} · {orders.length}건
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </div>
      ) : null}
    </aside>
  )
}
