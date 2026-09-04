'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { buildScheduleFormValues } from '@/components/production-plan/production-plan-schedule-modal'
import type { ProductionPlanSheetAction } from '@/components/production-plan/production-plan-sheet'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import { canPlanPost, canPlanSmt, validatePostPlanDate } from '@/lib/production-plan/pipeline'
import type { UnifiedPlanSheetLine } from '@/lib/production-plan/unified-plan-lines'
import { canEditPostRow, lineUnplannedQty } from '@/lib/production-plan/unified-plan-lines'
import type { ProductionPlanBoardRow, ProductionPlanPcbSide } from '@/lib/production-plan/types'
import {
  deliveryUrgencyClass,
  formatDeliveryCountdown,
  isProductionPlanRemainderRow,
  isProductionPlanScheduleRow,
} from '@/lib/production-plan/utils'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'

type StageDraft = {
  plannedDate: string
  plannedQuantity: number
  lineNo: number
  team: string
  pcbSide: ProductionPlanPcbSide
}

type StageSide = 'material' | 'smt' | 'post'

type ProductionPlanUnifiedSheetProps = {
  lines: UnifiedPlanSheetLine[]
  allRows: ProductionPlanBoardRow[]
  search: string
  onSearchChange: (value: string) => void
  savingKeys: ReadonlySet<string>
  onSaveActions: (actions: ProductionPlanSheetAction[]) => void | Promise<void>
  onMessage: (message: string) => void
}

const cellInputClass =
  'h-7 w-full min-w-0 rounded border border-transparent bg-transparent px-1 text-xs outline-none transition hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50'

const DATE_COL = 'min-w-[7.5rem] w-[7.5rem]'
const QTY_COL = 'min-w-[4.5rem] w-[4.5rem]'
const LINE_COL = 'min-w-[3.5rem] w-[3.5rem]'
const TEAM_COL = 'min-w-[5.5rem] w-[5.5rem]'
const ORDER_COL = 'min-w-[8.75rem] w-[8.75rem] max-w-[8.75rem]'
const ORDER_QTY_COL = 'min-w-[4.5rem] w-[4.5rem] max-w-[4.5rem]'
const ORDER_UNPLANNED_COL = 'min-w-[4.5rem] w-[4.5rem] max-w-[4.5rem]'
const ORDER_QTY_LEFT = 'left-[8.75rem]'
const ORDER_UNPLANNED_LEFT = 'left-[13.25rem]'
const stickyHead = 'sticky z-[2] bg-slate-100'
const stickyBody = 'sticky z-[1] bg-inherit'
const stageCell = 'px-0.5 py-1 text-center align-middle'
const stageInputWrap = 'flex justify-center'

function valuesFromRow(
  row: ProductionPlanBoardRow,
  options?: { remainderQuantity?: number },
): StageDraft {
  if (isProductionPlanRemainderRow(row)) {
    const qty = options?.remainderQuantity ?? Math.max(1, row.unplannedQty ?? row.remainingQty)
    return {
      plannedDate: '',
      plannedQuantity: qty,
      lineNo: row.lineNo && row.lineNo >= 1 ? row.lineNo : 1,
      team: row.team || POST_PROCESS_TEAMS[0],
      pcbSide: row.splitPcbSides ? (row.pcbSide === 'SINGLE' ? 'TOP' : row.pcbSide) : 'SINGLE',
    }
  }

  const base = buildScheduleFormValues(row, row.plannedDate.slice(0, 10) || '')
  return {
    plannedDate: row.plannedDate.slice(0, 10) || '',
    plannedQuantity: base.plannedQuantity,
    lineNo: base.lineNo,
    team: base.team,
    pcbSide: base.pcbSide,
  }
}

function lastCommittedQtyKey(row: ProductionPlanBoardRow, side: StageSide) {
  return `${row.targetId}:${side}`
}

function smtMaterialCap(row: ProductionPlanBoardRow) {
  if (row.scope !== 'smt' || row.materialReadyQty <= 0) return null
  const plannedTotal = row.plannedTotalQty ?? 0
  const own =
    isProductionPlanScheduleRow(row) && row.plannedQuantity ? row.plannedQuantity : 0
  return Math.max(0, row.materialReadyQty - plannedTotal + own)
}

function maxQuantity(row: ProductionPlanBoardRow) {
  let qty = isProductionPlanRemainderRow(row)
    ? Math.max(1, row.unplannedQty ?? row.remainingQty)
    : row.remainingQty

  if (isProductionPlanScheduleRow(row) && row.plannedQuantity) {
    qty = Math.min(row.remainingQty, row.plannedQuantity + (row.unplannedQty ?? 0))
  }
  if (row.scope === 'material' || row.scope === 'post') return Math.max(1, qty)
  const materialCap = smtMaterialCap(row)
  if (materialCap !== null) return Math.max(1, Math.min(qty, materialCap))
  return Math.max(1, qty)
}

function sameDraft(a: StageDraft, b: StageDraft) {
  return (
    a.plannedDate === b.plannedDate &&
    a.plannedQuantity === b.plannedQuantity &&
    a.lineNo === b.lineNo &&
    a.team === b.team &&
    a.pcbSide === b.pcbSide
  )
}

function draftKey(lineKey: string, side: StageSide) {
  return `${lineKey}:${side}`
}

function stageKey(lineKey: string, side: StageSide) {
  return `${lineKey}:${side}`
}

function sideTone(side: StageSide) {
  if (side === 'material') return 'bg-amber-50/40'
  if (side === 'smt') return 'bg-sky-50/40'
  return 'bg-violet-50/40'
}

function isEntryLine(line: UnifiedPlanSheetLine) {
  return line.kind !== 'main'
}

function showEntryCancelLink(line: UnifiedPlanSheetLine, side: StageSide) {
  if (!isEntryLine(line)) return false
  if (line.kind === 'material_entry' && side === 'material') return true
  if (line.kind === 'smt_entry' && side === 'smt') return true
  if (line.kind === 'post_entry' && side === 'post') return true
  return false
}

function OrderInfoCell({ line, countdown }: { line: UnifiedPlanSheetLine; countdown: string | null }) {
  const isMain = line.kind === 'main'
  return (
    <div className={`${ORDER_COL} space-y-0.5 py-0.5 text-xs leading-snug`}>
      <div className="truncate font-semibold text-slate-900" title={line.rep.productName}>
        {line.rep.productName || '-'}
        {line.rep.productKindLabel ? (
          <span className="ml-1 font-normal text-slate-400">{line.rep.productKindLabel}</span>
        ) : null}
      </div>
      <div className="truncate text-slate-600" title={line.rep.customer}>
        {line.rep.customer || '-'}
      </div>
      <div className="truncate font-mono text-[11px] text-slate-500">
        {formatInternalCodeLabel(line.rep.orderNumber)}
      </div>
      <div className="text-[10px] tabular-nums text-slate-500">
        {line.rep.deliveryDate || '-'}
      </div>
      {countdown ? (
        <div className={`text-[10px] font-semibold tabular-nums ${deliveryUrgencyClass(line.rep.daysUntilDelivery)}`}>
          {countdown}
        </div>
      ) : null}
      {line.rowKind === 'smt_work' && isMain ? (
        <div className="text-[10px] font-semibold text-amber-700">
          입 {line.rep.materialReadyQty.toLocaleString('ko-KR')}
        </div>
      ) : null}
    </div>
  )
}

export function ProductionPlanUnifiedSheet({
  lines,
  allRows,
  search,
  onSearchChange,
  savingKeys,
  onSaveActions,
  onMessage,
}: ProductionPlanUnifiedSheetProps) {
  const [drafts, setDrafts] = useState<Record<string, StageDraft>>({})
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
  const lastCommittedQtyRef = useRef<Record<string, number>>({})

  const visibleLines = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lines
    return lines.filter((line) => {
      const haystack = [
        line.rep.orderNumber,
        line.rep.customer,
        line.rep.productName,
        line.rep.deliveryDate,
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [lines, search])

  function remainderDefaultQuantity(row: ProductionPlanBoardRow, side: StageSide) {
    const cap = maxQuantity(row)
    const last = lastCommittedQtyRef.current[lastCommittedQtyKey(row, side)]
    if (last != null && last >= 1) {
      return Math.max(1, Math.min(cap, last))
    }
    const unplanned = Math.max(1, row.unplannedQty ?? row.remainingQty)
    return Math.max(1, Math.min(cap, unplanned))
  }

  function rowBaseline(row: ProductionPlanBoardRow, side: StageSide): StageDraft {
    if (isProductionPlanRemainderRow(row)) {
      return valuesFromRow(row, { remainderQuantity: remainderDefaultQuantity(row, side) })
    }
    return valuesFromRow(row)
  }

  function clearedStageDraft(row: ProductionPlanBoardRow, side: StageSide) {
    return {
      plannedDate: '',
      plannedQuantity: remainderDefaultQuantity(row, side),
    }
  }

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, StageDraft> = {}
      for (const line of visibleLines) {
        for (const side of ['material', 'smt', 'post'] as const) {
          const row =
            side === 'material' ? line.materialRow : side === 'smt' ? line.smtRow : line.postRow
          if (!row) continue
          const key = draftKey(line.key, side)
          next[key] =
            savingKeys.has(row.key) && current[key] ? current[key] : rowBaseline(row, side)
        }
      }
      draftsRef.current = next
      return next
    })
  }, [visibleLines, savingKeys])

  function updateDraft(key: string, patch: Partial<StageDraft>) {
    const current = draftsRef.current[key]
    if (!current) return
    const next = { ...draftsRef.current, [key]: { ...current, ...patch } }
    draftsRef.current = next
    setDrafts(next)
  }

  function handlePlannedDateChange(
    key: string,
    row: ProductionPlanBoardRow,
    side: StageSide,
    plannedDate: string,
  ) {
    if (!plannedDate.trim()) {
      updateDraft(key, clearedStageDraft(row, side))
      return
    }
    updateDraft(key, { plannedDate })
  }

  function isSideBlocked(row: ProductionPlanBoardRow, side: StageSide) {
    if (side === 'smt' && row.status !== 'confirmed' && !canPlanSmt(row)) return true
    if (side === 'post' && row.status !== 'confirmed' && !canEditPostRow(row, allRows)) {
      return true
    }
    return false
  }

  function buildSideAction(
    row: ProductionPlanBoardRow,
    side: StageSide,
    lineKey: string,
  ): ProductionPlanSheetAction | 'blocked' | null {
    const draft = draftsRef.current[draftKey(lineKey, side)]
    if (!draft) return null

    const baseline = rowBaseline(row, side)
    const plannedDate = draft.plannedDate.trim().slice(0, 10)

    if (!plannedDate) {
      if (row.status === 'confirmed') return { type: 'clear', row }
      return null
    }

    if (sameDraft({ ...draft, plannedDate }, baseline)) return null

    if (side === 'smt' && row.status !== 'confirmed' && !canPlanSmt(row)) {
      onMessage('입고 수량을 먼저 입력해 주세요.')
      return 'blocked'
    }

    if (side === 'post') {
      if (row.status !== 'confirmed' && !canPlanPost(row, allRows)) {
        onMessage('SMD 생산계획을 먼저 확정해 주세요.')
        return 'blocked'
      }
      const timing = validatePostPlanDate(row, plannedDate, allRows)
      if (!timing.ok) {
        onMessage(timing.detail)
        return 'blocked'
      }
    }

    const qty = Math.max(1, Math.min(maxQuantity(row), Math.floor(draft.plannedQuantity) || 0))
    return {
      type: 'commit',
      row,
      values: {
        plannedDate,
        plannedQuantity: qty,
        lineNo: draft.lineNo,
        team: draft.team,
        pcbSide: draft.pcbSide,
      },
    }
  }

  async function commitSide(
    row: ProductionPlanBoardRow | null,
    side: StageSide,
    lineKey: string,
  ) {
    if (!row) return
    const action = buildSideAction(row, side, lineKey)
    if (action === 'blocked' || !action) return
    await onSaveActions([action])
    if (action.type === 'commit') {
      lastCommittedQtyRef.current[lastCommittedQtyKey(row, side)] = action.values.plannedQuantity
    }
  }

  function handleStageFieldBlur(
    row: ProductionPlanBoardRow,
    side: StageSide,
    lineKey: string,
  ) {
    window.setTimeout(() => {
      const active = document.activeElement
      if (active?.closest(`[data-stage-key="${stageKey(lineKey, side)}"]`)) return
      void commitSide(row, side, lineKey)
    }, 0)
  }

  function handleStageEnter(
    event: KeyboardEvent,
    row: ProductionPlanBoardRow,
    side: StageSide,
    lineKey: string,
  ) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void commitSide(row, side, lineKey)
    ;(event.currentTarget as HTMLElement).blur()
  }

  function handleSelectChange(
    row: ProductionPlanBoardRow,
    side: StageSide,
    lineKey: string,
    draftKeyName: string,
    patch: Partial<StageDraft>,
  ) {
    updateDraft(draftKeyName, patch)
    window.setTimeout(() => {
      void commitSide(row, side, lineKey)
    }, 0)
  }

  async function cancelConfirmedPlan(
    row: ProductionPlanBoardRow,
    side: StageSide,
    lineKey: string,
  ) {
    if (row.status !== 'confirmed') return
    updateDraft(draftKey(lineKey, side), clearedStageDraft(row, side))
    await onSaveActions([{ type: 'clear', row }])
  }

  function renderEmptyStageCells(count: number) {
    return Array.from({ length: count }, (_, index) => (
      <td key={index} className={`border-r border-slate-100 ${stageCell}`} />
    ))
  }

  function renderStageCancelLink(
    line: UnifiedPlanSheetLine,
    row: ProductionPlanBoardRow,
    side: StageSide,
    saving: boolean,
    disabled: boolean,
  ) {
    if (!showEntryCancelLink(line, side) || row.status !== 'confirmed') return null
    return (
      <button
        type="button"
        disabled={disabled || saving}
        onClick={() => void cancelConfirmedPlan(row, side, line.key)}
        className="mt-0.5 text-[9px] font-semibold text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        취소
      </button>
    )
  }

  function renderMaterialCells(
    line: UnifiedPlanSheetLine,
    row: ProductionPlanBoardRow | null,
    disabled: boolean,
  ) {
    if (!row) {
      return <>{renderEmptyStageCells(2)}</>
    }

    const key = draftKey(line.key, 'material')
    const draft = drafts[key] ?? rowBaseline(row, 'material')
    const saving = savingKeys.has(row.key)
    const blocked = isSideBlocked(row, 'material')
    const tone = sideTone('material')
    const stageAttr = stageKey(line.key, 'material')

    return (
      <>
        <td
          data-stage-key={stageAttr}
          className={`border-r border-slate-100 ${stageCell} ${DATE_COL} ${tone}`}
        >
          <div className="flex flex-col items-center">
            <input
              type="date"
              value={draft.plannedDate}
              disabled={disabled || saving || blocked}
              onChange={(event) =>
                handlePlannedDateChange(key, row, 'material', event.target.value)
              }
              onBlur={() => handleStageFieldBlur(row, 'material', line.key)}
              onKeyDown={(event) => handleStageEnter(event, row, 'material', line.key)}
              className={`${cellInputClass} tabular-nums`}
            />
            {renderStageCancelLink(line, row, 'material', saving, disabled)}
          </div>
        </td>
        <td
          data-stage-key={stageAttr}
          className={`border-r border-slate-300 ${stageCell} ${QTY_COL} ${tone}`}
        >
          <div className={stageInputWrap}>
            <input
              type="number"
              min={1}
              max={maxQuantity(row)}
              value={draft.plannedQuantity}
              disabled={disabled || saving || blocked}
              onChange={(event) =>
                updateDraft(key, {
                  plannedQuantity: Math.max(1, Math.floor(Number(event.target.value) || 0)),
                })
              }
              onBlur={() => handleStageFieldBlur(row, 'material', line.key)}
              onKeyDown={(event) => handleStageEnter(event, row, 'material', line.key)}
              className={`${cellInputClass} text-center tabular-nums`}
            />
          </div>
        </td>
      </>
    )
  }

  function renderSmtCells(line: UnifiedPlanSheetLine, row: ProductionPlanBoardRow | null, disabled: boolean) {
    if (!row) {
      return <>{renderEmptyStageCells(3)}</>
    }

    const key = draftKey(line.key, 'smt')
    const draft = drafts[key] ?? rowBaseline(row, 'smt')
    const saving = savingKeys.has(row.key)
    const blocked = isSideBlocked(row, 'smt')
    const tone = sideTone('smt')
    const stageAttr = stageKey(line.key, 'smt')

    return (
      <>
        <td data-stage-key={stageAttr} className={`border-r border-slate-100 ${stageCell} ${DATE_COL} ${tone}`}>
          <div className="flex flex-col items-center">
            <input
              type="date"
              value={draft.plannedDate}
              disabled={disabled || saving || blocked}
              onChange={(event) => handlePlannedDateChange(key, row, 'smt', event.target.value)}
              onBlur={() => handleStageFieldBlur(row, 'smt', line.key)}
              onKeyDown={(event) => handleStageEnter(event, row, 'smt', line.key)}
              className={`${cellInputClass} tabular-nums`}
            />
            {renderStageCancelLink(line, row, 'smt', saving, disabled)}
          </div>
        </td>
        <td data-stage-key={stageAttr} className={`border-r border-slate-100 ${stageCell} ${QTY_COL} ${tone}`}>
          <div className={stageInputWrap}>
            <input
              type="number"
              min={1}
              max={maxQuantity(row)}
              value={draft.plannedQuantity}
              disabled={disabled || saving || blocked}
              onChange={(event) =>
                updateDraft(key, {
                  plannedQuantity: Math.max(1, Math.floor(Number(event.target.value) || 0)),
                })
              }
              onBlur={() => handleStageFieldBlur(row, 'smt', line.key)}
              onKeyDown={(event) => handleStageEnter(event, row, 'smt', line.key)}
              className={`${cellInputClass} text-center tabular-nums`}
            />
          </div>
        </td>
        <td
          data-stage-key={stageAttr}
          className={`border-r border-slate-300 ${stageCell} ${LINE_COL} ${tone}`}
        >
          <div className={stageInputWrap}>
            <select
              value={draft.lineNo}
              disabled={disabled || saving || blocked}
              onChange={(event) =>
                handleSelectChange(row, 'smt', line.key, key, {
                  lineNo: Number(event.target.value),
                })
              }
              onBlur={() => handleStageFieldBlur(row, 'smt', line.key)}
              className={`${cellInputClass} text-center text-[11px] text-slate-600`}
            >
              {SMT_PLAN_LINE_NOS.map((lineNo) => (
                <option key={lineNo} value={lineNo}>
                  {lineNo}
                </option>
              ))}
            </select>
          </div>
        </td>
      </>
    )
  }

  function renderPostCells(line: UnifiedPlanSheetLine, row: ProductionPlanBoardRow | null, disabled: boolean) {
    if (!row) {
      return <>{renderEmptyStageCells(3)}</>
    }

    const key = draftKey(line.key, 'post')
    const draft = drafts[key] ?? rowBaseline(row, 'post')
    const saving = savingKeys.has(row.key)
    const blocked = isSideBlocked(row, 'post')
    const tone = sideTone('post')
    const stageAttr = stageKey(line.key, 'post')

    return (
      <>
        <td data-stage-key={stageAttr} className={`border-r border-slate-100 ${stageCell} ${DATE_COL} ${tone}`}>
          <div className="flex flex-col items-center">
            <input
              type="date"
              value={draft.plannedDate}
              disabled={disabled || saving || blocked}
              onChange={(event) => handlePlannedDateChange(key, row, 'post', event.target.value)}
              onBlur={() => handleStageFieldBlur(row, 'post', line.key)}
              onKeyDown={(event) => handleStageEnter(event, row, 'post', line.key)}
              className={`${cellInputClass} tabular-nums`}
            />
            {renderStageCancelLink(line, row, 'post', saving, disabled)}
          </div>
          {blocked && row.status !== 'confirmed' ? (
            <div className="truncate text-[9px] font-semibold text-violet-700" title="SMD 확정 후">
              SMD후
            </div>
          ) : null}
        </td>
        <td data-stage-key={stageAttr} className={`border-r border-slate-100 ${stageCell} ${QTY_COL} ${tone}`}>
          <div className={stageInputWrap}>
            <input
              type="number"
              min={1}
              max={maxQuantity(row)}
              value={draft.plannedQuantity}
              disabled={disabled || saving || blocked}
              onChange={(event) =>
                updateDraft(key, {
                  plannedQuantity: Math.max(1, Math.floor(Number(event.target.value) || 0)),
                })
              }
              onBlur={() => handleStageFieldBlur(row, 'post', line.key)}
              onKeyDown={(event) => handleStageEnter(event, row, 'post', line.key)}
              className={`${cellInputClass} text-center tabular-nums`}
            />
          </div>
        </td>
        <td data-stage-key={stageAttr} className={`border-r border-slate-300 ${stageCell} ${TEAM_COL} ${tone}`}>
          <div className={stageInputWrap}>
            <select
              value={draft.team}
              disabled={disabled || saving || blocked}
              onChange={(event) =>
                handleSelectChange(row, 'post', line.key, key, { team: event.target.value })
              }
              onBlur={() => handleStageFieldBlur(row, 'post', line.key)}
              className={`${cellInputClass} text-center text-[11px] text-slate-600`}
            >
              {POST_PROCESS_TEAMS.map((team) => (
                <option key={team} value={team}>
                  {team.replace('생산', '')}
                </option>
              ))}
            </select>
          </div>
        </td>
      </>
    )
  }

  function stageDisabled(line: UnifiedPlanSheetLine, side: StageSide) {
    if (line.kind === 'material_entry') return side !== 'material'
    if (line.kind === 'smt_entry') return side !== 'smt'
    if (line.kind === 'post_entry') return side !== 'post'
    if (line.rowKind === 'post_work') return side !== 'post'
    if (line.rowKind === 'smt_work') return side === 'post'
    return false
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-2.5">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="발주번호, 고객사, 제품명 검색…"
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
        />
        <p className="text-xs text-slate-500">
          Tab·다른 칸 클릭·Enter 로 자동 저장됩니다. 계획 취소는 계획일을 지우거나 「취소」를 누르세요.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-[3] bg-slate-100 text-slate-700">
            <tr className="border-b border-slate-300 text-xs font-bold">
              <th
                className={`${stickyHead} left-0 ${ORDER_COL} border-r border-slate-200 px-1.5 py-2 text-left shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`}
                rowSpan={2}
              >
                발주
              </th>
              <th
                className={`${stickyHead} ${ORDER_QTY_LEFT} ${ORDER_QTY_COL} border-r border-slate-200 bg-slate-100 px-1 py-2 text-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`}
                rowSpan={2}
              >
                잔량
              </th>
              <th
                className={`${stickyHead} ${ORDER_UNPLANNED_LEFT} ${ORDER_UNPLANNED_COL} border-r border-slate-300 bg-slate-100 px-1 py-2 text-center shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]`}
                rowSpan={2}
              >
                미계획
              </th>
              <th
                className="border-r border-slate-300 bg-amber-50 px-2 py-1 text-center text-amber-900"
                colSpan={2}
              >
                자재
              </th>
              <th
                className="border-r border-slate-300 bg-sky-50 px-2 py-1 text-center text-sky-900"
                colSpan={3}
              >
                SMT
              </th>
              <th className="bg-violet-50 px-2 py-1 text-center text-violet-900" colSpan={3}>
                후공정
              </th>
            </tr>
            <tr className="border-b border-slate-300 text-[11px] font-bold">
              <th className={`border-r border-slate-200 bg-amber-50 px-1 py-1.5 text-center text-amber-900 ${DATE_COL}`}>
                입고일
              </th>
              <th className={`border-r border-slate-300 bg-amber-50 px-1 py-1.5 text-center text-amber-900 ${QTY_COL}`}>
                입고수량
              </th>
              <th className={`border-r border-slate-200 bg-sky-50 px-1 py-1.5 text-center text-sky-900 ${DATE_COL}`}>
                계획일
              </th>
              <th className={`border-r border-slate-200 bg-sky-50 px-1 py-1.5 text-center text-sky-900 ${QTY_COL}`}>
                수량
              </th>
              <th className={`border-r border-slate-300 bg-sky-50 px-1 py-1.5 text-center text-sky-900 ${LINE_COL}`}>
                라인
              </th>
              <th className={`border-r border-slate-200 bg-violet-50 px-1 py-1.5 text-center text-violet-900 ${DATE_COL}`}>
                계획일
              </th>
              <th className={`border-r border-slate-200 bg-violet-50 px-1 py-1.5 text-center text-violet-900 ${QTY_COL}`}>
                수량
              </th>
              <th className={`border-r border-slate-300 bg-violet-50 px-1 py-1.5 text-center text-violet-900 ${TEAM_COL}`}>
                팀
              </th>
            </tr>
          </thead>
          <tbody>
            {!visibleLines.length ? (
              <tr>
                <td colSpan={11} className="px-4 py-16 text-center text-slate-400">
                  {search.trim() ? '검색 결과 없음' : '표시할 생산계획 항목이 없습니다'}
                </td>
              </tr>
            ) : (
              visibleLines.map((line) => {
                const countdown = formatDeliveryCountdown(line.rep.daysUntilDelivery)
                const isMain = line.kind === 'main'
                const rowBg =
                  isMain && line.rowKind === 'post_work'
                    ? 'bg-violet-50/20'
                    : isMain
                      ? 'bg-sky-50/30'
                      : 'bg-white'

                return (
                  <tr
                    key={line.key}
                    className={`border-b border-slate-100 ${rowBg} ${
                      isMain
                        ? line.rowKind === 'post_work'
                          ? 'border-l-4 border-l-violet-400'
                          : 'border-l-4 border-l-sky-400'
                        : ''
                    }`}
                  >
                    <td
                      className={`${stickyBody} left-0 ${ORDER_COL} border-r border-slate-200 px-1.5 py-1 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${rowBg}`}
                    >
                      <OrderInfoCell line={line} countdown={countdown} />
                    </td>
                    <td
                      className={`${stickyBody} ${ORDER_QTY_LEFT} ${ORDER_QTY_COL} border-r border-slate-200 px-1 py-1 text-center text-xs tabular-nums text-slate-700 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${rowBg}`}
                    >
                      {line.rep.remainingQty.toLocaleString('ko-KR')}
                    </td>
                    <td
                      className={`${stickyBody} ${ORDER_UNPLANNED_LEFT} ${ORDER_UNPLANNED_COL} border-r border-slate-300 px-1 py-1 text-center text-xs font-semibold tabular-nums shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${rowBg} ${
                        lineUnplannedQty(line) > 0 ? 'text-sky-700' : 'text-slate-400'
                      }`}
                    >
                      {lineUnplannedQty(line).toLocaleString('ko-KR')}
                    </td>

                    {renderMaterialCells(
                      line,
                      line.materialRow,
                      stageDisabled(line, 'material'),
                    )}
                    {renderSmtCells(line, line.smtRow, stageDisabled(line, 'smt'))}
                    {renderPostCells(line, line.postRow, stageDisabled(line, 'post'))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
