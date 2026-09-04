'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { StatusBadge } from '@/components/ui/status-badge'
import { displayOrderPoNumber, todayYmdSeoul } from '@/lib/orders/utils'
import type { ProductionOrderLine, ProductionOrderState } from '@/lib/production-input/types'
import {
  formatProductionProductDisplay,
  getProductionOrderState,
  getProgressPercent,
  resolveProductionCount,
  resolveProductionSideCount,
} from '@/lib/production-input/utils'
import { formatProductPcbSideModeLabel } from '@/lib/products/utils'
import { SMT_PLAN_DRAG_MIME } from '@/lib/smt/plan/config'
import {
  daysUntilYmd,
  formatDeliveryCountdown,
  getDeliveryUrgencyTone,
} from '@/lib/smt/plan/utils'
import type { MaterialManualOrderMetrics } from '@/lib/materials/manual/types'
import {
  getMaterialInboundState,
  materialInboundFilterLabel,
  materialInboundProgressPercent,
  materialOutboundProgressPercent,
  countMaterialInboundStates,
  filterOrdersByMaterialInbound,
  resolveMaterialInboundSets,
  type MaterialInboundFilter,
  type MaterialInboundState,
} from '@/lib/materials/manual/utils'

type ProductionOrderSidebarProps = {
  orders: ProductionOrderLine[]
  counts: Record<string, number>
  selectedKey: string
  search: string
  onSearchChange: (value: string) => void
  onSelect: (uiKey: string) => void
  /** 발주 라인별 입고·출고(세트) — 있으면 자재 입고/출고 카드 UI */
  materialMetricsByLineId?: Record<string, MaterialManualOrderMetrics>
  /** rail: 좁은 사이드 / board: 전체폭 카드 그리드(등록 모달용) */
  variant?: 'rail' | 'board'
  /** SMT 생산계획 — 캘린더로 드래그 */
  enableDrag?: boolean
  onDragOrder?: (orderId: string) => void
  footerHint?: string
}

/** 카드 + gap 대략 높이 — 2줄 메타 카드 기준 (rail) */
const ORDER_CARD_SLOT_PX = 124
/** 카드 + gap — 자재 입·출고 2줄 그래프 (rail) */
const MATERIAL_ORDER_CARD_SLOT_PX = 156
const MIN_ORDER_PAGE_SIZE = 3
const MAX_ORDER_PAGE_SIZE = 10
const DEFAULT_ORDER_PAGE_SIZE = 6
/** board: 큰 카드 + gap-3, 2열 */
const BOARD_CARD_SLOT_PX = 156
const BOARD_MIN_PAGE_SIZE = 2
const BOARD_MAX_PAGE_SIZE = 15
const BOARD_DEFAULT_PAGE_SIZE = 6
const BOARD_SM_BREAKPOINT_PX = 640
const BOARD_LG_BREAKPOINT_PX = 1024

type StatusFilter = 'all' | ProductionOrderState
type SidebarStatusFilter = StatusFilter | MaterialInboundFilter

function materialStateBadgeClass(state: MaterialInboundState) {
  if (state === 'full') return 'bg-emerald-100 text-emerald-800'
  if (state === 'partial') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-700'
}

function materialStateAccentClass(state: MaterialInboundState) {
  if (state === 'full') return 'border-l-emerald-500'
  if (state === 'partial') return 'border-l-amber-500'
  return 'border-l-slate-300'
}

function materialProgressBarClass(state: MaterialInboundState, complete: boolean) {
  if (complete) return 'bg-emerald-500'
  if (state === 'partial') return 'bg-amber-500'
  return 'bg-slate-300'
}

function materialOutboundProgressBarClass(outboundSets: number, inboundSets: number) {
  const inbound = Math.max(0, Math.floor(inboundSets))
  const outbound = Math.max(0, Math.floor(outboundSets))
  if (inbound <= 0 || outbound <= 0) return 'bg-slate-300'
  if (outbound >= inbound) return 'bg-sky-500'
  return 'bg-sky-400'
}

function stateLabel(state: ProductionOrderState) {
  if (state === 'full') return '완료'
  if (state === 'progress') return '진행'
  return '대기'
}

function stateBadgeClass(state: ProductionOrderState) {
  if (state === 'full') return 'bg-emerald-100 text-emerald-800'
  if (state === 'progress') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-700'
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

function computePageSize(containerHeight: number, materialMode = false) {
  if (containerHeight <= 0) return DEFAULT_ORDER_PAGE_SIZE
  const slot = materialMode ? MATERIAL_ORDER_CARD_SLOT_PX : ORDER_CARD_SLOT_PX
  return Math.min(
    MAX_ORDER_PAGE_SIZE,
    Math.max(MIN_ORDER_PAGE_SIZE, Math.floor(containerHeight / slot)),
  )
}

function boardColumnCount(containerWidth: number) {
  if (containerWidth >= BOARD_LG_BREAKPOINT_PX) return 3
  if (containerWidth >= BOARD_SM_BREAKPOINT_PX) return 2
  return 1
}

function computeBoardPageSize(containerHeight: number, containerWidth: number) {
  if (containerHeight <= 0) return BOARD_DEFAULT_PAGE_SIZE
  const columns = boardColumnCount(containerWidth)
  const rows = Math.max(1, Math.floor(containerHeight / BOARD_CARD_SLOT_PX))
  return Math.min(
    BOARD_MAX_PAGE_SIZE,
    Math.max(BOARD_MIN_PAGE_SIZE, rows * columns),
  )
}

export function ProductionOrderSidebar({
  orders,
  counts,
  selectedKey,
  search,
  onSearchChange,
  onSelect,
  variant = 'rail',
  enableDrag = false,
  onDragOrder,
  footerHint,
  materialMetricsByLineId,
}: ProductionOrderSidebarProps) {
  const isBoard = variant === 'board'
  const isMaterialInboundMode = materialMetricsByLineId != null
  const inboundMetricsByLineId = useMemo(() => {
    if (!materialMetricsByLineId) return null
    return Object.fromEntries(
      Object.entries(materialMetricsByLineId).map(([lineId, metrics]) => [
        lineId,
        metrics.inboundSets,
      ]),
    )
  }, [materialMetricsByLineId])
  const listRef = useRef<HTMLDivElement>(null)
  const [pageSize, setPageSize] = useState(
    isBoard ? BOARD_DEFAULT_PAGE_SIZE : DEFAULT_ORDER_PAGE_SIZE,
  )
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<SidebarStatusFilter>('all')

  useEffect(() => {
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const update = (height: number, width: number) => {
      setPageSize(
        isBoard
          ? computeBoardPageSize(height, width)
          : computePageSize(height, isMaterialInboundMode),
      )
    }

    update(el.clientHeight, el.clientWidth)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      const height = entry?.contentRect.height ?? el.clientHeight
      const width = entry?.contentRect.width ?? el.clientWidth
      update(height, width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isBoard, isMaterialInboundMode])

  const statusCounts = useMemo(() => {
    if (isMaterialInboundMode && inboundMetricsByLineId) {
      return countMaterialInboundStates(orders, inboundMetricsByLineId)
    }
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
  }, [orders, counts, isMaterialInboundMode, inboundMetricsByLineId])

  const filteredOrders = useMemo(() => {
    if (isMaterialInboundMode && inboundMetricsByLineId) {
      return filterOrdersByMaterialInbound(
        orders,
        statusFilter as MaterialInboundFilter,
        inboundMetricsByLineId,
      )
    }
    if (statusFilter === 'all') return orders
    return orders.filter((order) => getProductionOrderState(order, counts) === statusFilter)
  }, [orders, counts, statusFilter, isMaterialInboundMode, inboundMetricsByLineId])

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

  const statusChips = isMaterialInboundMode
    ? [
        { value: 'all' as const, label: '전체', count: statusCounts.all },
        {
          value: 'none' as const,
          label: '미입고',
          count: statusCounts.none,
          tone: STATUS_FILTER_TONES.waiting,
        },
        {
          value: 'partial' as const,
          label: '일부입고',
          count: statusCounts.partial,
          tone: STATUS_FILTER_TONES.progress,
        },
        {
          value: 'full' as const,
          label: '입고완료',
          count: statusCounts.full,
          tone: STATUS_FILTER_TONES.done,
        },
      ]
    : [
        { value: 'all' as const, label: '전체', count: statusCounts.all },
        {
          value: 'none' as const,
          label: '대기',
          count: statusCounts.none,
          tone: STATUS_FILTER_TONES.waiting,
        },
        {
          value: 'progress' as const,
          label: '진행',
          count: statusCounts.progress,
          tone: STATUS_FILTER_TONES.progress,
        },
        {
          value: 'full' as const,
          label: '완료',
          count: statusCounts.full,
          tone: STATUS_FILTER_TONES.done,
        },
      ]

  return (
    <aside
      className={
        isBoard
          ? 'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-white'
          : 'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden border-b border-slate-200 bg-white lg:w-[360px] lg:flex-none lg:shrink-0 lg:border-b-0 lg:border-r'
      }
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4">
        <h4 className="text-sm font-bold text-slate-900">
          {isBoard ? '발주서 선택 · 카드를 누르면 생산 등록' : '발주서 선택'}
        </h4>
        <span className="text-xs font-medium text-slate-400 tabular-nums">
          {filteredOrders.length.toLocaleString('ko-KR')}건
          {statusFilter !== 'all' ? ` / ${orders.length.toLocaleString('ko-KR')}` : ''}
        </span>
      </div>

      <div className="shrink-0 space-y-2 border-b border-slate-100 px-3 py-2 sm:px-4">
        <FilterChipBar
          options={statusChips}
          value={statusFilter}
          onChange={setStatusFilter}
        />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="발주번호, 품목코드, 품목명, 고객사 검색…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
      </div>

      <div
        ref={listRef}
        className={
          isBoard
            ? 'min-h-0 flex-1 overflow-hidden px-3 py-3 sm:px-4'
            : 'flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-2 py-2'
        }
      >
        {!filteredOrders.length ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {search.trim() || statusFilter !== 'all'
              ? '검색·필터 결과 없음'
              : isMaterialInboundMode
                ? '표시할 발주가 없습니다'
                : '표시할 발주서가 없습니다'}
          </p>
        ) : (
          <div
            className={
              isBoard
                ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
                : 'flex flex-col gap-1.5'
            }
          >
            {pageItems.map((order) => {
            const productionState = getProductionOrderState(order, counts)
            const inboundSets = isMaterialInboundMode
              ? resolveMaterialInboundSets(order, inboundMetricsByLineId!)
              : 0
            const outboundSets = isMaterialInboundMode
              ? Math.max(0, Math.floor(materialMetricsByLineId![order.orderLineId]?.outboundSets ?? 0))
              : 0
            const materialState = isMaterialInboundMode
              ? getMaterialInboundState(order, inboundSets)
              : null
            const state = isMaterialInboundMode ? materialState! : productionState
            const selected = selectedKey === order.uiKey
            const target = Math.max(0, Math.floor(order.quantity))
            const cumulative = isMaterialInboundMode
              ? inboundSets
              : resolveProductionCount(order, counts)
            const progress = isMaterialInboundMode
              ? materialInboundProgressPercent(order, inboundSets)
              : getProgressPercent(cumulative, target)
            const outboundProgress = isMaterialInboundMode
              ? materialOutboundProgressPercent(inboundSets, outboundSets)
              : 0
            const inboundComplete = target > 0 && inboundSets >= target
            const inboundRemaining = Math.max(0, target - inboundSets)
            const outboundRemaining = Math.max(0, inboundSets - outboundSets)
            const complete = isMaterialInboundMode ? inboundComplete : target > 0 && cumulative >= target
            const remaining = isMaterialInboundMode ? inboundRemaining : Math.max(0, target - cumulative)
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
            const { name: productName, version: productVersion } =
              formatProductionProductDisplay(order)

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
                  'w-full rounded-lg border border-transparent border-l-4 text-left transition',
                  isBoard ? 'px-4 py-3.5 shadow-sm' : 'shrink-0 px-3 py-2',
                  enableDrag ? 'cursor-grab active:cursor-grabbing' : '',
                  selected
                    ? 'border-sky-500 border-l-sky-500 bg-sky-50 ring-1 ring-sky-200'
                    : [
                        'bg-white hover:bg-slate-50',
                        isMaterialInboundMode
                          ? materialStateAccentClass(materialState!)
                          : stateAccentClass(productionState),
                      ].join(' '),
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <StatusBadge
                      label={
                        isMaterialInboundMode
                          ? materialInboundFilterLabel(materialState!)
                          : stateLabel(productionState)
                      }
                      className={
                        isMaterialInboundMode
                          ? materialStateBadgeClass(materialState!)
                          : stateBadgeClass(productionState)
                      }
                    />
                    <StatusBadge
                      label={formatProductPcbSideModeLabel(order.pcbSideMode)}
                      className={
                        order.pcbSideMode === 'double'
                          ? 'bg-sky-100 text-sky-800'
                          : order.pcbSideMode === 'duo'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-500'
                      }
                    />
                    {dueLabel ? (
                      <StatusBadge
                        label={dueLabel}
                        className={urgencyBadgeClass(daysUntilDelivery)}
                      />
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[11px] font-bold text-slate-400 tabular-nums">
                    {isMaterialInboundMode ? null : `${progress}%`}
                  </span>
                </div>

                <div className="mt-1.5 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={[
                        'min-w-0 truncate font-bold leading-snug text-slate-900',
                        isBoard ? 'text-base' : 'text-sm',
                      ].join(' ')}
                    >
                      <span>{productName}</span>
                      {productVersion ? (
                        <span
                          className={[
                            'ml-1.5 font-semibold text-sky-600',
                            isBoard ? 'text-sm' : 'text-[12px]',
                          ].join(' ')}
                        >
                          {productVersion}
                        </span>
                      ) : null}
                    </p>
                    {order.customer ? (
                      <span
                        className={[
                          'max-w-[40%] shrink-0 truncate font-medium text-slate-500',
                          isBoard ? 'text-xs' : 'text-[11px]',
                        ].join(' ')}
                      >
                        {order.customer}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={[
                      'mt-1 truncate leading-snug text-slate-600',
                      isBoard ? 'text-xs' : 'text-[11px]',
                    ].join(' ')}
                  >
                    <span className="font-semibold tabular-nums text-slate-700">
                      {order.productCode || '—'}
                    </span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="font-semibold text-slate-700">
                      {displayOrderPoNumber(order.customerPoNumber, order.orderNumber) || '—'}
                    </span>
                  </p>
                </div>

                <div className={isBoard ? 'mt-2.5' : 'mt-1.5'}>
                  {isMaterialInboundMode ? (
                    <div className="space-y-2">
                      <div>
                        <div
                          className={[
                            'mb-1 flex items-center justify-between gap-2 font-medium text-slate-500',
                            isBoard ? 'text-xs' : 'text-[11px]',
                          ].join(' ')}
                        >
                          <span className="tabular-nums">
                            입고 {inboundSets.toLocaleString('ko-KR')}
                            {target > 0 ? ` / ${target.toLocaleString('ko-KR')}` : ''}
                            <span className="ml-1.5 font-bold text-slate-400">{progress}%</span>
                          </span>
                          <span>
                            미입고{' '}
                            <span className="font-bold text-slate-700 tabular-nums">
                              {inboundRemaining.toLocaleString('ko-KR')}
                            </span>
                          </span>
                        </div>
                        <div
                          className={[
                            'overflow-hidden rounded-full bg-slate-100',
                            isBoard ? 'h-2' : 'h-1.5',
                          ].join(' ')}
                        >
                          <div
                            className={`h-full rounded-full transition-all ${materialProgressBarClass(materialState!, inboundComplete)}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div
                          className={[
                            'mb-1 flex items-center justify-between gap-2 font-medium text-slate-500',
                            isBoard ? 'text-xs' : 'text-[11px]',
                          ].join(' ')}
                        >
                          <span className="tabular-nums">
                            불출 {outboundSets.toLocaleString('ko-KR')}
                            {inboundSets > 0 ? ` / ${inboundSets.toLocaleString('ko-KR')}` : ''}
                            <span className="ml-1.5 font-bold text-slate-400">{outboundProgress}%</span>
                          </span>
                          <span>
                            미불출{' '}
                            <span className="font-bold text-slate-700 tabular-nums">
                              {outboundRemaining.toLocaleString('ko-KR')}
                            </span>
                          </span>
                        </div>
                        <div
                          className={[
                            'overflow-hidden rounded-full bg-slate-100',
                            isBoard ? 'h-2' : 'h-1.5',
                          ].join(' ')}
                        >
                          <div
                            className={`h-full rounded-full transition-all ${materialOutboundProgressBarClass(outboundSets, inboundSets)}`}
                            style={{ width: `${outboundProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className={[
                          'mb-1 flex items-center justify-between gap-2 font-medium text-slate-500',
                          isBoard ? 'text-xs' : 'text-[11px]',
                        ].join(' ')}
                      >
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
                      <div
                        className={[
                          'overflow-hidden rounded-full bg-slate-100',
                          isBoard ? 'h-2' : 'h-1.5',
                        ].join(' ')}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${progressBarClass(productionState, complete)}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </button>
            )
          })}
          </div>
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
