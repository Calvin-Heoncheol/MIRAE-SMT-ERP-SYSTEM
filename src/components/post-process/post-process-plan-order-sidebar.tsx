'use client'

import { formatInternalCodeLabel } from '@/lib/orders/utils'
import { POST_PROCESS_PLAN_DRAG_MIME } from '@/lib/post-process/plan/config'
import type {
  CandidateSmtStatus,
  PostProcessPlanOrderCandidate,
} from '@/lib/post-process/plan/types'
import {
  formatCalendarDayLabel,
  formatDeliveryCountdown,
  getDeliveryUrgencyTone,
} from '@/lib/post-process/plan/utils'
import { PRODUCTION_ORDER_PAGE_SIZE } from '@/lib/production-input/utils'

type PostProcessPlanOrderSidebarProps = {
  candidates: PostProcessPlanOrderCandidate[]
  selectedAssemblyGroupId: string
  search: string
  page: number
  onSearchChange: (value: string) => void
  onSelect: (assemblyGroupId: string) => void
  onPageChange: (page: number) => void
  onDragCandidate?: (assemblyGroupId: string) => void
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

function SmtStatusBadge({ smt }: { smt: CandidateSmtStatus }) {
  if (smt.status === 'done') {
    return (
      <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
        SMT 완료
      </span>
    )
  }
  if (smt.status === 'planned') {
    return (
      <span className="inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-200">
        SMT {smt.lastPlannedDate ? `${formatCalendarDayLabel(smt.lastPlannedDate)} ` : ''}완료예정
      </span>
    )
  }
  if (smt.status === 'partial') {
    return (
      <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200 tabular-nums">
        SMT 일부계획 {smt.coveredQuantity.toLocaleString('ko-KR')}/
        {smt.targetQuantity.toLocaleString('ko-KR')}
        {smt.lastPlannedDate ? ` · ~${formatCalendarDayLabel(smt.lastPlannedDate)}` : ''}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200">
      SMT 미계획
    </span>
  )
}

export function filterPostProcessPlanOrderCandidates(
  candidates: PostProcessPlanOrderCandidate[],
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

export function PostProcessPlanOrderSidebar({
  candidates,
  selectedAssemblyGroupId,
  search,
  page,
  onSearchChange,
  onSelect,
  onPageChange,
  onDragCandidate,
}: PostProcessPlanOrderSidebarProps) {
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
            const selected = selectedAssemblyGroupId === candidate.assemblyGroupId
            const dueLabel = formatDeliveryCountdown(candidate.daysUntilDelivery)

            return (
              <button
                key={candidate.assemblyGroupId}
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    POST_PROCESS_PLAN_DRAG_MIME,
                    JSON.stringify({
                      kind: 'order',
                      orderId: candidate.orderId,
                      assemblyGroupId: candidate.assemblyGroupId,
                    }),
                  )
                  event.dataTransfer.effectAllowed = 'move'
                  onDragCandidate?.(candidate.assemblyGroupId)
                }}
                onClick={() => onSelect(candidate.assemblyGroupId)}
                className={[
                  'w-full rounded-lg border border-l-4 bg-white px-3 py-2.5 text-left shadow-sm transition',
                  urgencyBorderClass(candidate.daysUntilDelivery),
                  selected
                    ? 'border-sky-400 ring-2 ring-sky-200'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
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
                <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                  {candidate.productSummary}
                </p>
                <p className="mt-1 text-[13px] font-semibold tabular-nums text-sky-800">
                  수량 {candidate.unplannedRemaining.toLocaleString('ko-KR')}
                </p>
                {candidate.smt ? (
                  <div className="mt-1">
                    <SmtStatusBadge smt={candidate.smt} />
                  </div>
                ) : null}
              </button>
            )
          })
        )}
      </div>

      {showPager ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            이전
          </button>
          <span className="text-xs tabular-nums text-slate-500">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            다음
          </button>
        </div>
      ) : null}
    </aside>
  )
}
