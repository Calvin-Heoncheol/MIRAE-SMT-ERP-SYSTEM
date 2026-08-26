'use client'

import { useMemo, useState } from 'react'
import { PostProcessPlanBlockCard } from '@/components/post-process/post-process-plan-block'
import { buildPostProcessPlanProgressKey } from '@/lib/post-process/count-keys'
import { POST_PROCESS_PLAN_DRAG_MIME } from '@/lib/post-process/plan/config'
import type { PostProcessPlanBlock } from '@/lib/post-process/plan/types'
import { formatCalendarDayLabel, formatWeekdayLabel } from '@/lib/post-process/plan/utils'
import { todayYmdSeoul } from '@/lib/orders/utils'

type PostProcessPlanCalendarProps = {
  weekDates: string[]
  plans: PostProcessPlanBlock[]
  planProgress?: Record<string, number>
  onDrop: (
    payload:
      | { kind: 'order'; orderId: string; assemblyGroupId: string }
      | { kind: 'plan'; planId: string },
    target: { plannedDate: string },
  ) => void
  onCellClick: (target: { plannedDate: string }) => void
  onPlanClick: (plan: PostProcessPlanBlock) => void
  onDragPlan: (planId: string) => void
}

export function PostProcessPlanCalendar({
  weekDates,
  plans,
  planProgress = {},
  onDrop,
  onCellClick,
  onPlanClick,
  onDragPlan,
}: PostProcessPlanCalendarProps) {
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const today = todayYmdSeoul()

  const plansByDate = useMemo(() => {
    const map = new Map<string, PostProcessPlanBlock[]>()
    for (const plan of plans) {
      const existing = map.get(plan.plannedDate) ?? []
      existing.push(plan)
      map.set(plan.plannedDate, existing)
    }
    return map
  }, [plans])

  function handleDragOver(event: React.DragEvent, plannedDate: string) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverDate(plannedDate)
  }

  function handleDrop(event: React.DragEvent, plannedDate: string) {
    event.preventDefault()
    setDragOverDate(null)

    const raw = event.dataTransfer.getData(POST_PROCESS_PLAN_DRAG_MIME)
    if (!raw) return

    try {
      const payload = JSON.parse(raw) as
        | { kind: 'order'; orderId: string; assemblyGroupId?: string }
        | { kind: 'plan'; planId: string }
      if (payload.kind === 'order' && !payload.assemblyGroupId) return
      onDrop(
        payload.kind === 'order'
          ? {
              kind: 'order',
              orderId: payload.orderId,
              assemblyGroupId: payload.assemblyGroupId!,
            }
          : payload,
        { plannedDate },
      )
    } catch {
      // ignore invalid payload
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
      <div className="grid min-w-[720px] grid-cols-7 border-b border-slate-200 bg-slate-50">
        {weekDates.map((date) => {
          const isToday = date === today
          return (
            <div
              key={`h-${date}`}
              className={`border-r px-2 py-2 text-center last:border-r-0 ${
                isToday
                  ? 'border-sky-300 bg-sky-100 ring-2 ring-inset ring-sky-400'
                  : 'border-slate-200'
              }`}
            >
              <p
                className={`text-[11px] font-semibold ${isToday ? 'text-sky-700' : 'text-slate-500'}`}
              >
                {formatWeekdayLabel(date)}
                {isToday ? ' · 오늘' : ''}
              </p>
              <p
                className={`text-sm font-extrabold tabular-nums ${isToday ? 'text-sky-950' : 'text-slate-800'}`}
              >
                {formatCalendarDayLabel(date)}
              </p>
            </div>
          )
        })}
      </div>
      <div className="grid min-h-[360px] min-w-[720px] grid-cols-7">
        {weekDates.map((plannedDate) => {
          const cellPlans = plansByDate.get(plannedDate) ?? []
          const isDropTarget = dragOverDate === plannedDate
          const isToday = plannedDate === today

          return (
            <div
              key={plannedDate}
              className={`min-h-[420px] cursor-pointer border-r p-1.5 last:border-r-0 hover:bg-slate-50/80 ${
                isToday ? 'border-sky-200 bg-sky-50/70' : 'border-slate-100'
              } ${isDropTarget ? 'bg-slate-100/80 ring-2 ring-inset ring-slate-300' : ''}`}
              onClick={() => onCellClick({ plannedDate })}
              onDragOver={(event) => handleDragOver(event, plannedDate)}
              onDragLeave={() => setDragOverDate((current) => (current === plannedDate ? null : current))}
              onDrop={(event) => handleDrop(event, plannedDate)}
            >
              <div className="flex min-h-[400px] flex-col gap-1">
                {cellPlans.map((plan) => (
                  <PostProcessPlanBlockCard
                    key={plan.id}
                    plan={plan}
                    producedQuantity={
                      planProgress[
                        buildPostProcessPlanProgressKey(
                          plan.assemblyGroupId,
                          plan.plannedDate,
                          plan.team,
                        )
                      ] ?? 0
                    }
                    onClick={() => onPlanClick(plan)}
                    onDragStart={(event) => {
                      event.stopPropagation()
                      event.dataTransfer.setData(
                        POST_PROCESS_PLAN_DRAG_MIME,
                        JSON.stringify({ kind: 'plan', planId: plan.id }),
                      )
                      event.dataTransfer.effectAllowed = 'move'
                      onDragPlan(plan.id)
                    }}
                  />
                ))}
                {cellPlans.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 px-1 text-[11px] text-slate-400">
                    클릭하여 추가
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
