'use client'

import { useMemo } from 'react'
import {
  PLAN_BAR_LANE_HEIGHT,
  PlanBar,
  buildPlanBarSegments,
  type PlanCalendarItem,
} from '@/components/production-plan/production-plan-plan-bars'
import { MONTH_WEEKDAY_LABELS, buildMonthGrid } from '@/lib/production-plan/calendar'

type ProductionPlanMonthCalendarProps = {
  monthStart: string
  items: PlanCalendarItem[]
  onCellClick?: (plannedDate: string) => void
  onSelectItem?: (item: PlanCalendarItem) => void
  onStartMove?: (item: PlanCalendarItem) => void
  movingKey?: string | null
}

const DAY_HEADER_HEIGHT = 26
const ADD_HINT_HEIGHT = 20

export function ProductionPlanMonthCalendar({
  monthStart,
  items,
  onCellClick,
  onSelectItem,
  onStartMove,
  movingKey = null,
}: ProductionPlanMonthCalendarProps) {
  const moving = Boolean(movingKey)

  const weeks = useMemo(() => {
    const cells = buildMonthGrid(monthStart)
    const result: { cells: typeof cells; segments: ReturnType<typeof buildPlanBarSegments> }[] = []
    for (let index = 0; index < cells.length; index += 7) {
      const weekCells = cells.slice(index, index + 7)
      if (!weekCells.some((cell) => cell.inMonth)) continue
      result.push({
        cells: weekCells,
        segments: buildPlanBarSegments(
          weekCells.map((cell) => cell.ymd),
          items,
        ),
      })
    }
    return result
  }, [monthStart, items])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-white">
      <div className="sticky top-0 z-[2] grid min-w-[840px] grid-cols-7 border-b border-slate-200 bg-slate-50">
        {MONTH_WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            className={`border-r border-slate-200 py-1.5 text-center text-xs font-semibold last:border-r-0 ${
              index === 0 ? 'text-rose-500' : index === 6 ? 'text-sky-600' : 'text-slate-500'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="min-w-[840px]">
        {weeks.map(({ cells, segments: { segments, laneCount } }) => (
          <div
            key={cells[0].ymd}
            className="relative grid grid-cols-7 border-b border-slate-200"
            style={{
              minHeight: Math.max(
                120,
                DAY_HEADER_HEIGHT + laneCount * PLAN_BAR_LANE_HEIGHT + ADD_HINT_HEIGHT,
              ),
            }}
          >
            {cells.map((cell, index) => {
              const weekend = index === 0 || index === 6
              const clickable = Boolean(onCellClick) && !weekend
              return (
              <div
                key={cell.ymd}
                onClick={clickable ? () => onCellClick?.(cell.ymd) : undefined}
                title={weekend && onCellClick ? '주말은 배정할 수 없습니다' : undefined}
                className={`group relative border-r border-slate-100 last:border-r-0 ${
                  cell.isToday
                    ? 'bg-sky-50/60'
                    : weekend
                      ? 'bg-slate-100/70'
                      : cell.inMonth
                        ? ''
                        : 'bg-slate-50/70'
                } ${
                  clickable
                    ? moving
                      ? 'cursor-copy hover:bg-amber-50'
                      : 'cursor-pointer hover:bg-slate-50'
                    : weekend && onCellClick
                      ? 'cursor-not-allowed'
                      : ''
                }`}
              >
                <p
                  className={`px-2 pt-1 text-xs font-bold tabular-nums ${
                    cell.isToday
                      ? 'text-sky-700'
                      : !cell.inMonth
                        ? 'text-slate-300'
                        : index === 0
                          ? 'text-rose-500'
                          : index === 6
                            ? 'text-sky-600'
                            : 'text-slate-700'
                  }`}
                >
                  {cell.day}
                  {cell.isToday ? <span className="ml-1 text-[10px] font-semibold">오늘</span> : null}
                </p>
                {clickable ? (
                  <span
                    className={`absolute bottom-0.5 right-1.5 text-[10px] font-semibold opacity-0 transition group-hover:opacity-100 ${
                      moving ? 'text-amber-700' : 'text-slate-500'
                    }`}
                  >
                    {moving ? '여기로 이동' : '+ 배정'}
                  </span>
                ) : null}
              </div>
              )
            })}

            <div
              className="pointer-events-none absolute inset-x-0 grid grid-cols-7 gap-y-0.5 px-0.5"
              style={{ top: DAY_HEADER_HEIGHT, gridAutoRows: `${PLAN_BAR_LANE_HEIGHT - 2}px` }}
            >
              {segments.map((segment) => (
                <PlanBar
                  key={`${segment.item.key}:${segment.col}`}
                  segment={segment}
                  moving={moving}
                  highlighted={segment.item.key === movingKey}
                  onSelect={onSelectItem}
                  onStartMove={onStartMove}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
