'use client'

import { addDaysYmd, displayOrderPoNumber } from '@/lib/orders/utils'
import { isWeekendYmd } from '@/lib/production-plan/calendar'
import type { ProductionPlanEvent } from '@/lib/production-plan/events'
import {
  PLAN_BADGE_GROUP_STYLE,
  PLAN_BADGE_META,
  PLAN_BADGE_RANK,
  type PlanBadgeKind,
} from '@/lib/production-plan/plan-badges'
import type { ProductionPlanBoardRow } from '@/lib/production-plan/types'

/** 달력에 그리는 일정 한 건 — 기존 계획(boardRow) 또는 일정 이벤트(event) */
export type PlanCalendarItem = {
  key: string
  kind: PlanBadgeKind
  orderLabel: string
  customer: string
  productName: string
  plannedDate: string
  plannedEndDate: string
  quantity: number | null
  lineNo?: number | null
  team?: string
  boardRow?: ProductionPlanBoardRow
  event?: ProductionPlanEvent
}

export type PlanBarSegment = {
  item: PlanCalendarItem
  col: number
  span: number
  lane: number
  continuesBefore: boolean
  continuesAfter: boolean
}

/** 3줄 막대(종류·수량 / 모델명 / 발주번호) 한 칸 높이 */
export const PLAN_BAR_LANE_HEIGHT = 68

export function boardRowBadgeKind(row: ProductionPlanBoardRow): PlanBadgeKind {
  if (row.scope === 'material') return 'material_inbound'
  if (row.scope === 'post') return 'post'
  return row.pcbSide === 'BOT' ? 'smd_second' : 'smd_first'
}

export function planItemFromBoardRow(row: ProductionPlanBoardRow): PlanCalendarItem {
  const plannedDate = row.plannedDate.slice(0, 10)
  return {
    key: row.key,
    kind: boardRowBadgeKind(row),
    orderLabel: displayOrderPoNumber(row.customerPoNumber, row.orderNumber) || row.orderNumber || '—',
    customer: row.customer,
    productName: row.productName,
    plannedDate,
    plannedEndDate: (row.plannedEndDate || plannedDate).slice(0, 10),
    quantity: row.plannedQuantity,
    lineNo: row.lineNo,
    team: row.team,
    boardRow: row,
  }
}

export function planItemFromEvent(event: ProductionPlanEvent): PlanCalendarItem {
  return {
    key: `event:${event.id}`,
    kind: event.kind,
    orderLabel:
      displayOrderPoNumber(event.customerPoNumber, event.orderNumber) || event.orderNumber || '—',
    customer: event.customer,
    productName: event.productName,
    plannedDate: event.plannedDate,
    plannedEndDate: event.plannedEndDate || event.plannedDate,
    quantity: event.plannedQuantity,
    event,
  }
}

/** 시작~종료 사이 평일 수 (토·일 제외, 양 끝 포함) */
function countWorkdays(start: string, end: string) {
  let count = 0
  for (let day = start; day <= end; day = addDaysYmd(day, 1)) {
    if (!isWeekendYmd(day)) count += 1
  }
  return count
}

function itemTooltip(item: PlanCalendarItem) {
  const meta = PLAN_BADGE_META[item.kind]
  const start = item.plannedDate
  const end = item.plannedEndDate
  return [
    meta.short === meta.label ? meta.label : `${meta.short} (${meta.label})`,
    `발주 ${item.orderLabel}`,
    `모델 ${item.productName || '—'}`,
    item.customer ? `고객사 ${item.customer}` : '',
    `기간 ${start}${end !== start ? ` ~ ${end}` : ''} (${countWorkdays(start, end)}일)`,
    item.quantity != null ? `수량 ${item.quantity.toLocaleString('ko-KR')}EA` : '',
    item.boardRow?.scope === 'smt' && item.lineNo ? `라인 ${item.lineNo}` : '',
    item.boardRow?.scope === 'post' && item.team ? `팀 ${item.team}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** 한 주(dates) 안에서 막대 구간을 나누고 겹치지 않게 줄(lane)을 배정 */
export function buildPlanBarSegments(dates: string[], items: PlanCalendarItem[]) {
  const first = dates[0]
  const last = dates[dates.length - 1]
  if (!first || !last) return { segments: [] as PlanBarSegment[], laneCount: 0 }
  const raw: Omit<PlanBarSegment, 'lane'>[] = []

  for (const item of items) {
    const start = item.plannedDate
    const end = item.plannedEndDate || start
    if (!start || end < first || start > last) continue
    // 토·일은 배정 불가 — 막대를 평일 구간으로 잘라 그림
    let col = dates.indexOf(start < first ? first : start)
    let endCol = dates.indexOf(end > last ? last : end)
    if (col < 0 || endCol < 0) continue
    while (col <= endCol && isWeekendYmd(dates[col])) col += 1
    while (endCol >= col && isWeekendYmd(dates[endCol])) endCol -= 1
    if (endCol < col) continue
    raw.push({
      item,
      col,
      span: endCol - col + 1,
      continuesBefore: start < dates[col],
      continuesAfter: end > dates[endCol],
    })
  }

  raw.sort(
    (a, b) =>
      a.col - b.col ||
      b.span - a.span ||
      a.item.orderLabel.localeCompare(b.item.orderLabel, 'ko') ||
      PLAN_BADGE_RANK[a.item.kind] - PLAN_BADGE_RANK[b.item.kind],
  )

  const laneEnds: number[] = []
  const segments: PlanBarSegment[] = raw.map((segment) => {
    let lane = laneEnds.findIndex((lastCol) => lastCol < segment.col)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(-1)
    }
    laneEnds[lane] = segment.col + segment.span - 1
    return { ...segment, lane }
  })

  return { segments, laneCount: laneEnds.length }
}

type PlanBarProps = {
  segment: PlanBarSegment
  moving: boolean
  highlighted: boolean
  onSelect?: (item: PlanCalendarItem) => void
  onStartMove?: (item: PlanCalendarItem) => void
}

export function PlanBar({ segment, moving, highlighted, onSelect, onStartMove }: PlanBarProps) {
  const { item } = segment
  const meta = PLAN_BADGE_META[item.kind]
  return (
    <div
      role="button"
      tabIndex={moving ? -1 : 0}
      title={itemTooltip(item)}
      onClick={(event) => {
        event.stopPropagation()
        onSelect?.(item)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect?.(item)
      }}
      style={{
        gridColumn: `${segment.col + 1} / span ${segment.span}`,
        gridRow: segment.lane + 1,
      }}
      className={`group/bar relative mx-0.5 flex min-w-0 flex-col justify-center gap-0.5 px-2 py-1 text-slate-900 shadow-sm transition ${
        PLAN_BADGE_GROUP_STYLE[meta.group].bar
      } ${segment.continuesBefore ? 'rounded-l-none border-l-0' : 'rounded-l-md border-l-4'} ${
        segment.continuesAfter ? 'rounded-r-none' : 'rounded-r-md'
      } ${moving ? (highlighted ? 'animate-pulse ring-2 ring-amber-400' : 'opacity-60') : 'pointer-events-auto cursor-pointer'}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className={`shrink-0 rounded px-1.5 py-px text-[11px] font-bold leading-4 ${PLAN_BADGE_GROUP_STYLE[meta.group].tag}`}
        >
          {segment.continuesBefore ? '… ' : ''}
          {meta.short}
        </span>
        <span className="ml-auto shrink-0 text-sm font-extrabold tabular-nums">
          {item.quantity != null ? (
            <>
              {item.quantity.toLocaleString('ko-KR')}
              <span className="ml-0.5 text-[11px] font-semibold text-slate-500">EA</span>
            </>
          ) : (
            <span className="text-[11px] font-semibold text-slate-400">수량 미입력</span>
          )}
        </span>
      </span>
      <span className="truncate text-[13px] font-bold leading-tight">{item.productName || '—'}</span>
      <span className="truncate font-mono text-[11px] leading-tight text-slate-500">
        {item.orderLabel}
      </span>
      {onStartMove && !moving ? (
        <button
          type="button"
          title="다른 날짜로 이동"
          onClick={(event) => {
            event.stopPropagation()
            onStartMove(item)
          }}
          className="absolute bottom-1 right-1 hidden rounded border border-slate-300 bg-white px-1.5 text-[11px] font-bold leading-4 text-slate-700 shadow-sm hover:bg-slate-50 group-hover/bar:block"
        >
          이동
        </button>
      ) : null}
    </div>
  )
}
