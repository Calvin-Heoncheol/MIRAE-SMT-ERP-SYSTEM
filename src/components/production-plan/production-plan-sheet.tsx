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
} from '@/lib/production-plan/utils'
import type {
  ProductionPlanBoardRow,
  ProductionPlanPcbSide,
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
type SheetScope = 'material' | 'smt' | 'post'

type GroupDraft = {
  material: ScopeDraft | null
  smt: ScopeDraft | null
  post: ScopeDraft | null
}

type SheetGroup = {
  key: string
  customer: string
  orderNumber: string
  productName: string
  orderQty: number
  remainingQty: number
  deliveryDate: string
  daysUntilDelivery: number | null
  materialStatus?: ProductionPlanBoardRow['materialInboundStatus']
  materialHintDate: string
  material: ProductionPlanBoardRow | null
  smt: ProductionPlanBoardRow | null
  post: ProductionPlanBoardRow | null
}

type ProductionPlanSheetProps = {
  allRows: ProductionPlanBoardRow[]
  monthStart: string
  search: string
  onSearchChange: (value: string) => void
  savingKeys: ReadonlySet<string>
  onSaveActions: (actions: ProductionPlanSheetAction[]) => void | Promise<void>
  onMessage: (message: string) => void
}

export type ProductionPlanSheetAction =
  | { type: 'commit'; row: ProductionPlanBoardRow; values: ProductionPlanSheetValues }
  | { type: 'clear'; row: ProductionPlanBoardRow }

const cellInputClass =
  'h-7 w-full min-w-0 rounded border border-transparent bg-transparent px-1 text-xs outline-none transition hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-50'

const STAGE_COL_CLASS = 'w-[7.5rem] min-w-[7.5rem] max-w-[7.5rem]'

function valuesFromRow(row: ProductionPlanBoardRow): ScopeDraft {
  const base = buildScheduleFormValues(row, row.plannedDate.slice(0, 10) || '')
  return {
    plannedDate: row.plannedDate.slice(0, 10) || '',
    plannedQuantity: base.plannedQuantity,
    lineNo: base.lineNo,
    team: base.team,
    pcbSide: base.pcbSide,
  }
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

function maxQuantity(row: ProductionPlanBoardRow) {
  if (row.scope === 'material') return Math.max(1, row.remainingQty)
  if (row.materialShort && row.materialReadyQty > 0) {
    return Math.min(row.remainingQty, row.materialReadyQty)
  }
  return Math.max(1, row.remainingQty)
}

function rowOf(group: SheetGroup, scope: SheetScope) {
  return group[scope]
}

function buildSheetGroups(rows: ProductionPlanBoardRow[], monthStart: string): SheetGroup[] {
  const materialRows = rows.filter((row) => row.scope === 'material')
  const smtRows = rows.filter((row) => row.scope === 'smt')
  const postRows = rows.filter((row) => row.scope === 'post')
  const usedPost = new Set<string>()
  const groups: SheetGroup[] = []

  function includeBoardRow(row: ProductionPlanBoardRow) {
    if (row.status === 'waiting') return true
    return row.status === 'confirmed' && isYmdInMonth(row.plannedDate, monthStart)
  }

  for (const smt of smtRows) {
    const material =
      materialRows.find((entry) => entry.targetId === smt.targetId) || null
    let post =
      postRows.find(
        (entry) =>
          !usedPost.has(entry.key) &&
          entry.orderId === smt.orderId &&
          entry.productId &&
          entry.productId === smt.productId,
      ) || null
    if (!post) {
      post =
        postRows.find((entry) => !usedPost.has(entry.key) && entry.orderId === smt.orderId) || null
    }
    if (post) usedPost.add(post.key)

    const visible =
      includeBoardRow(smt) ||
      (material ? includeBoardRow(material) : false) ||
      (post ? includeBoardRow(post) : false)
    if (!visible) continue

    groups.push({
      key: `group:${smt.key}`,
      customer: smt.customer,
      orderNumber: smt.orderNumber,
      productName: smt.productName,
      orderQty: smt.orderQty,
      remainingQty: smt.remainingQty,
      deliveryDate: smt.deliveryDate,
      daysUntilDelivery: smt.daysUntilDelivery,
      materialStatus: (material || smt).materialInboundStatus,
      materialHintDate: (material || smt).materialExpectedReadyDate || '',
      material,
      smt,
      post,
    })
  }

  for (const post of postRows) {
    if (usedPost.has(post.key)) continue
    if (!includeBoardRow(post)) continue
    groups.push({
      key: `group:${post.key}`,
      customer: post.customer,
      orderNumber: post.orderNumber,
      productName: post.productName,
      orderQty: post.orderQty,
      remainingQty: post.remainingQty,
      deliveryDate: post.deliveryDate,
      daysUntilDelivery: post.daysUntilDelivery,
      materialStatus: post.materialInboundStatus,
      materialHintDate: post.materialExpectedReadyDate || '',
      material: null,
      smt: null,
      post,
    })
  }

  return groups.sort((a, b) => {
    const aDue = a.daysUntilDelivery ?? 9999
    const bDue = b.daysUntilDelivery ?? 9999
    if (aDue !== bDue) return aDue - bDue
    return b.orderNumber.localeCompare(a.orderNumber)
  })
}

function filterGroups(groups: SheetGroup[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return groups
  return groups.filter((group) => {
    const haystack = [group.orderNumber, group.customer, group.productName, group.deliveryDate]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

function draftFromGroup(group: SheetGroup): GroupDraft {
  return {
    material: group.material ? valuesFromRow(group.material) : null,
    smt: group.smt ? valuesFromRow(group.smt) : null,
    post: group.post ? valuesFromRow(group.post) : null,
  }
}

export function ProductionPlanSheet({
  allRows,
  monthStart,
  search,
  onSearchChange,
  savingKeys,
  onSaveActions,
  onMessage,
}: ProductionPlanSheetProps) {
  const groups = useMemo(
    () => filterGroups(buildSheetGroups(allRows, monthStart), search),
    [allRows, monthStart, search],
  )

  const [drafts, setDrafts] = useState<Record<string, GroupDraft>>({})
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts

  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, GroupDraft> = {}
      for (const group of groups) {
        const saving =
          (group.material && savingKeys.has(group.material.key)) ||
          (group.smt && savingKeys.has(group.smt.key)) ||
          (group.post && savingKeys.has(group.post.key))
        if (saving && current[group.key]) {
          next[group.key] = current[group.key]
        } else {
          next[group.key] = draftFromGroup(group)
        }
      }
      draftsRef.current = next
      return next
    })
  }, [groups, savingKeys])

  function updateScopeDraft(
    groupKey: string,
    scope: SheetScope,
    patch: Partial<ScopeDraft>,
  ) {
    const current = draftsRef.current[groupKey]
    if (!current?.[scope]) return
    const next: GroupDraft = {
      ...current,
      [scope]: { ...current[scope]!, ...patch },
    }
    const all = { ...draftsRef.current, [groupKey]: next }
    draftsRef.current = all
    setDrafts(all)
  }

  function buildScopeAction(
    group: SheetGroup,
    scope: SheetScope,
    options?: { assumeSmtDate?: string },
  ): ProductionPlanSheetAction | 'blocked' | null {
    const row = rowOf(group, scope)
    const draft = draftsRef.current[group.key]?.[scope]
    if (!row || !draft) return null

    const baseline = valuesFromRow(row)
    const plannedDate = draft.plannedDate.trim().slice(0, 10)

    if (!plannedDate) {
      if (row.status === 'confirmed') return { type: 'clear', row }
      return null
    }

    if (sameValues({ ...draft, plannedDate }, baseline)) return null

    if (scope === 'post') {
      const canPost =
        row.status === 'confirmed' ||
        canPlanPost(row, allRows) ||
        Boolean(options?.assumeSmtDate)
      if (!canPost) {
        onMessage('SMD 생산계획을 먼저 확정해 주세요.')
        return 'blocked'
      }
      if (options?.assumeSmtDate && plannedDate < options.assumeSmtDate) {
        onMessage(
          `후공정 시작(${plannedDate})이 SMD 종료(${options.assumeSmtDate})보다 빠릅니다. SMD 종료 이후로 잡아 주세요.`,
        )
        return 'blocked'
      }
      if (!options?.assumeSmtDate) {
        const timing = validatePostPlanDate(row, plannedDate, allRows)
        if (!timing.ok) {
          onMessage(timing.detail)
          return 'blocked'
        }
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

  function isScopeDirty(group: SheetGroup, scope: SheetScope) {
    const row = rowOf(group, scope)
    const draft = drafts[group.key]?.[scope]
    if (!row || !draft) return false
    const baseline = valuesFromRow(row)
    const plannedDate = draft.plannedDate.trim().slice(0, 10)
    if (!plannedDate) return row.status === 'confirmed'
    return !sameValues({ ...draft, plannedDate }, baseline)
  }

  function isGroupDirty(group: SheetGroup) {
    return (
      isScopeDirty(group, 'material') ||
      isScopeDirty(group, 'smt') ||
      isScopeDirty(group, 'post')
    )
  }

  async function commitGroup(group: SheetGroup) {
    const actions: ProductionPlanSheetAction[] = []
    const smtDraftDate = draftsRef.current[group.key]?.smt?.plannedDate.trim().slice(0, 10) || ''

    for (const scope of ['material', 'smt'] as const) {
      if (!isScopeDirty(group, scope)) continue
      const action = buildScopeAction(group, scope)
      if (action === 'blocked') return
      if (action) actions.push(action)
    }

    if (isScopeDirty(group, 'post')) {
      const assumeSmtDate =
        actions.some((action) => action.type === 'commit' && action.row.scope === 'smt') &&
        smtDraftDate
          ? smtDraftDate
          : undefined
      const postAction = buildScopeAction(group, 'post', { assumeSmtDate })
      if (postAction === 'blocked') return
      if (postAction) actions.push(postAction)
    }

    if (!actions.length) return
    await onSaveActions(actions)
  }

  function renderStageInputs(
    group: SheetGroup,
    scope: SheetScope,
    draft: ScopeDraft | null,
    options?: { disabled?: boolean; hint?: string; extra?: ReactNode },
  ) {
    const row = rowOf(group, scope)
    if (!row || !draft) {
      return (
        <>
          <td className={`border-r border-slate-100 px-1 py-1 ${STAGE_COL_CLASS}`}>
            <span className="px-1 text-xs text-slate-300">-</span>
          </td>
          <td className={`border-r border-slate-100 px-1 py-1 ${STAGE_COL_CLASS}`}>
            <span className="px-1 text-xs text-slate-300">-</span>
          </td>
        </>
      )
    }

    const disabled = Boolean(options?.disabled)

    return (
      <>
        <td className={`border-r border-slate-100 px-1 py-1 ${STAGE_COL_CLASS}`}>
          <div className="space-y-0.5">
            <input
              type="date"
              value={draft.plannedDate}
              disabled={disabled}
              onChange={(event) =>
                updateScopeDraft(group.key, scope, { plannedDate: event.target.value })
              }
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
              updateScopeDraft(group.key, scope, {
                plannedQuantity: Math.max(1, Math.floor(Number(event.target.value) || 0)),
              })
            }
            className={`${cellInputClass} text-right tabular-nums`}
          />
        </td>
      </>
    )
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
          자재(입고일·입고수량)·SMT·후공정 칸을 수정한 뒤 행의 저장을 눌러 주세요. 날짜를 지우고
          저장하면 배정이 해제됩니다.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1480px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[12%]" />
            <col className="w-[6%]" />
            <col className="w-[7%]" />
            <col className="w-[7.5%]" />
            <col className="w-[7.5%]" />
            <col className="w-[7.5%]" />
            <col className="w-[7.5%]" />
            <col className="w-[7.5%]" />
            <col className="w-[7.5%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="sticky top-0 z-[1] bg-slate-100 text-slate-700">
            <tr className="border-b border-slate-300 text-left text-xs font-bold">
              <th rowSpan={2} className="border-r border-slate-200 px-2 py-2 align-bottom">
                고객사
              </th>
              <th rowSpan={2} className="border-r border-slate-200 px-2 py-2 align-bottom">
                발주번호
              </th>
              <th rowSpan={2} className="border-r border-slate-200 px-2 py-2 align-bottom">
                제품
              </th>
              <th rowSpan={2} className="border-r border-slate-200 px-2 py-2 text-right align-bottom">
                수량
              </th>
              <th rowSpan={2} className="border-r border-slate-200 px-2 py-2 align-bottom">
                납기
              </th>
              <th
                colSpan={2}
                className="border-r border-slate-200 bg-amber-50 px-2 py-1.5 text-center text-amber-900"
              >
                자재
              </th>
              <th
                colSpan={2}
                className="border-r border-slate-200 bg-sky-50 px-2 py-1.5 text-center text-sky-900"
              >
                SMT
              </th>
              <th
                colSpan={2}
                className="border-r border-slate-200 bg-violet-50 px-2 py-1.5 text-center text-violet-900"
              >
                후공정
              </th>
              <th rowSpan={2} className="px-2 py-2 text-center align-bottom">
                저장
              </th>
            </tr>
            <tr className="border-b border-slate-300 text-[11px] font-semibold text-slate-500">
              <th className="border-r border-slate-200 bg-amber-50/80 px-2 py-1">입고일</th>
              <th className="border-r border-slate-200 bg-amber-50/80 px-2 py-1 text-right">
                입고수량
              </th>
              <th className="border-r border-slate-200 bg-sky-50/80 px-2 py-1">계획일</th>
              <th className="border-r border-slate-200 bg-sky-50/80 px-2 py-1 text-right">
                계획수량
              </th>
              <th className="border-r border-slate-200 bg-violet-50/80 px-2 py-1">계획일</th>
              <th className="border-r border-slate-200 bg-violet-50/80 px-2 py-1 text-right">
                계획수량
              </th>
            </tr>
          </thead>
          <tbody>
            {!groups.length ? (
              <tr>
                <td colSpan={12} className="px-4 py-16 text-center text-slate-400">
                  {search.trim() ? '검색 결과 없음' : '표시할 생산계획 항목이 없습니다'}
                </td>
              </tr>
            ) : (
              groups.map((group) => {
                const draft = drafts[group.key] ?? draftFromGroup(group)
                const countdown = formatDeliveryCountdown(group.daysUntilDelivery)
                const rowSaving =
                  (group.material ? savingKeys.has(group.material.key) : false) ||
                  (group.smt ? savingKeys.has(group.smt.key) : false) ||
                  (group.post ? savingKeys.has(group.post.key) : false)
                const dirty = isGroupDirty(group)
                const postEditable =
                  !!group.post &&
                  (group.post.status === 'confirmed' || canPlanPost(group.post, allRows))
                const materialLabel = materialStatusLabel(group.materialStatus)

                return (
                  <tr
                    key={group.key}
                    className={`border-b border-slate-100 odd:bg-white even:bg-slate-50/60 ${
                      dirty ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <td
                      className="truncate border-r border-slate-100 px-2 py-1.5 text-slate-700"
                      title={group.customer}
                    >
                      {group.customer || '-'}
                    </td>
                    <td className="truncate border-r border-slate-100 px-2 py-1.5 font-mono text-xs text-slate-600">
                      {formatInternalCodeLabel(group.orderNumber)}
                    </td>
                    <td
                      className="truncate border-r border-slate-100 px-2 py-1.5 font-medium text-slate-900"
                      title={group.productName}
                    >
                      {group.productName || '-'}
                    </td>
                    <td className="border-r border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-800">
                      <div>{group.orderQty.toLocaleString('ko-KR')}</div>
                      <div className="text-[10px] text-slate-400">
                        잔량 {group.remainingQty.toLocaleString('ko-KR')}
                      </div>
                    </td>
                    <td className="border-r border-slate-100 px-2 py-1.5">
                      <div className="text-slate-700">{group.deliveryDate || '-'}</div>
                      {countdown ? (
                        <div
                          className={`text-[10px] font-semibold tabular-nums ${deliveryUrgencyClass(group.daysUntilDelivery)}`}
                        >
                          {countdown}
                        </div>
                      ) : null}
                    </td>

                    {renderStageInputs(group, 'material', draft.material, {
                      disabled: rowSaving,
                      hint: materialLabel || undefined,
                      extra: group.materialHintDate ? (
                        <div className="px-0.5 text-[10px] text-slate-400">
                          입고예정 {group.materialHintDate}
                        </div>
                      ) : null,
                    })}

                    {renderStageInputs(group, 'smt', draft.smt, {
                      disabled: rowSaving,
                      extra: draft.smt ? (
                        <select
                          value={draft.smt.lineNo}
                          disabled={rowSaving}
                          onChange={(event) =>
                            updateScopeDraft(group.key, 'smt', {
                              lineNo: Number(event.target.value),
                            })
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
                      ) : null,
                    })}

                    {renderStageInputs(group, 'post', draft.post, {
                      disabled: !postEditable || rowSaving,
                      hint: !postEditable ? 'SMD 확정 후' : undefined,
                      extra: draft.post ? (
                        <select
                          value={draft.post.team}
                          disabled={!postEditable || rowSaving}
                          onChange={(event) =>
                            updateScopeDraft(group.key, 'post', { team: event.target.value })
                          }
                          className={`${cellInputClass} text-[11px] text-slate-600`}
                          title="후공정 팀"
                        >
                          {POST_PROCESS_TEAMS.map((team) => (
                            <option key={team} value={team}>
                              {team}
                            </option>
                          ))}
                        </select>
                      ) : null,
                    })}

                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        disabled={!dirty || rowSaving}
                        onClick={() => void commitGroup(group)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-bold transition ${
                          dirty && !rowSaving
                            ? 'bg-slate-800 text-white hover:bg-slate-700'
                            : 'cursor-not-allowed bg-slate-200 text-slate-400'
                        }`}
                      >
                        {rowSaving ? '저장 중…' : '저장'}
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
