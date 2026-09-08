'use client'

import { useMemo, useState, type DragEvent } from 'react'
import { ProductionPlanBoardCard } from '@/components/production-plan/production-plan-board-card'
import {
  readProductionPlanDragPayloadFromDataTransfer,
  type ProductionPlanDragPayload,
} from '@/lib/production-plan/config'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'
import { todayYmdSeoul } from '@/lib/orders/utils'
import {
  POST_PROCESS_TEAMS,
  type PostProcessTeam,
} from '@/lib/post-process/teams'
import { formatCalendarDayLabel, formatWeekdayLabel } from '@/lib/smt/plan/utils'
import { ERP_TABLE_HEAD_CLASS } from '@/lib/ui/tokens'

type ProductionPlanPostWeekCalendarProps = {
  weekDates: string[]
  scheduledRows: ProductionPlanBoardRow[]
  onSelectRow?: (row: ProductionPlanBoardRow) => void
  onDropOrder?: (
    payload: ProductionPlanDragPayload,
    target: { plannedDate: string; team: PostProcessTeam },
  ) => void
}

function cellKey(plannedDate: string, team: string) {
  return `${plannedDate}:${team}`
}

export function ProductionPlanPostWeekCalendar({
  weekDates,
  scheduledRows,
  onSelectRow,
  onDropOrder,
}: ProductionPlanPostWeekCalendarProps) {
  const today = todayYmdSeoul()
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const rowsByCell = useMemo(() => {
    const map = new Map<string, ProductionPlanBoardRow[]>()
    for (const row of scheduledRows) {
      if (row.scope !== 'post') continue
      const date = row.plannedDate.trim().slice(0, 10)
      const team = String(row.team || '').trim()
      if (!date || !team) continue
      const key = cellKey(date, team)
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return map
  }, [scheduledRows])

  function handleDragOver(event: DragEvent, key: string) {
    if (!onDropOrder) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragOverKey(key)
  }

  function handleDrop(event: DragEvent, plannedDate: string, team: PostProcessTeam) {
    if (!onDropOrder) return
    event.preventDefault()
    setDragOverKey(null)
    const payload = readProductionPlanDragPayloadFromDataTransfer(event.dataTransfer)
    if (!payload || payload.scope !== 'post') return
    onDropOrder(payload, { plannedDate, team })
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white">
      <table className="min-w-[960px] w-full border-collapse">
        <thead className={ERP_TABLE_HEAD_CLASS}>
          <tr>
            <th className="sticky left-0 z-[1] w-24 border-b border-r border-slate-200 bg-slate-50 px-2 py-3 text-left text-xs font-semibold text-slate-500">
              팀
            </th>
            {weekDates.map((date) => {
              const isToday = date === today
              return (
                <th
                  key={date}
                  className={`min-w-[120px] border-b border-r px-2 py-2 text-center last:border-r-0 ${
                    isToday
                      ? 'border-violet-300 bg-violet-100 ring-2 ring-inset ring-violet-400'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <p
                    className={`text-[11px] font-semibold ${isToday ? 'text-violet-700' : 'text-slate-500'}`}
                  >
                    {formatWeekdayLabel(date)}
                    {isToday ? ' · 오늘' : ''}
                  </p>
                  <p
                    className={`text-sm font-extrabold tabular-nums ${isToday ? 'text-violet-950' : 'text-slate-800'}`}
                  >
                    {formatCalendarDayLabel(date)}
                  </p>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {POST_PROCESS_TEAMS.map((team) => (
            <tr key={team} className="border-b border-slate-100 last:border-b-0">
              <td className="sticky left-0 z-[1] border-r border-slate-200 bg-slate-50 px-2 py-3 align-top text-xs font-bold text-slate-700">
                {team}
              </td>
              {weekDates.map((plannedDate) => {
                const key = cellKey(plannedDate, team)
                const cellRows = rowsByCell.get(key) ?? []
                const isToday = plannedDate === today
                const isDropTarget = dragOverKey === key

                return (
                  <td
                    key={key}
                    className={`min-h-[110px] border-r align-top p-1.5 last:border-r-0 ${
                      isDropTarget
                        ? 'border-violet-300 bg-violet-100 ring-2 ring-inset ring-violet-400'
                        : isToday
                          ? 'border-violet-200 bg-violet-50/70'
                          : 'border-slate-100'
                    }`}
                    onDragOver={(event) => handleDragOver(event, key)}
                    onDragLeave={() => setDragOverKey((current) => (current === key ? null : current))}
                    onDrop={(event) => handleDrop(event, plannedDate, team)}
                  >
                    <div className="flex min-h-[96px] flex-col gap-1">
                      {cellRows.map((row) => (
                        <ProductionPlanBoardCard
                          key={row.key}
                          row={row}
                          tone="post"
                          onSelect={onSelectRow}
                        />
                      ))}
                      {cellRows.length === 0 ? (
                        <div
                          className={`flex flex-1 items-center justify-center rounded-lg border border-dashed px-1 py-6 text-[11px] ${
                            isDropTarget
                              ? 'border-violet-400 bg-violet-50 text-violet-700'
                              : 'border-slate-200 text-slate-400'
                          }`}
                        >
                          {isDropTarget ? '여기에 놓기' : '끌어다 놓기'}
                        </div>
                      ) : isDropTarget ? (
                        <div className="rounded-md border border-dashed border-violet-400 bg-violet-50 px-1 py-2 text-center text-[10px] font-semibold text-violet-700">
                          여기에 추가
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
