'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { ProductionOrderLine, ProductionOrderState } from '@/lib/production-input/types'
import {
  formatProductionProductName,
  formatProductionSideProgressLabel,
  getProductionOrderPrefix,
  getProductionOrderState,
  getProgressPercent,
  resolveProductionCount,
} from '@/lib/production-input/utils'
import { SMT_PLAN_DRAG_MIME } from '@/lib/smt/plan/config'
import {
  daysUntilYmd,
  formatDeliveryCountdown,
  getDeliveryUrgencyTone,
} from '@/lib/smt/plan/utils'

type ProductionOrderSidebarProps = {
  orders: ProductionOrderLine[]
  counts: Record<string, number>
  selectedKey: string
  search: string
  onSearchChange: (value: string) => void
  onSelect: (uiKey: string) => void
  /** SMT 생산계획 — 캘린더로 드래그 */
  enableDrag?: boolean
  onDragOrder?: (orderId: string) => void
  footerHint?: string
}

/** 카드 + gap 대략 높이 — 컨테이너에 스크롤 없이 맞추기 위한 보수적 추정 */
const ORDER_CARD_SLOT_PX = 104
const MIN_ORDER_PAGE_SIZE = 3
const MAX_ORDER_PAGE_SIZE = 10
const DEFAULT_ORDER_PAGE_SIZE = 6

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

function urgencyBadgeClass(daysUntilDelivery: number | null) {
  const tone = getDeliveryUrgencyTone(daysUntilDelivery)
  if (tone === 'overdue') return 'bg-rose-100 text-rose-700'
  if (tone === 'urgent') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

function computePageSize(containerHeight: number) {
  if (containerHeight <= 0) return DEFAULT_ORDER_PAGE_SIZE
  return Math.min(
    MAX_ORDER_PAGE_SIZE,
    Math.max(MIN_ORDER_PAGE_SIZE, Math.floor(containerHeight / ORDER_CARD_SLOT_PX)),
  )
}

export function ProductionOrderSidebar({
  orders,
  counts,
  selectedKey,
  search,
  onSearchChange,
  onSelect,
  enableDrag = false,
  onDragOrder,
  footerHint,
}: ProductionOrderSidebarProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [pageSize, setPageSize] = useState(DEFAULT_ORDER_PAGE_SIZE)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const update = (height: number) => {
      setPageSize(computePageSize(height))
    }

    update(el.clientHeight)
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? el.clientHeight
      update(height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize) || 1)

  const prevOrdersLenRef = useRef(orders.length)
  const prevSearchRef = useRef(search)
  const prevPageSizeRef = useRef(pageSize)
  const prevSelectedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (prevOrdersLenRef.current !== orders.length || prevSearchRef.current !== search) {
      prevOrdersLenRef.current = orders.length
      prevSearchRef.current = search
      setPage(1)
    }
  }, [orders.length, search])

  useEffect(() => {
    if (prevPageSizeRef.current === pageSize) return
    const previousSize = prevPageSizeRef.current
    prevPageSizeRef.current = pageSize
    setPage((current) => {
      const startIndex = (current - 1) * previousSize
      return Math.max(1, Math.floor(startIndex / pageSize) + 1)
    })
  }, [pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  /** 초기 uiKey·선택 변경 시에만 해당 페이지로 이동 (목록 넘기기 UX 유지) */
  useEffect(() => {
    const prev = prevSelectedKeyRef.current
    const selectionChanged = prev !== selectedKey
    prevSelectedKeyRef.current = selectedKey
    if (prev !== null && !selectionChanged) return
    if (!selectedKey || !orders.length) return
    const index = orders.findIndex((order) => order.uiKey === selectedKey)
    if (index < 0) return
    setPage(Math.floor(index / pageSize) + 1)
  }, [selectedKey, orders, pageSize])

  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return orders.slice(start, start + pageSize)
  }, [orders, currentPage, pageSize])

  const showPager = orders.length > pageSize

  return (
    <aside className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden border-b border-slate-200 bg-white lg:w-[360px] lg:flex-none lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
        <h4 className="text-sm font-bold text-slate-900">주문 선택</h4>
        <span className="text-xs font-medium text-slate-400 tabular-nums">{orders.length}건</span>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1.5 border-b border-slate-100 px-3 py-2">
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

      <div className="shrink-0 border-b border-slate-100 px-3 py-2">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="주문번호 · 고객사 · 제품명 검색"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
      </div>

      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-2 py-2"
      >
        {!orders.length ? (
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
            const daysUntilDelivery = order.deliveryDate
              ? daysUntilYmd(todayYmdSeoul(), order.deliveryDate)
              : null
            const dueLabel = formatDeliveryCountdown(daysUntilDelivery)

            return (
              <button
                key={order.uiKey}
                type="button"
                draggable={enableDrag && Boolean(order.orderId)}
                onDragStart={(event) => {
                  if (!enableDrag || !order.orderId || !order.orderLineId) return
                  const payload = JSON.stringify({
                    kind: 'order',
                    orderId: order.orderId,
                    orderLineId: order.orderLineId,
                  })
                  event.dataTransfer.setData(SMT_PLAN_DRAG_MIME, payload)
                  event.dataTransfer.effectAllowed = 'move'
                  onDragOrder?.(order.orderId)
                }}
                onClick={() => onSelect(order.uiKey)}
                aria-pressed={selected}
                className={[
                  'w-full shrink-0 rounded-lg border border-transparent border-l-4 px-3 py-2 text-left transition',
                  enableDrag ? 'cursor-grab active:cursor-grabbing' : '',
                  selected
                    ? 'border-sky-500 border-l-sky-500 bg-sky-50 ring-1 ring-sky-200'
                    : ['bg-white hover:bg-slate-50', stateAccentClass(state)].join(' '),
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-[11px] text-slate-500">
                    {getProductionOrderPrefix(state)} {order.customer || '—'} · {order.orderNumber}
                  </p>
                  {dueLabel ? (
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${urgencyBadgeClass(daysUntilDelivery)}`}
                    >
                      {dueLabel}
                    </span>
                  ) : null}
                </div>

                <div className="mt-0.5 flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-bold text-slate-900">
                    {formatProductionProductName(order)}
                  </p>
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
        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-200 px-3 py-2.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전
          </button>
          <span className="min-w-[72px] text-center text-xs font-medium text-slate-500 tabular-nums">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
          </button>
        </div>
      ) : null}

      {footerHint ? (
        <p className="shrink-0 border-t border-slate-200 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          {footerHint}
        </p>
      ) : null}
    </aside>
  )
}
