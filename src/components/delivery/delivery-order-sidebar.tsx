'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { StatusBadge } from '@/components/ui/status-badge'
import type { DeliveryAvailability, DeliveryInputFilter } from '@/lib/delivery/utils'
import {
  filterDeliveryOrdersByStatus,
  getDeliveryStatusLabel,
  getDeliveryStatusTone,
  resolveDeliveryAvailabilityForOrder,
} from '@/lib/delivery/utils'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import {
  formatProductionProductDisplay,
  getProgressPercent,
} from '@/lib/production-input/utils'
import {
  daysUntilYmd,
  formatDeliveryCountdown,
  getDeliveryUrgencyTone,
} from '@/lib/smt/plan/utils'

type DeliveryOrderSidebarProps = {
  orders: ProductionOrderLine[]
  availabilityByGroupId: Record<string, DeliveryAvailability>
  selectedKey: string
  search: string
  onSearchChange: (value: string) => void
  onSelect: (uiKey: string) => void
}

const ORDER_CARD_SLOT_PX = 112
const MIN_ORDER_PAGE_SIZE = 3
const MAX_ORDER_PAGE_SIZE = 10
const DEFAULT_ORDER_PAGE_SIZE = 6

const FILTER_OPTIONS: { value: DeliveryInputFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'shippable', label: '출하가능' },
  { value: 'partial', label: '부분출하' },
  { value: 'complete', label: '완료' },
  { value: 'blocked', label: '불가' },
]

const FILTER_TONES: Partial<
  Record<
    DeliveryInputFilter,
    (typeof STATUS_FILTER_TONES)[keyof typeof STATUS_FILTER_TONES] | {
      idleClassName: string
      activeClassName: string
      activeCountClassName: string
    }
  >
> = {
  shippable: STATUS_FILTER_TONES.progress,
  partial: {
    idleClassName: 'border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100',
    activeClassName: 'bg-sky-600 text-white shadow-sm',
    activeCountClassName: 'text-sky-100',
  },
  complete: STATUS_FILTER_TONES.done,
  blocked: {
    idleClassName: 'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
    activeClassName: 'bg-rose-700 text-white shadow-sm',
    activeCountClassName: 'text-rose-100',
  },
}

function statusBadgeClass(tone: ReturnType<typeof getDeliveryStatusTone>) {
  if (tone === 'complete') return 'bg-emerald-100 text-emerald-800'
  if (tone === 'shippable') return 'bg-amber-100 text-amber-800'
  if (tone === 'partial') return 'bg-sky-100 text-sky-800'
  return 'bg-rose-100 text-rose-800'
}

function statusAccentClass(tone: ReturnType<typeof getDeliveryStatusTone>) {
  if (tone === 'complete') return 'border-l-emerald-500'
  if (tone === 'shippable') return 'border-l-amber-500'
  if (tone === 'partial') return 'border-l-sky-500'
  return 'border-l-rose-400'
}

function progressBarClass(tone: ReturnType<typeof getDeliveryStatusTone>, complete: boolean) {
  if (complete) return 'bg-emerald-500'
  if (tone === 'shippable') return 'bg-amber-500'
  if (tone === 'partial') return 'bg-sky-500'
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

export function DeliveryOrderSidebar({
  orders,
  availabilityByGroupId,
  selectedKey,
  search,
  onSearchChange,
  onSelect,
}: DeliveryOrderSidebarProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [pageSize, setPageSize] = useState(DEFAULT_ORDER_PAGE_SIZE)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<DeliveryInputFilter>('all')

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

  const filterOptions = useMemo(
    () =>
      FILTER_OPTIONS.map((option) => ({
        ...option,
        count: filterDeliveryOrdersByStatus(orders, availabilityByGroupId, option.value).length,
        tone: FILTER_TONES[option.value],
      })),
    [orders, availabilityByGroupId],
  )

  const filteredOrders = useMemo(
    () => filterDeliveryOrdersByStatus(orders, availabilityByGroupId, statusFilter),
    [orders, availabilityByGroupId, statusFilter],
  )

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
        <FilterChipBar
          options={filterOptions}
          value={statusFilter}
          onChange={setStatusFilter}
        />
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
            const availability = resolveDeliveryAvailabilityForOrder(order, availabilityByGroupId)
            const tone = getDeliveryStatusTone(availability)
            const selected = selectedKey === order.uiKey
            const shipped = availability.shipped
            const target = Math.max(0, Math.floor(availability.targetQuantity || order.quantity))
            const shippable = availability.shippable
            const progress = getProgressPercent(shipped, target)
            const complete = target > 0 && shipped >= target
            const daysUntilDelivery = order.deliveryDate
              ? daysUntilYmd(todayYmdSeoul(), order.deliveryDate)
              : null
            const dueLabel = formatDeliveryCountdown(daysUntilDelivery)
            const { name: productName, version: productVersion } =
              formatProductionProductDisplay(order)

            return (
              <button
                key={order.uiKey}
                type="button"
                onClick={() => onSelect(order.uiKey)}
                aria-pressed={selected}
                className={[
                  'w-full shrink-0 rounded-lg border border-transparent border-l-4 px-3 py-2 text-left transition',
                  selected
                    ? 'border-sky-500 border-l-sky-500 bg-sky-50 ring-1 ring-sky-200'
                    : ['bg-white hover:bg-slate-50', statusAccentClass(tone)].join(' '),
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <StatusBadge
                      label={getDeliveryStatusLabel(availability)}
                      className={statusBadgeClass(tone)}
                    />
                    {dueLabel ? (
                      <StatusBadge
                        label={dueLabel}
                        className={urgencyBadgeClass(daysUntilDelivery)}
                      />
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[11px] font-bold text-slate-400 tabular-nums">
                    {progress}%
                  </span>
                </div>

                <p className="mt-1 truncate text-sm font-bold text-slate-900">
                  <span>{productName}</span>
                  {productVersion ? (
                    <span className="ml-1.5 font-semibold text-sky-600">{productVersion}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {order.customer || '—'} · {order.orderNumber}
                </p>

                <div className="mt-1.5">
                  <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-medium text-slate-500">
                    <span className="tabular-nums">
                      {shipped.toLocaleString('ko-KR')}
                      {target > 0 ? ` / ${target.toLocaleString('ko-KR')}` : ''}
                    </span>
                    <span>
                      가능{' '}
                      <span className="font-bold text-slate-700 tabular-nums">
                        {shippable.toLocaleString('ko-KR')}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${progressBarClass(tone, complete)}`}
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
    </aside>
  )
}
