'use client'

import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { ProductionPlanBoardRow, ProductionPlanScope } from '@/lib/production-plan/types'

export type PlanBarSegment = {
  row: ProductionPlanBoardRow
  col: number
  span: number
  lane: number
  continuesBefore: boolean
  continuesAfter: boolean
}

/** 3줄 막대(발주번호·모델명·수량) 한 칸 높이 */
export const PLAN_BAR_LANE_HEIGHT = 52

export const PLAN_STAGE_LABELS: Record<ProductionPlanScope, string> = {
  material: '자재',
  smt: 'SMD',
  post: '후공정',
}

const STAGE_RANK: Record<ProductionPlanScope, number> = { material: 0, smt: 1, post: 2 }

const BAR_CLASS: Record<ProductionPlanScope, string> = {
  material: 'bg-emerald-500 text-white hover:bg-emerald-600',
  smt: 'bg-sky-500 text-white hover:bg-sky-600',
  post: 'bg-violet-500 text-white hover:bg-violet-600',
}

function rowEndYmd(row: ProductionPlanBoardRow) {
  return (row.plannedEndDate || row.plannedDate).slice(0, 10)
}

function orderLabelOf(row: ProductionPlanBoardRow) {
  return displayOrderPoNumber(row.customerPoNumber, row.orderNumber) || row.orderNumber || '—'
}

function sideSuffix(row: ProductionPlanBoardRow) {
  return row.scope === 'smt' && (row.pcbSide === 'TOP' || row.pcbSide === 'BOT') ? row.pcbSide : ''
}

function barTooltip(row: ProductionPlanBoardRow) {
  const start = row.plannedDate.slice(0, 10)
  const end = rowEndYmd(row)
  const side = sideSuffix(row)
  return [
    `${PLAN_STAGE_LABELS[row.scope]}${side ? ` ${side}` : ''}`,
    `발주 ${orderLabelOf(row)}`,
    `모델 ${row.productName || '—'}`,
    row.customer ? `고객사 ${row.customer}` : '',
    `기간 ${start}${end !== start ? ` ~ ${end}` : ''}`,
    `수량 ${(row.plannedQuantity ?? 0).toLocaleString('ko-KR')}EA`,
    row.scope === 'smt' && row.lineNo ? `라인 ${row.lineNo}` : '',
    row.scope === 'post' && row.team ? `팀 ${row.team}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** 한 주(dates) 안에서 막대 구간을 나누고 겹치지 않게 줄(lane)을 배정 */
export function buildPlanBarSegments(dates: string[], rows: ProductionPlanBoardRow[]) {
  const first = dates[0]
  const last = dates[dates.length - 1]
  if (!first || !last) return { segments: [] as PlanBarSegment[], laneCount: 0 }
  const raw: Omit<PlanBarSegment, 'lane'>[] = []

  for (const row of rows) {
    const start = row.plannedDate.slice(0, 10)
    const end = rowEndYmd(row)
    if (!start || end < first || start > last) continue
    const segStart = start < first ? first : start
    const segEnd = end > last ? last : end
    const col = dates.indexOf(segStart)
    const endCol = dates.indexOf(segEnd)
    if (col < 0 || endCol < col) continue
    raw.push({
      row,
      col,
      span: endCol - col + 1,
      continuesBefore: start < first,
      continuesAfter: end > last,
    })
  }

  raw.sort(
    (a, b) =>
      a.col - b.col ||
      b.span - a.span ||
      a.row.orderNumber.localeCompare(b.row.orderNumber, 'ko') ||
      a.row.targetId.localeCompare(b.row.targetId) ||
      STAGE_RANK[a.row.scope] - STAGE_RANK[b.row.scope],
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
  onSelect?: (row: ProductionPlanBoardRow) => void
  onStartMove?: (row: ProductionPlanBoardRow) => void
}

export function PlanBar({ segment, moving, highlighted, onSelect, onStartMove }: PlanBarProps) {
  const { row } = segment
  return (
    <div
      role="button"
      tabIndex={moving ? -1 : 0}
      title={barTooltip(row)}
      onClick={(event) => {
        event.stopPropagation()
        onSelect?.(row)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect?.(row)
      }}
      style={{
        gridColumn: `${segment.col + 1} / span ${segment.span}`,
        gridRow: segment.lane + 1,
      }}
      className={`group/bar relative mx-0.5 flex min-w-0 flex-col justify-center px-2 text-[11px] font-semibold leading-tight shadow-sm transition ${
        BAR_CLASS[row.scope]
      } ${segment.continuesBefore ? 'rounded-l-none' : 'rounded-l-md'} ${
        segment.continuesAfter ? 'rounded-r-none' : 'rounded-r-md'
      } ${moving ? (highlighted ? 'animate-pulse ring-2 ring-amber-400' : 'opacity-60') : 'pointer-events-auto cursor-pointer'}`}
    >
      <span className="truncate font-mono text-[10px] font-medium opacity-85">
        {segment.continuesBefore ? '… ' : ''}
        {orderLabelOf(row)}
      </span>
      <span className="truncate">{row.productName || '—'}</span>
      <span className="truncate text-xs font-extrabold tabular-nums">
        {(row.plannedQuantity ?? 0).toLocaleString('ko-KR')}
        <span className="ml-0.5 text-[10px] font-semibold opacity-80">EA</span>
        {sideSuffix(row) ? (
          <span className="ml-1 text-[10px] font-bold opacity-80">{sideSuffix(row)}</span>
        ) : null}
      </span>
      {onStartMove && !moving ? (
        <button
          type="button"
          title="다른 날짜로 이동"
          onClick={(event) => {
            event.stopPropagation()
            onStartMove(row)
          }}
          className="absolute right-1 top-1 hidden rounded bg-white/90 px-1 text-[10px] font-bold leading-4 text-slate-700 hover:bg-white group-hover/bar:block"
        >
          이동
        </button>
      ) : null}
    </div>
  )
}
