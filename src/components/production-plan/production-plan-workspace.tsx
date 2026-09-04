'use client'

import { useCallback, useMemo, useState } from 'react'
import { ProductionPlanFetchError } from '@/components/production-plan/production-plan-fetch-error'
import { ProductionPlanMonthCalendar } from '@/components/production-plan/production-plan-month-calendar'
import { ProductionPlanOrderTimeline } from '@/components/production-plan/production-plan-order-timeline'
import {
  ProductionPlanSheet,
  type ProductionPlanSheetAction,
} from '@/components/production-plan/production-plan-sheet'
import {
  buildScheduleFormValues,
  ProductionPlanScheduleModal,
  type ProductionPlanScheduleFormValues,
} from '@/components/production-plan/production-plan-schedule-modal'
import { ErpButton } from '@/components/ui/erp-button'
import { todayYmdSeoul } from '@/lib/orders/utils'
import {
  addMonthsYmd,
  buildMonthGrid,
  formatMonthLabel,
  getMonthStartYmd,
  isYmdInMonth,
} from '@/lib/production-plan/calendar'
import {
  canPlanPost,
  validatePostPlanDate,
} from '@/lib/production-plan/pipeline'
import {
  type ProductionPlanTeamTab,
  productionPlanTeamTabLabel,
  PRODUCTION_PLAN_TEAM_TABS,
} from '@/lib/production-plan/tabs'
import {
  confirmProductionPlanItem,
  fetchProductionPlanBoard,
  unconfirmProductionPlanItem,
} from '@/lib/production-plan/repository'
import type {
  FetchProductionPlanBoardResult,
  ProductionPlanBoardRow,
  ProductionPlanSheetFilter,
} from '@/lib/production-plan/types'
import { isProductionPlanScheduleRow } from '@/lib/production-plan/utils'

type ViewMode = 'sheet' | 'calendar' | 'order'

type TeamTab = ProductionPlanTeamTab

type ModalState =
  | { open: false }
  | {
      open: true
      row: ProductionPlanBoardRow
      initialValues: ProductionPlanScheduleFormValues
    }

type ProductionPlanWorkspaceProps = {
  initialResult: FetchProductionPlanBoardResult
  initialMonthStart: string
}

const EMPTY_ROW: ProductionPlanBoardRow = {
  key: '',
  scope: 'smt',
  orderId: '',
  orderNumber: '',
  customer: '',
  deliveryDate: '',
  daysUntilDelivery: null,
  productId: '',
  productName: '',
  productCode: '',
  productKindLabel: '',
  targetId: '',
  splitPcbSides: false,
  orderQty: 0,
  producedQty: 0,
  remainingQty: 0,
  materialReadyQty: 0,
  materialScheduledQty: 0,
  materialExpectedReadyDate: '',
  materialShort: false,
  materialUnknown: false,
  status: 'waiting',
  confirmedAt: '',
  confirmedByName: '',
  plannedDate: '',
  lineNo: null,
  team: '',
  pcbSide: 'SINGLE',
  plannedQuantity: null,
}

export function ProductionPlanWorkspace({
  initialResult,
  initialMonthStart,
}: ProductionPlanWorkspaceProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('sheet')
  const [teamTab, setTeamTab] = useState<TeamTab>('material')
  const [sheetFilter, setSheetFilter] = useState<ProductionPlanSheetFilter>('actionable')
  const [monthStart, setMonthStart] = useState(initialMonthStart)
  const [rows, setRows] = useState<ProductionPlanBoardRow[]>(
    initialResult.ok ? initialResult.data.rows : [],
  )
  const [error, setError] = useState(initialResult.ok ? '' : initialResult.detail)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sheetSavingKeys, setSheetSavingKeys] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })

  const sheetSavingKeySet = useMemo(() => new Set(sheetSavingKeys), [sheetSavingKeys])

  const scheduledRows = useMemo(() => {
    return rows.filter(
      (row) =>
        row.scope === teamTab &&
        row.status === 'confirmed' &&
        isYmdInMonth(row.plannedDate, monthStart),
    )
  }, [rows, monthStart, teamTab])

  const monthCells = useMemo(() => buildMonthGrid(monthStart), [monthStart])

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await fetchProductionPlanBoard()
    setLoading(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }
    setRows(result.data.rows)
  }, [])

  function openScheduleModal(row: ProductionPlanBoardRow) {
    const dateSeed = isProductionPlanScheduleRow(row)
      ? row.plannedDate.slice(0, 10)
      : todayYmdSeoul()
    setModal({
      open: true,
      row,
      initialValues: buildScheduleFormValues(row, dateSeed),
    })
  }

  function validateBeforeSchedule(row: ProductionPlanBoardRow, plannedDate: string) {
    if (row.scope === 'post') {
      if (!canPlanPost(row, rows)) {
        return 'SMD 생산계획을 먼저 확정해 주세요.'
      }
      const timing = validatePostPlanDate(row, plannedDate, rows)
      if (!timing.ok) return timing.detail
    }
    return ''
  }

  const teamTabHint: Record<TeamTab, string> = {
    material:
      viewMode === 'order'
        ? '발주별 자재 → SMT → 후공정 흐름을 확인합니다.'
        : viewMode === 'sheet'
          ? '입고일·입고수량을 표에서 입력하고 저장하세요.'
          : '확정된 자재 입고 일정을 캘린더에서 검토합니다.',
    smt:
      viewMode === 'order'
        ? '발주별 자재 → SMT → 후공정 흐름을 확인합니다.'
        : viewMode === 'sheet'
          ? '자재 입고가 입력된 발주만 기본 표시됩니다. 계획일·라인·수량을 표에서 입력하세요.'
          : '확정된 SMT 일정을 캘린더에서 검토합니다.',
    post:
      viewMode === 'order'
        ? '발주별 자재 → SMT → 후공정 흐름을 확인합니다.'
        : viewMode === 'sheet'
          ? 'SMT 확정 후 배정 가능한 후공정만 기본 표시됩니다.'
          : '확정된 후공정 일정을 캘린더에서 검토합니다.',
  }

  async function handleSheetSaveActions(actions: ProductionPlanSheetAction[]) {
    if (!actions.length) return

    const keys = actions.map((action) => action.row.key)
    setSheetSavingKeys((current) => Array.from(new Set([...current, ...keys])))
    setStatusMessage('')

    let cleared = false
    let saved = false

    for (const action of actions) {
      if (action.type === 'clear') {
        const result = await unconfirmProductionPlanItem({
          scope: action.row.scope,
          targetId: action.row.targetId,
          planId: action.row.planId,
          boardItemId: action.row.boardItemId,
        })
        if (!result.ok) {
          setSheetSavingKeys((current) => current.filter((key) => !keys.includes(key)))
          setStatusMessage(result.detail)
          return
        }
        cleared = true
        continue
      }

      const validationError = validateBeforeSchedule(action.row, action.values.plannedDate)
      if (validationError) {
        setSheetSavingKeys((current) => current.filter((key) => !keys.includes(key)))
        setStatusMessage(validationError)
        return
      }

      const result = await confirmProductionPlanItem({
        scope: action.row.scope,
        orderId: action.row.orderId,
        targetId: action.row.targetId,
        plannedDate: action.values.plannedDate,
        plannedQuantity: action.values.plannedQuantity,
        lineNo: action.row.scope === 'smt' ? action.values.lineNo : undefined,
        pcbSide: action.row.scope === 'smt' ? action.values.pcbSide : undefined,
        team: action.row.scope === 'post' ? action.values.team : undefined,
        planId: action.row.planId,
        boardItemId: action.row.boardItemId,
      })
      if (!result.ok) {
        setSheetSavingKeys((current) => current.filter((key) => !keys.includes(key)))
        setStatusMessage(result.detail)
        return
      }
      saved = true
    }

    setSheetSavingKeys((current) => current.filter((key) => !keys.includes(key)))
    if (cleared && !saved) setStatusMessage('배정이 삭제되었습니다.')
    else if (cleared && saved) setStatusMessage('생산계획이 저장되었습니다.')
    else setStatusMessage('생산계획이 저장되었습니다.')
    await reload()
  }

  async function handleModalSubmit(values: ProductionPlanScheduleFormValues) {
    if (!modal.open) return
    const row = modal.row

    const validationError = validateBeforeSchedule(row, values.plannedDate)
    if (validationError) {
      setStatusMessage(validationError)
      return
    }

    setSaving(true)
    setStatusMessage('')
    const result = await confirmProductionPlanItem({
      scope: row.scope,
      orderId: row.orderId,
      targetId: row.targetId,
      plannedDate: values.plannedDate,
      plannedQuantity: values.plannedQuantity,
      lineNo: row.scope === 'smt' ? values.lineNo : undefined,
      pcbSide: row.scope === 'smt' ? values.pcbSide : undefined,
      team: row.scope === 'post' ? values.team : undefined,
      note: values.note,
      planId: row.planId,
      boardItemId: row.boardItemId,
    })
    setSaving(false)

    if (!result.ok) {
      setStatusMessage(result.detail)
      return
    }

    setModal({ open: false })
    setStatusMessage('생산계획이 저장되었습니다.')
    await reload()
  }

  async function handleModalDelete() {
    if (!modal.open) return
    const row = modal.row

    setDeleting(true)
    setStatusMessage('')
    const result = await unconfirmProductionPlanItem({
      scope: row.scope,
      targetId: row.targetId,
      planId: row.planId,
      boardItemId: row.boardItemId,
    })
    setDeleting(false)

    if (!result.ok) {
      setStatusMessage(result.detail)
      return
    }

    setModal({ open: false })
    setStatusMessage('배정이 삭제되었습니다.')
    await reload()
  }

  if (!initialResult.ok && !rows.length) {
    return <ProductionPlanFetchError result={initialResult} />
  }

  return (
    <>
      {error ? <ProductionPlanFetchError result={{ ok: false, reason: 'query', detail: error }} /> : null}
      {statusMessage ? (
        <div className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {statusMessage}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">생산계획</h2>
            <p className="text-xs text-slate-500">
              {viewMode === 'sheet'
                ? teamTabHint[teamTab]
                : viewMode === 'calendar'
                  ? '확정 일정 검토용 — 라인·날짜 겹침 확인'
                  : '발주별 납기·공정 흐름'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {viewMode !== 'order' ? (
              <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
                {PRODUCTION_PLAN_TEAM_TABS.map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setTeamTab(scope)}
                    className={`px-3 py-1.5 text-sm font-semibold ${
                      teamTab === scope
                        ? scope === 'material'
                          ? 'bg-amber-600 text-white'
                          : scope === 'smt'
                            ? 'bg-sky-600 text-white'
                            : 'bg-violet-600 text-white'
                        : 'text-slate-700 hover:bg-slate-50'
                    } ${scope !== 'material' ? 'border-l border-slate-300' : ''}`}
                  >
                    {productionPlanTeamTabLabel(scope)}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
              <button
                type="button"
                onClick={() => setViewMode('sheet')}
                className={`px-3 py-1.5 text-sm font-semibold ${
                  viewMode === 'sheet'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                표 입력
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={`border-l border-slate-300 px-3 py-1.5 text-sm font-semibold ${
                  viewMode === 'calendar'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                캘린더
              </button>
              <button
                type="button"
                onClick={() => setViewMode('order')}
                className={`border-l border-slate-300 px-3 py-1.5 text-sm font-semibold ${
                  viewMode === 'order'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                발주
              </button>
            </div>
            {viewMode === 'sheet' ? (
              <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
                <button
                  type="button"
                  onClick={() => setSheetFilter('actionable')}
                  className={`px-3 py-1.5 text-sm font-semibold ${
                    sheetFilter === 'actionable'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  지금 배정
                </button>
                <button
                  type="button"
                  onClick={() => setSheetFilter('month')}
                  className={`border-l border-slate-300 px-3 py-1.5 text-sm font-semibold ${
                    sheetFilter === 'month'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  이번 달
                </button>
                <button
                  type="button"
                  onClick={() => setSheetFilter('all_pending')}
                  className={`border-l border-slate-300 px-3 py-1.5 text-sm font-semibold ${
                    sheetFilter === 'all_pending'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  미완료 전체
                </button>
              </div>
            ) : null}
            {viewMode !== 'order' ? (
              <>
            <span className="text-lg font-extrabold text-slate-800">{formatMonthLabel(monthStart)}</span>
            <button
              type="button"
              onClick={() => setMonthStart(addMonthsYmd(monthStart, -1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              이전 달
            </button>
            <button
              type="button"
              onClick={() => setMonthStart(getMonthStartYmd(todayYmdSeoul()))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              이번 달
            </button>
            <button
              type="button"
              onClick={() => setMonthStart(addMonthsYmd(monthStart, 1))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              다음 달
            </button>
              </>
            ) : null}
            <ErpButton type="button" variant="secondary" onClick={() => reload()} disabled={loading}>
              {loading ? '새로고침…' : '새로고침'}
            </ErpButton>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              불러오는 중…
            </div>
          ) : viewMode === 'sheet' ? (
            <ProductionPlanSheet
              allRows={rows}
              activeScope={teamTab}
              monthStart={monthStart}
              sheetFilter={sheetFilter}
              search={search}
              onSearchChange={setSearch}
              savingKeys={sheetSavingKeySet}
              onSaveActions={handleSheetSaveActions}
              onMessage={setStatusMessage}
            />
          ) : viewMode === 'calendar' ? (
            <ProductionPlanMonthCalendar
              cells={monthCells}
              scheduledRows={scheduledRows}
              onSelectRow={openScheduleModal}
            />
          ) : (
            <ProductionPlanOrderTimeline
              rows={rows}
              search={search}
              onSearchChange={setSearch}
              onSelectRow={openScheduleModal}
            />
          )}
        </div>
      </div>

      <ProductionPlanScheduleModal
        open={modal.open}
        row={modal.open ? modal.row : null}
        allRows={rows}
        initialValues={
          modal.open ? modal.initialValues : buildScheduleFormValues(EMPTY_ROW, todayYmdSeoul())
        }
        saving={saving}
        deleting={deleting}
        onClose={() => setModal({ open: false })}
        onSubmit={handleModalSubmit}
        onUnassign={modal.open && isProductionPlanScheduleRow(modal.row) ? handleModalDelete : undefined}
      />
    </>
  )
}
