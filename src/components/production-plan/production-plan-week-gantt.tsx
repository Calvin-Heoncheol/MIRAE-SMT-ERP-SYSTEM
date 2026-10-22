'use client'

import { useMemo } from 'react'
import {
  PLAN_BAR_LANE_HEIGHT,
  PlanBar,
  buildPlanBarSegments,
} from '@/components/production-plan/production-plan-plan-bars'
import {
  PRODUCTION_PLAN_DAY_CAPACITY_HOURS,
  formatCellLoadLabel,
  summarizeCellLoad,
} from '@/lib/production-plan/capacity'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import type { ProductionPlanBoardRow, ProductionPlanScope } from '@/lib/production-plan/types'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'
import { formatCalendarDayLabel, formatWeekdayLabel } from '@/lib/smt/plan/utils'

export type ProductionPlanGanttSlot = {
  plannedDate: string
  scope: ProductionPlanScope
  lineNo?: number
  team?: string
}

type ResourceRow = {
  key: string
  label: string
  scope: ProductionPlanScope
  lineNo?: number
  team?: string
}

type ProductionPlanWeekGanttProps = {
  weekDates: string[]
  scheduledRows: ProductionPlanBoardRow[]
  onSelectRow?: (row: ProductionPlanBoardRow) => void
  onCellClick?: (slot: ProductionPlanGanttSlot) => void
  onStartMove?: (row: ProductionPlanBoardRow) => void
  movingRowKey?: string | null
}

const LOAD_HEADER_HEIGHT = 20
const ADD_HINT_HEIGHT = 18
const LABEL_WIDTH = 96

const RESOURCE_ROWS: ResourceRow[] = [
  { key: 'material', label: '자재 입고', scope: 'material' },
  ...SMT_PLAN_LINE_NOS.map((lineNo) => ({
    key: `smt:${lineNo}`,
    label: `SMT ${lineNo}라인`,
    scope: 'smt' as const,
    lineNo,
  })),
  ...POST_PROCESS_TEAMS.map((team) => ({
    key: `post:${team}`,
    label: team,
    scope: 'post' as const,
    team,
  })),
]

const GROUP_LABEL_CLASS: Record<ProductionPlanScope, string> = {
  material: 'border-l-emerald-500',
  smt: 'border-l-sky-500',
  post: 'border-l-violet-500',
}

function belongsTo(resource: ResourceRow, row: ProductionPlanBoardRow) {
  if (row.scope !== resource.scope) return false
  if (resource.scope === 'smt') {
    const lineNo =
      row.lineNo != null && SMT_PLAN_LINE_NOS.includes(row.lineNo) ? row.lineNo : SMT_PLAN_LINE_NOS[0]
    return lineNo === resource.lineNo
  }
  if (resource.scope === 'post') {
    const team = String(row.team || '').trim() || POST_PROCESS_TEAMS[0]
    return team === resource.team
  }
  return true
}

export function ProductionPlanWeekGantt({
  weekDates,
  scheduledRows,
  onSelectRow,
  onCellClick,
  onStartMove,
  movingRowKey = null,
}: ProductionPlanWeekGanttProps) {
  const moving = Boolean(movingRowKey)
  const today = todayYmdSeoul()

  const resources = useMemo(
    () =>
      RESOURCE_ROWS.map((resource) => {
        const rows = scheduledRows.filter((row) => belongsTo(resource, row))
        const loads = weekDates.map((date) =>
          resource.scope === 'material'
            ? null
            : summarizeCellLoad(rows.filter((row) => row.plannedDate.slice(0, 10) === date)),
        )
        return { resource, loads, ...buildPlanBarSegments(weekDates, rows) }
      }),
    [scheduledRows, weekDates],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-white">
      <div
        className="sticky top-0 z-[2] grid min-w-[960px] border-b border-slate-200 bg-slate-50"
        style={{ gridTemplateColumns: `${LABEL_WIDTH}px repeat(7, minmax(0, 1fr))` }}
      >
        <div className="border-r border-slate-200 px-2 py-2 text-xs font-semibold text-slate-500">
          라인·팀
        </div>
        {weekDates.map((date) => {
          const isToday = date === today
          return (
            <div
              key={date}
              className={`border-r border-slate-200 px-2 py-1.5 text-center last:border-r-0 ${
                isToday ? 'bg-sky-100' : ''
              }`}
            >
              <p className={`text-[11px] font-semibold ${isToday ? 'text-sky-700' : 'text-slate-500'}`}>
                {formatWeekdayLabel(date)}
                {isToday ? ' · 오늘' : ''}
              </p>
              <p className="text-sm font-extrabold tabular-nums text-slate-800">
                {formatCalendarDayLabel(date)}
              </p>
            </div>
          )
        })}
      </div>

      <div className="min-w-[960px]">
        {resources.map(({ resource, loads, segments, laneCount }) => {
          const minHeight = Math.max(
            72,
            LOAD_HEADER_HEIGHT + laneCount * PLAN_BAR_LANE_HEIGHT + ADD_HINT_HEIGHT,
          )
          return (
            <div
              key={resource.key}
              className="relative grid border-b border-slate-200"
              style={{
                gridTemplateColumns: `${LABEL_WIDTH}px repeat(7, minmax(0, 1fr))`,
                minHeight,
              }}
            >
              <div
                className={`sticky left-0 z-[1] border-l-4 border-r border-r-slate-200 bg-slate-50 px-2 py-2 text-xs font-bold text-slate-700 ${
                  GROUP_LABEL_CLASS[resource.scope]
                }`}
              >
                {resource.label}
              </div>
              {weekDates.map((date, index) => {
                const load = loads[index]
                return (
                  <div
                    key={date}
                    onClick={
                      onCellClick
                        ? () =>
                            onCellClick({
                              plannedDate: date,
                              scope: resource.scope,
                              lineNo: resource.lineNo,
                              team: resource.team,
                            })
                        : undefined
                    }
                    className={`group relative border-r border-slate-100 last:border-r-0 ${
                      load?.overCapacity ? 'bg-rose-50/70' : date === today ? 'bg-sky-50/50' : ''
                    } ${
                      onCellClick
                        ? moving
                          ? 'cursor-copy hover:bg-amber-50'
                          : 'cursor-pointer hover:bg-slate-50'
                        : ''
                    }`}
                  >
                    {load && load.quantity > 0 ? (
                      <p
                        className={`px-1.5 pt-0.5 text-[10px] font-semibold tabular-nums ${
                          load.overCapacity ? 'text-rose-700' : 'text-slate-400'
                        }`}
                        title={
                          load.quantityOnly
                            ? 'Tech Time 미입력 — 수량만 표시'
                            : `일 가동 ${PRODUCTION_PLAN_DAY_CAPACITY_HOURS}시간 기준`
                        }
                      >
                        {formatCellLoadLabel(load)}
                        {load.overCapacity ? ' · 초과' : ''}
                      </p>
                    ) : null}
                    {onCellClick ? (
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
                className="pointer-events-none absolute right-0 grid grid-cols-7 gap-y-0.5 px-0.5"
                style={{
                  left: LABEL_WIDTH,
                  top: LOAD_HEADER_HEIGHT,
                  gridAutoRows: `${PLAN_BAR_LANE_HEIGHT - 2}px`,
                }}
              >
                {segments.map((segment) => (
                  <PlanBar
                    key={`${segment.row.key}:${segment.col}`}
                    segment={segment}
                    moving={moving}
                    highlighted={segment.row.key === movingRowKey}
                    onSelect={onSelectRow}
                    onStartMove={onStartMove}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
