'use client'

import { useMemo, useState } from 'react'
import { SmtPlanBlockCard } from '@/components/smt/smt-plan-block'
import { SMT_PLAN_DRAG_MIME } from '@/lib/smt/plan/config'
import type { SmtPlanBlock } from '@/lib/smt/plan/types'
import { formatCalendarDayLabel, formatWeekdayLabel } from '@/lib/smt/plan/utils'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { buildSmtPlanProgressKey } from '@/lib/smt/count-keys'
import { ERP_TABLE_HEAD_CLASS } from '@/lib/ui/tokens'

type SmtPlanCalendarProps = {
  weekDates: string[]
  lineNos: number[]
  plans: SmtPlanBlock[]
  planProgress?: Record<string, number>
  activeDropCell: string | null
  onDrop: (
    payload:
      | { kind: 'order'; orderId: string; orderLineId: string }
      | { kind: 'plan'; planId: string },
    target: {
      plannedDate: string
      lineNo: number
    },
  ) => void
  onCellClick: (target: { plannedDate: string; lineNo: number }) => void
  onPlanClick: (plan: SmtPlanBlock) => void
  onDragPlan: (planId: string) => void
}

function cellKey(plannedDate: string, lineNo: number) {
  return `${plannedDate}:${lineNo}`
}

export function SmtPlanCalendar({
  weekDates,
  lineNos,
  plans,
  planProgress = {},
  activeDropCell,
  onDrop,
  onCellClick,
  onPlanClick,
  onDragPlan,
}: SmtPlanCalendarProps) {
  const [dragOverCell, setDragOverCell] = useState<string | null>(null)
  const today = todayYmdSeoul()

  const plansByCell = useMemo(() => {
    const map = new Map<string, SmtPlanBlock[]>()
    for (const plan of plans) {
      const key = cellKey(plan.plannedDate, plan.lineNo)
      const existing = map.get(key) ?? []
      existing.push(plan)
      map.set(key, existing)
    }
    return map
  }, [plans])

  function handleDragOver(event: React.DragEvent, key: string) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverCell(key)
  }

  function handleDrop(
    event: React.DragEvent,
    plannedDate: string,
    lineNo: number,
  ) {
    event.preventDefault()
    setDragOverCell(null)

    const raw = event.dataTransfer.getData(SMT_PLAN_DRAG_MIME)
    if (!raw) return

    try {
      const payload = JSON.parse(raw) as
        | { kind: 'order'; orderId: string; orderLineId?: string }
        | { kind: 'plan'; planId: string }
      if (payload.kind === 'order' && !payload.orderLineId) return
      onDrop(
        payload.kind === 'order'
          ? { kind: 'order', orderId: payload.orderId, orderLineId: payload.orderLineId! }
          : payload,
        { plannedDate, lineNo },
      )
    } catch {
      // ignore invalid payload
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[920px] w-full border-collapse">
        <thead className={ERP_TABLE_HEAD_CLASS}>
          <tr>
            <th className="w-20 border-b border-r border-slate-200 px-2 py-3 text-left text-xs font-semibold text-slate-500">
              라인
            </th>
            {weekDates.map((date) => {
              const isToday = date === today
              return (
                <th
                  key={date}
                  className={`min-w-[120px] border-b border-r border-slate-200 px-2 py-2 text-center last:border-r-0 ${isToday ? 'bg-slate-100' : ''}`}
                >
                  <p className="text-[11px] font-semibold text-slate-500">{formatWeekdayLabel(date)}</p>
                  <p className={`text-sm font-bold ${isToday ? 'text-slate-900' : 'text-slate-800'}`}>
                    {formatCalendarDayLabel(date)}
                  </p>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {lineNos.map((lineNo) => (
            <tr key={lineNo} className="border-b border-slate-100 last:border-b-0">
              <td className="border-r border-slate-200 bg-slate-50 px-2 py-3 align-top text-xs font-bold text-slate-700">
                라인 {lineNo}
              </td>
              {weekDates.map((plannedDate) => {
                const key = cellKey(plannedDate, lineNo)
                const cellPlans = plansByCell.get(key) ?? []
                const isDropTarget = dragOverCell === key || activeDropCell === key
                const isToday = plannedDate === today

                return (
                  <td
                    key={key}
                    className={`min-h-[110px] cursor-pointer border-r border-slate-100 align-top p-1.5 last:border-r-0 hover:bg-slate-50/80 ${isToday ? 'bg-slate-50/40' : ''} ${isDropTarget ? 'bg-slate-100/80 ring-2 ring-inset ring-slate-300' : ''}`}
                    onClick={() => onCellClick({ plannedDate, lineNo })}
                    onDragOver={(event) => handleDragOver(event, key)}
                    onDragLeave={() => setDragOverCell((current) => (current === key ? null : current))}
                    onDrop={(event) => handleDrop(event, plannedDate, lineNo)}
                  >
                    <div className="flex min-h-[96px] flex-col gap-1">
                      {cellPlans.map((plan) => (
                        <SmtPlanBlockCard
                          key={plan.id}
                          plan={plan}
                          producedQuantity={
                            planProgress[
                              buildSmtPlanProgressKey(
                                plan.orderLineId,
                                plan.pcbSide,
                                plan.lineNo,
                                plan.plannedDate,
                              )
                            ] ?? 0
                          }
                          onClick={() => onPlanClick(plan)}
                          onDragStart={(event) => {
                            event.stopPropagation()
                            event.dataTransfer.setData(
                              SMT_PLAN_DRAG_MIME,
                              JSON.stringify({ kind: 'plan', planId: plan.id }),
                            )
                            event.dataTransfer.effectAllowed = 'move'
                            onDragPlan(plan.id)
                          }}
                        />
                      ))}
                      {cellPlans.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 px-1 py-6 text-[11px] text-slate-400">
                          클릭하여 추가
                        </div>
                      ) : null}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
