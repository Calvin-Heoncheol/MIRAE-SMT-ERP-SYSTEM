'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buildScheduleFormValues } from '@/components/production-plan/production-plan-schedule-modal'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import { isYmdInMonth } from '@/lib/production-plan/calendar'
import {
  canPlanPost,
  materialStatusLabel,
  validatePostPlanDate,
} from '@/lib/production-plan/pipeline'
import {
  deliveryUrgencyClass,
  formatDeliveryCountdown,
  isProductionPlanRemainderRow,
  isProductionPlanScheduleRow,
} from '@/lib/production-plan/utils'
import type {
  ProductionPlanBoardRow,
  ProductionPlanPcbSide,
  ProductionPlanScope,
  ProductionPlanSheetFilter,
} from '@/lib/production-plan/types'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import { SMT_PLAN_LINE_NOS } from '@/lib/smt/plan/config'

export type ProductionPlanSheetValues = {
  plannedDate: string
  plannedQuantity: number
  lineNo: number
  team: string
  pcbSide: ProductionPlanPcbSide
}

type ScopeDraft = ProductionPlanSheetValues

type ProductionPlanSheetProps = {
  allRows: ProductionPlanBoardRow[]
  activeScope: ProductionPlanScope
  monthStart: string
  sheetFilter: ProductionPlanSheetFilter
  search: string
  onSearchChange: (value: string) => void
  savingKeys: ReadonlySet<string>
  onSaveActions: (actions: ProductionPlanSheetAction[]) => void | Promise<void>
  onMessage: (message: string) => void
  onSelectRow?: (row: ProductionPlanBoardRow) => void
}

export type ProductionPlanSheetAction =
  | { type: 'commit'; row: ProductionPlanBoardRow; values: ProductionPlanSheetValues }
  | { type: 'clear'; row: ProductionPlanBoardRow }

const cellInputClass =
  'h-7 w-full min-w-0 rounded border border-transparent bg-transparent px-1 text-xs outline-none transition hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50'

const STAGE_COL_CLASS = 'w-[7.5rem] min-w-[7.5rem] max-w-[7.5rem]'

const SCOPE_HINT: Record<ProductionPlanScope, string> = {
  material:
    '입고일·입고수량 입력 후 저장하세요. 일부만 계획하면 「추가 배정」 행이 생깁니다. 확정 행은 삭제 버튼으로 해제할 수 있습니다.',
  smt:
    '계획일·수량·라인 입력 후 저장하세요. 일부만 계획하면 「추가 배정」 행이 생깁니다. 확정 행은 삭제 버튼으로 해제할 수 있습니다.',
  post:
    'SMD 확정 후 계획일·수량·팀을 입력하고 저장하세요. 확정 행은 삭제 버튼으로 해제할 수 있습니다.',
}

function valuesFromRow(row: ProductionPlanBoardRow): ScopeDraft {
  const isRemainder = isProductionPlanRemainderRow(row)
  if (isRemainder) {
    const qty = Math.max(1, row.unplannedQty ?? row.remainingQty)
    return {
      plannedDate: '',
      plannedQuantity: qty,
      lineNo: row.lineNo && row.lineNo >= 1 ? row.lineNo : 1,
      team: row.team || POST_PROCESS_TEAMS[0],
      pcbSide: row.splitPcbSides ? row.pcbSide === 'SINGLE' ? 'TOP' : row.pcbSide : 'SINGLE',
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

function schedulableQuantity(row: ProductionPlanBoardRow) {
  if (isProductionPlanRemainderRow(row)) {
    return Math.max(1, row.unplannedQty ?? row.remainingQty)
  }
  return row.remainingQty
}

function maxQuantity(row: ProductionPlanBoardRow) {
  let qty = schedulableQuantity(row)
  if (isProductionPlanScheduleRow(row) && row.plannedQuantity) {
    qty = Math.min(row.remainingQty, row.plannedQuantity + (row.unplannedQty ?? 0))
  }
  if (row.scope === 'material') return Math.max(1, qty)
  if (row.materialShort && row.materialReadyQty > 0) {
    return Math.min(qty, row.materialReadyQty)
  }
  return Math.max(1, qty)
}

function sameValues(a: ScopeDraft, b: ScopeDraft) {
  return (
    a.plannedDate === b.plannedDate &&
    a.plannedQuantity === b.plannedQuantity &&
    a.lineNo === b.lineNo &&
    a.team === b.team &&
    a.pcbSide === b.pcbSide
  )
}

function includeBoardRow(
  row: ProductionPlanBoardRow,
  monthStart: string,
  sheetFilter: ProductionPlanSheetFilter,
) {
  if (sheetFilter === 'all_pending') {
    if (isProductionPlanRemainderRow(row)) return true
    if (row.status === 'waiting') return true
    if ((row.unplannedQty ?? 0) > 0) return true
    return false
  }

  if (isProductionPlanRemainderRow(row)) return true
  if (row.status === 'waiting') return true
  return row.status === 'confirmed' && isYmdInMonth(row.plannedDate, monthStart)
}

function buildScopeSheetRows(
  rows: ProductionPlanBoardRow[],
  scope: ProductionPlanScope,
  monthStart: string,
  sheetFilter: ProductionPlanSheetFilter,
) {
  return rows
    .filter((row) => row.scope === scope && includeBoardRow(row, monthStart, sheetFilter))
    .sort((a, b) => {
      const aRemainder = isProductionPlanRemainderRow(a) ? 1 : 0
      const bRemainder = isProductionPlanRemainderRow(b) ? 1 : 0
      if (aRemainder !== bRemainder) return bRemainder - aRemainder
      const aDue = a.daysUntilDelivery ?? 9999
      const bDue = b.daysUntilDelivery ?? 9999
      if (aDue !== bDue) return aDue - bDue
      if (a.orderNumber !== b.orderNumber) return a.orderNumber.localeCompare(b.orderNumber)
      return a.plannedDate.localeCompare(b.plannedDate)
    })
}

function filterRows(rows: ProductionPlanBoardRow[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => {
    const haystack = [row.orderNumber, row.customer, row.productName, row.deliveryDate]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function ProductionPlanSheet({
  allRows,
  activeScope,
  monthStart,
  sheetFilter,
  search,
  onSearchChange,
  savingKeys,
  onSaveActions,
  onMessage,
}: ProductionPlanSheetProps) {
  const sheetRows = useMemo(
    () => filterRows(buildScopeSheetRows(allRows, activeScope, monthStart, sheetFilter), search),
    [allRows, activeScope, monthStart, sheetFilter, search],
  )

  const [drafts, setDrafts] = useState<Record<string, ScopeDraft>>({})
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, ScopeDraft> = {}
      for (const row of sheetRows) {
        if (savingKeys.has(row.key) && current[row.key]) {
          next[row.key] = current[row.key]
        } else {
          next[row.key] = valuesFromRow(row)
        }
      }
      draftsRef.current = next
      return next
    })
  }, [sheetRows, savingKeys])

  function updateDraft(rowKey: string, patch: Partial<ScopeDraft>) {
    const current = draftsRef.current[rowKey]
    if (!current) return
    const next = { ...draftsRef.current, [rowKey]: { ...current, ...patch } }
    draftsRef.current = next
    setDrafts(next)
  }

  function buildRowAction(row: ProductionPlanBoardRow): ProductionPlanSheetAction | 'blocked' | null {
    const draft = draftsRef.current[row.key]
    if (!draft) return null

    const baseline = valuesFromRow(row)
    const plannedDate = draft.plannedDate.trim().slice(0, 10)

    if (!plannedDate) {
      if (row.status === 'confirmed') return { type: 'clear', row }
      return null
    }

    if (sameValues({ ...draft, plannedDate }, baseline)) return null

    if (row.scope === 'post') {
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

  function isRowDirty(row: ProductionPlanBoardRow) {
    const draft = drafts[row.key]
    if (!draft) return false
    const baseline = valuesFromRow(row)
    const plannedDate = draft.plannedDate.trim().slice(0, 10)
    if (!plannedDate) return row.status === 'confirmed'
    return !sameValues({ ...draft, plannedDate }, baseline)
  }

  async function commitRow(row: ProductionPlanBoardRow) {
    const action = buildRowAction(row)
    if (action === 'blocked' || !action) return
    await onSaveActions([action])
  }

  async function deleteRow(row: ProductionPlanBoardRow) {
    if (!isProductionPlanScheduleRow(row)) return
    await onSaveActions([{ type: 'clear', row }])
  }

  function renderDateQtyInputs(
    row: ProductionPlanBoardRow,
    draft: ScopeDraft,
    options?: { disabled?: boolean; hint?: string; extra?: ReactNode },
  ) {
    const disabled = Boolean(options?.disabled)

    return (
      <>
        <td className={`border-r border-slate-100 px-1 py-1 ${STAGE_COL_CLASS}`}>
          <div className="space-y-0.5">
            <input
              type="date"
              value={draft.plannedDate}
              disabled={disabled}
              onChange={(event) => updateDraft(row.key, { plannedDate: event.target.value })}
              className={`${cellInputClass} tabular-nums`}
            />
            {options?.extra}
            {options?.hint ? (
              <div className="px-0.5 text-[10px] font-semibold text-amber-700">{options.hint}</div>
            ) : null}
          </div>
        </td>
        <td className={`border-r border-slate-100 px-1 py-1 ${STAGE_COL_CLASS}`}>
          <input
            type="number"
            min={1}
            max={maxQuantity(row)}
            value={draft.plannedQuantity}
            disabled={disabled}
            onChange={(event) =>
              updateDraft(row.key, {
                plannedQuantity: Math.max(1, Math.floor(Number(event.target.value) || 0)),
              })
            }
            className={`${cellInputClass} text-right tabular-nums`}
          />
        </td>
      </>
    )
  }

  const dateLabel =
    activeScope === 'material' ? '입고일' : activeScope === 'smt' ? '계획일' : '계획일'
  const qtyLabel =
    activeScope === 'material' ? '입고수량' : activeScope === 'smt' ? '계획수량' : '계획수량'
  const headerTone =
    activeScope === 'material'
      ? 'bg-amber-50 text-amber-900'
      : activeScope === 'smt'
        ? 'bg-sky-50 text-sky-900'
        : 'bg-violet-50 text-violet-900'

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
          {SCOPE_HINT[activeScope]}
          {sheetFilter === 'all_pending' ? ' · 미완료·추가 배정 대상만 표시 중입니다.' : ' · 이번 달 계획과 미배정 잔량을 표시 중입니다.'}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[5.5rem]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[16%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[7.5rem]" />
            <col className="w-[7.5rem]" />
            {activeScope !== 'material' ? <col className="w-[6.5rem]" /> : null}
            <col className="w-[4.5rem]" />
            <col className="w-[4.5rem]" />
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-slate-100 text-slate-700">
            <tr className="border-b border-slate-300 text-left text-xs font-bold">
              <th className="border-r border-slate-200 px-2 py-2">상태</th>
              <th className="border-r border-slate-200 px-2 py-2">고객사</th>
              <th className="border-r border-slate-200 px-2 py-2">발주번호</th>
              <th className="border-r border-slate-200 px-2 py-2">제품</th>
              <th className="border-r border-slate-200 px-2 py-2 text-right">수량</th>
              <th className="border-r border-slate-200 px-2 py-2">납기</th>
              <th className={`border-r border-slate-200 px-2 py-2 ${headerTone}`}>{dateLabel}</th>
              <th className={`border-r border-slate-200 px-2 py-2 text-right ${headerTone}`}>
                {qtyLabel}
              </th>
              {activeScope !== 'material' ? (
                <th className={`border-r border-slate-200 px-2 py-2 ${headerTone}`}>
                  {activeScope === 'smt' ? '라인' : '팀'}
                </th>
              ) : null}
              <th className="px-2 py-2 text-center">저장</th>
              <th className="px-2 py-2 text-center">삭제</th>
            </tr>
          </thead>
          <tbody>
            {!sheetRows.length ? (
              <tr>
                <td colSpan={activeScope === 'material' ? 10 : 11} className="px-4 py-16 text-center text-slate-400">
                  {search.trim() ? '검색 결과 없음' : '표시할 생산계획 항목이 없습니다'}
                </td>
              </tr>
            ) : (
              sheetRows.map((row) => {
                const draft = drafts[row.key] ?? valuesFromRow(row)
                const countdown = formatDeliveryCountdown(row.daysUntilDelivery)
                const rowSaving = savingKeys.has(row.key)
                const dirty = isRowDirty(row)
                const postEditable =
                  row.scope !== 'post' ||
                  row.status === 'confirmed' ||
                  canPlanPost(row, allRows)
                const materialLabel = materialStatusLabel(row.materialInboundStatus)
                const isRemainder = isProductionPlanRemainderRow(row)
                const isSchedule = isProductionPlanScheduleRow(row)

                return (
                  <tr
                    key={row.key}
                    className={`border-b border-slate-100 ${
                      isRemainder
                        ? 'border-l-4 border-l-sky-400 bg-sky-50/50'
                        : 'odd:bg-white even:bg-slate-50/60'
                    } ${dirty ? 'bg-amber-50/40' : ''}`}
                  >
                    <td className="border-r border-slate-100 px-2 py-1.5">
                      {isRemainder ? (
                        <span className="inline-flex rounded-md bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          추가 배정
                        </span>
                      ) : isSchedule ? (
                        <span className="inline-flex rounded-md bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          확정
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-slate-300 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                          대기
                        </span>
                      )}
                    </td>
                    <td
                      className="truncate border-r border-slate-100 px-2 py-1.5 text-slate-700"
                      title={row.customer}
                    >
                      {row.customer || '-'}
                    </td>
                    <td className="truncate border-r border-slate-100 px-2 py-1.5 font-mono text-xs text-slate-600">
                      {formatInternalCodeLabel(row.orderNumber)}
                    </td>
                    <td
                      className="truncate border-r border-slate-100 px-2 py-1.5 font-medium text-slate-900"
                      title={row.productName}
                    >
                      {row.productName || '-'}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-800">
                      <div>{row.orderQty.toLocaleString('ko-KR')}</div>
                      <div className="text-[10px] text-slate-400">
                        {isRemainder ? (
                          <>미계획 {(row.unplannedQty ?? row.remainingQty).toLocaleString('ko-KR')}</>
                        ) : (
                          <>
                            잔량 {row.remainingQty.toLocaleString('ko-KR')}
                            {(row.plannedTotalQty ?? 0) > 0 ? (
                              <> · 계획됨 {row.plannedTotalQty!.toLocaleString('ko-KR')}</>
                            ) : null}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="border-r border-slate-100 px-2 py-1.5">
                      <div className="text-slate-700">{row.deliveryDate || '-'}</div>
                      {countdown ? (
                        <div
                          className={`text-[10px] font-semibold tabular-nums ${deliveryUrgencyClass(row.daysUntilDelivery)}`}
                        >
                          {countdown}
                        </div>
                      ) : null}
                    </td>

                    {renderDateQtyInputs(row, draft, {
                      disabled: rowSaving || !postEditable,
                      hint: !postEditable
                        ? 'SMD 확정 후'
                        : isRemainder
                          ? '추가 배정 필요'
                          : materialLabel || undefined,
                      extra:
                        activeScope === 'material' && row.materialExpectedReadyDate ? (
                          <div className="px-0.5 text-[10px] text-slate-400">
                            입고예정 {row.materialExpectedReadyDate}
                          </div>
                        ) : null,
                    })}

                    {activeScope === 'smt' ? (
                      <td className={`border-r border-slate-100 px-1 py-1 ${STAGE_COL_CLASS}`}>
                        <select
                          value={draft.lineNo}
                          disabled={rowSaving}
                          onChange={(event) =>
                            updateDraft(row.key, { lineNo: Number(event.target.value) })
                          }
                          className={`${cellInputClass} text-[11px] text-slate-600`}
                          title="SMT 라인"
                        >
                          {SMT_PLAN_LINE_NOS.map((lineNo) => (
                            <option key={lineNo} value={lineNo}>
                              L{lineNo}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}

                    {activeScope === 'post' ? (
                      <td className={`border-r border-slate-100 px-1 py-1 ${STAGE_COL_CLASS}`}>
                        <select
                          value={draft.team}
                          disabled={!postEditable || rowSaving}
                          onChange={(event) => updateDraft(row.key, { team: event.target.value })}
                          className={`${cellInputClass} text-[11px] text-slate-600`}
                          title="후공정 팀"
                        >
                          {POST_PROCESS_TEAMS.map((team) => (
                            <option key={team} value={team}>
                              {team}
                            </option>
                          ))}
                        </select>
                      </td>
                    ) : null}

                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        disabled={!dirty || rowSaving || !postEditable}
                        onClick={() => void commitRow(row)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                          dirty && !rowSaving && postEditable
                            ? 'bg-slate-800 text-white hover:bg-slate-700'
                            : 'cursor-not-allowed bg-slate-200 text-slate-400'
                        }`}
                      >
                        {rowSaving ? '저장 중…' : '저장'}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        disabled={!isSchedule || rowSaving}
                        onClick={() => void deleteRow(row)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                          isSchedule && !rowSaving
                            ? 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'cursor-not-allowed border border-transparent bg-slate-100 text-slate-300'
                        }`}
                      >
                        {rowSaving ? '…' : '삭제'}
                      </button>
                    </td>
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
