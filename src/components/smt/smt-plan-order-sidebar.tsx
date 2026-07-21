'use client'

import { formatInternalCodeLabel } from '@/lib/orders/utils'
import { PRODUCTION_ORDER_PAGE_SIZE } from '@/lib/production-input/utils'
import { SMT_PLAN_DRAG_MIME } from '@/lib/smt/plan/config'
import type { SmtPlanOrderCandidate } from '@/lib/smt/plan/types'
import {
  formatDeliveryCountdown,
  getDeliveryUrgencyTone,
} from '@/lib/smt/plan/utils'

type SmtPlanOrderSidebarProps = {
  candidates: SmtPlanOrderCandidate[]
  selectedOrderLineId: string
  search: string
  page: number
  onSearchChange: (value: string) => void
  onSelect: (orderLineId: string) => void
  onPageChange: (page: number) => void
  onDragCandidate?: (orderLineId: string) => void
}

function urgencyBadgeClass(daysUntilDelivery: number | null) {
  const tone = getDeliveryUrgencyTone(daysUntilDelivery)
  if (tone === 'overdue') return 'bg-rose-100 text-rose-700'
  if (tone === 'urgent') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-100 text-slate-600'
}

function urgencyBorderClass(daysUntilDelivery: number | null) {
  const tone = getDeliveryUrgencyTone(daysUntilDelivery)
  if (tone === 'overdue') return 'border-l-rose-500'
  if (tone === 'urgent') return 'border-l-amber-500'
  return 'border-l-slate-300'
}

function formatUnplannedLabel(candidate: SmtPlanOrderCandidate) {
  if (candidate.splitPcbSides) {
    const top = candidate.unplannedBySide.TOP ?? 0
    const bot = candidate.unplannedBySide.BOT ?? 0
    return `수량  TOP ${top.toLocaleString('ko-KR')} · BOT ${bot.toLocaleString('ko-KR')}`
  }
  const qty = candidate.unplannedBySide.SINGLE ?? candidate.unplannedRemaining
  return `수량  ${qty.toLocaleString('ko-KR')}`
}

export function filterSmtPlanOrderCandidates(
  candidates: SmtPlanOrderCandidate[],
  query: string,
) {
  const q = query.trim().toLowerCase()
  if (!q) return candidates
  return candidates.filter((candidate) => {
    const haystack = [
      candidate.orderNumber,
      candidate.customer,
      candidate.productSummary,
      candidate.deliveryDate,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function SmtPlanOrderSidebar({
  candidates,
  selectedOrderLineId,
  search,
  page,
  onSearchChange,
  onSelect,
  onPageChange,
  onDragCandidate,
}: SmtPlanOrderSidebarProps) {
  const totalPages = Math.max(1, Math.ceil(candidates.length / PRODUCTION_ORDER_PAGE_SIZE))
  const currentPage = Math.min(Math.max(page, 1), totalPages)
  const startIdx = (currentPage - 1) * PRODUCTION_ORDER_PAGE_SIZE
  const pageItems = candidates.slice(startIdx, startIdx + PRODUCTION_ORDER_PAGE_SIZE)
  const showPager = candidates.length > PRODUCTION_ORDER_PAGE_SIZE

  return (
    <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-slate-200 bg-slate-100 lg:border-b-0 lg:border-r">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
        <h4 className="text-sm font-bold text-slate-900">주문 선택</h4>
        <span className="text-xs font-medium text-slate-400 tabular-nums">{candidates.length}건</span>
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

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-2.5 py-2.5">
        {!pageItems.length ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {search.trim() ? '검색 결과 없음' : '미계획 주문이 없습니다'}
          </p>
        ) : (
          pageItems.map((candidate) => {
            const selected = selectedOrderLineId === candidate.orderLineId
            const dueLabel = formatDeliveryCountdown(candidate.daysUntilDelivery)

            return (
              <button
                key={candidate.orderLineId}
                type="button"
                draggable
                onDragStart={(event) => {
                  const payload = JSON.stringify({
                    kind: 'order',
                    orderId: candidate.orderId,
                    orderLineId: candidate.orderLineId,
                  })
                  event.dataTransfer.setData(SMT_PLAN_DRAG_MIME, payload)
                  event.dataTransfer.effectAllowed = 'move'
                  onDragCandidate?.(candidate.orderLineId)
                }}
                onClick={() => onSelect(candidate.orderLineId)}
                aria-pressed={selected}
                className={[
                  'shrink-0 cursor-grab rounded-xl bg-white px-3 py-2 text-left transition active:cursor-grabbing',
                  selected
                    ? 'border-2 border-sky-500 bg-sky-50 shadow-md ring-2 ring-sky-200'
                    : [
                        'border border-slate-200 border-l-4 hover:border-slate-300 hover:shadow-sm',
                        urgencyBorderClass(candidate.daysUntilDelivery),
                      ].join(' '),
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-[11px] text-slate-500">
                    {candidate.customer || '—'} · {formatInternalCodeLabel(candidate.orderNumber)}
                  </p>
                  {dueLabel ? (
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${urgencyBadgeClass(candidate.daysUntilDelivery)}`}
                    >
                      {dueLabel}
                    </span>
                  ) : null}
                </div>

                <div className="mt-0.5 flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-bold text-slate-900">
                    {candidate.productSummary}
                  </p>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {candidate.splitPcbSides ? '양면' : '단면'}
                  </span>
                </div>

                <p className="mt-1.5 text-[13px] font-semibold tabular-nums text-slate-700">
                  {formatUnplannedLabel(candidate)}
                </p>
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
