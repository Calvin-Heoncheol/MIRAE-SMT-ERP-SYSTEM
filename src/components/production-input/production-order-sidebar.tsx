'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { ProductionOrderLine, ProductionOrderState } from '@/lib/production-input/types'
import {
  formatProductionProductName,
  getProductionOrderState,
  getProgressPercent,
  resolveProductionCount,
  resolveProductionSideCount,
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

/** 카드 + gap 대략 높이 — 관리자(모니터·마우스)용 밀도 */
const ORDER_CARD_SLOT_PX = 112
const MIN_ORDER_PAGE_SIZE = 3
const MAX_ORDER_PAGE_SIZE = 10
const DEFAULT_ORDER_PAGE_SIZE = 6

type StatusFilter = 'all' | ProductionOrderState

function stateLabel(state: ProductionOrderState) {
  if (state === 'full') return '완료'
  if (state === 'progress') return '진행'
  return '대기'
}

function stateBadgeClass(state: ProductionOrderState) {
  if (state === 'full') return 'bg-emerald-50 text-emerald-700'
  if (state === 'progress') return 'bg-amber-50 text-amber-800'
  return 'bg-slate-100 text-slate-600'
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

function urgencyBadgeClass(daysUntilDelivery: number | null) {
  const tone = getDeliveryUrgencyTone(daysUntilDelivery)
  if (tone === 'overdue') return 'bg-rose-50 text-rose-700'
  if (tone === 'urgent') return 'bg-amber-50 text-amber-800'
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

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

  const statusCounts = useMemo(() => {
    let none = 0
    let progress = 0
    let full = 0
    for (const order of orders) {
      const state = getProductionOrderState(order, counts)
      if (state === 'full') full += 1
      else if (state === 'progress') progress += 1
      else none += 1
    }
    return { all: orders.length, none, progress, full }
  }, [orders, counts])

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders
    return orders.filter((order) => getProductionOrderState(order, counts) === statusFilter)
  }, [orders, counts, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize) || 1)

  const prevOrdersLenRef = useRef(orders.length)
  const prevSearchRef = useRef(search)
  const prevStatusFilterRef = useRef(statusFilter)
  const prevPageSizeRef = useRef(pageSize)
  const prevSelectedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (
      prevOrdersLenRef.current !== orders.length ||
      prevSearchRef.current !== search ||
      prevStatusFilterRef.current !== statusFilter
    ) {
      prevOrdersLenRef.current = orders.length
      prevSearchRef.current = search
      prevStatusFilterRef.current = statusFilter
      setPage(1)
    }
  }, [orders.length, search, statusFilter])

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
    if (!selectedKey || !filteredOrders.length) return
    const index = filteredOrders.findIndex((order) => order.uiKey === selectedKey)
    if (index < 0) return
    setPage(Math.floor(index / pageSize) + 1)
  }, [selectedKey, filteredOrders, pageSize])

  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredOrders.slice(start, start + pageSize)
  }, [filteredOrders, currentPage, pageSize])

  const showPager = filteredOrders.length > pageSize

  const statusChips: {
    key: StatusFilter
    label: string
    count: number
    idleClass: string
    activeClass: string
  }[] = [
    {
      key: 'all',
      label: '전체',
      count: statusCounts.all,
      idleClass: 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100',
      activeClass: 'bg-slate-800 text-white ring-1 ring-slate-800',
    },
    {
      key: 'none',
      label: '대기',
      count: statusCounts.none,
      idleClass: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-200/70',
      activeClass: 'bg-slate-600 text-white ring-1 ring-slate-600',
    },
    {
      key: 'progress',
      label: '진행',
      count: statusCounts.progress,
      idleClass: 'bg-amber-50 text-amber-800 ring-1 ring-amber-100 hover:bg-amber-100/80',
      activeClass: 'bg-amber-500 text-white ring-1 ring-amber-500',
    },
    {
      key: 'full',
      label: '완료',
      count: statusCounts.full,
      idleClass: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100/80',
      activeClass: 'bg-emerald-600 text-white ring-1 ring-emerald-600',
    },
  ]

  return (
    <aside className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden border-b border-slate-200 bg-white lg:w-[360px] lg:flex-none lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5">
        <h4 className="text-sm font-bold text-slate-900">주문 선택</h4>
        <span className="text-xs font-medium text-slate-400 tabular-nums">
          {filteredOrders.length.toLocaleString('ko-KR')}건
          {statusFilter !== 'all' ? ` / ${orders.length.toLocaleString('ko-KR')}` : ''}
        </span>
      </div>

      <div className="shrink-0 space-y-2 border-b border-slate-100 px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {statusChips.map((chip) => {
            const active = statusFilter === chip.key
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setStatusFilter(chip.key)}
                className={[
                  'rounded-md px-2.5 py-1 text-[11px] font-bold transition-colors',
                  active ? chip.activeClass : chip.idleClass,
                ].join(' ')}
              >
                {chip.label}{' '}
                <span className={active ? 'opacity-80' : 'opacity-70'}>
                  {chip.count.toLocaleString('ko-KR')}
                </span>
              </button>
            )
          })}
        </div>
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
        className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-2 py-2"
      >
        {!filteredOrders.length ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {search.trim() || statusFilter !== 'all'
              ? '검색·필터 결과 없음'
              : '표시할 주문이 없습니다'}
          </p>
        ) : (
          pageItems.map((order) => {
            const state = getProductionOrderState(order, counts)
            const selected = selectedKey === order.uiKey
            const cumulative = resolveProductionCount(order, counts)
            const target = Math.max(0, Math.floor(order.quantity))
            const progress = getProgressPercent(cumulative, target)
            const complete = target > 0 && cumulative >= target
            const remaining = Math.max(0, target - cumulative)
            const daysUntilDelivery = order.deliveryDate
              ? daysUntilYmd(todayYmdSeoul(), order.deliveryDate)
              : null
            const dueLabel = formatDeliveryCountdown(daysUntilDelivery)
            const topCount = order.splitPcbSides
              ? resolveProductionSideCount(order, counts, 'TOP')
              : 0
            const botCount = order.splitPcbSides
              ? resolveProductionSideCount(order, counts, 'BOT')
              : 0

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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${stateBadgeClass(state)}`}
                    >
                      {stateLabel(state)}
                    </span>
                    <span
                      className={[
                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold',
                        order.splitPcbSides
                          ? 'bg-sky-50 text-sky-700'
                          : 'bg-slate-100 text-slate-500',
                      ].join(' ')}
                    >
                      {order.splitPcbSides ? '양면' : '단면'}
                    </span>
                    {dueLabel ? (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${urgencyBadgeClass(daysUntilDelivery)}`}
                      >
                        {dueLabel}
                      </span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[11px] font-bold text-slate-400 tabular-nums">
                    {progress}%
                  </span>
                </div>

                <p className="mt-1 truncate text-sm font-bold text-slate-900">
                  {formatProductionProductName(order)}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {order.customer || '—'} · {order.orderNumber}
                </p>

                <div className="mt-1.5">
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
                    <span className="tabular-nums">
                      {order.splitPcbSides ? (
                        <>
                          TOP {topCount.toLocaleString('ko-KR')} · BOT{' '}
                          {botCount.toLocaleString('ko-KR')}
                          {target > 0 ? ` / ${target.toLocaleString('ko-KR')}` : ''}
                        </>
                      ) : (
                        <>
                          {cumulative.toLocaleString('ko-KR')}
                          {target > 0 ? ` / ${target.toLocaleString('ko-KR')}` : ''}
                        </>
                      )}
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
