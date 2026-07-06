'use client'

import { useCallback, useMemo, useState } from 'react'
import { addDaysYmd } from '@/lib/orders/utils'
import {
  deleteSmtProductionPlan,
  fetchSmtPlanPageData,
  upsertSmtProductionPlan,
  type FetchSmtPlanPageResult,
} from '@/lib/smt/plan/repository'
import type { SmtPlanBlock, SmtPlanOrderCandidate, SmtPlanPageData } from '@/lib/smt/plan/types'
import { formatWeekRangeLabel, getWeekStartMondayYmd } from '@/lib/smt/plan/utils'
import { SmtPlanCalendar } from '@/components/smt/smt-plan-calendar'
import { SmtPlanFetchError } from '@/components/smt/smt-plan-fetch-error'
import { SmtPlanFormModal, type SmtPlanFormValues } from '@/components/smt/smt-plan-form-modal'
import { SmtPlanUnassignedSidebar } from '@/components/smt/smt-plan-unassigned-sidebar'

type ModalState =
  | { open: false }
  | {
      open: true
      mode: 'create' | 'edit' | 'move'
      order: SmtPlanOrderCandidate | SmtPlanBlock
      initialValues: SmtPlanFormValues
      maxQuantity?: number
    }

type SmtPlanWorkspaceProps = {
  initialResult: FetchSmtPlanPageResult
  initialWeekStart: string
}

export function SmtPlanWorkspace({ initialResult, initialWeekStart }: SmtPlanWorkspaceProps) {
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [data, setData] = useState<SmtPlanPageData | null>(initialResult.ok ? initialResult.data : null)
  const [error, setError] = useState(initialResult.ok ? '' : initialResult.detail)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [statusMessage, setStatusMessage] = useState('')

  const orderById = useMemo(() => {
    const map = new Map<string, SmtPlanOrderCandidate>()
    for (const order of data?.unassignedOrders ?? []) {
      map.set(order.orderId, order)
    }
    for (const plan of data?.plans ?? []) {
      if (!map.has(plan.orderId)) {
        map.set(plan.orderId, {
          orderId: plan.orderId,
          orderNumber: plan.orderNumber,
          customer: plan.customer,
          productSummary: plan.productSummary,
          deliveryDate: plan.deliveryDate,
          smtTarget: 0,
          smtProduced: 0,
          smtRemaining: 0,
          plannedTotal: 0,
          unplannedRemaining: 0,
          daysUntilDelivery: null,
        })
      }
    }
    return map
  }, [data])

  const reload = useCallback(async (nextWeekStart: string) => {
    setLoading(true)
    setError('')
    const result = await fetchSmtPlanPageData(nextWeekStart)
    setLoading(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }
    setData(result.data)
  }, [])

  async function changeWeek(nextWeekStart: string) {
    setWeekStart(nextWeekStart)
    await reload(nextWeekStart)
  }

  function openCreateModal(order: SmtPlanOrderCandidate, plannedDate: string, lineNo: number) {
    setModal({
      open: true,
      mode: 'create',
      order,
      maxQuantity: order.unplannedRemaining,
      initialValues: {
        orderId: order.orderId,
        plannedDate,
        lineNo,
        plannedQuantity: Math.max(1, order.unplannedRemaining),
        note: '',
      },
    })
  }

  function openEditModal(plan: SmtPlanBlock) {
    const candidate = orderById.get(plan.orderId)
    setModal({
      open: true,
      mode: 'edit',
      order: plan,
      maxQuantity: candidate ? candidate.unplannedRemaining + plan.plannedQuantity : undefined,
      initialValues: {
        id: plan.id,
        orderId: plan.orderId,
        plannedDate: plan.plannedDate,
        lineNo: plan.lineNo,
        plannedQuantity: plan.plannedQuantity,
        note: plan.note,
      },
    })
  }

  function openMoveModal(plan: SmtPlanBlock, plannedDate: string, lineNo: number) {
    setModal({
      open: true,
      mode: 'move',
      order: plan,
      initialValues: {
        id: plan.id,
        orderId: plan.orderId,
        plannedDate,
        lineNo,
        plannedQuantity: plan.plannedQuantity,
        note: plan.note,
      },
    })
  }

  async function handleDrop(
    payload: { kind: 'order'; orderId: string } | { kind: 'plan'; planId: string },
    target: { plannedDate: string; lineNo: number },
  ) {
    if (payload.kind === 'order') {
      const order = orderById.get(payload.orderId) ?? data?.unassignedOrders.find((item) => item.orderId === payload.orderId)
      if (!order) return
      openCreateModal(order, target.plannedDate, target.lineNo)
      return
    }

    const plan = data?.plans.find((item) => item.id === payload.planId)
    if (!plan) return

    if (plan.plannedDate === target.plannedDate && plan.lineNo === target.lineNo) {
      return
    }

    const occupied = data?.plans.some(
      (item) =>
        item.id !== plan.id &&
        item.orderId === plan.orderId &&
        item.plannedDate === target.plannedDate &&
        item.lineNo === target.lineNo,
    )
    if (occupied) {
      setStatusMessage('해당 일·라인에 이미 같은 주문서 계획이 있습니다.')
      return
    }

    openMoveModal(plan, target.plannedDate, target.lineNo)
  }

  async function handleSubmit(values: SmtPlanFormValues) {
    setSaving(true)
    setStatusMessage('')
    const result = await upsertSmtProductionPlan(values)
    setSaving(false)

    if (!result.ok) {
      setStatusMessage(result.detail)
      return
    }

    setModal({ open: false })
    await reload(weekStart)
  }

  async function handleDelete(planId: string) {
    setDeleting(true)
    setStatusMessage('')
    const result = await deleteSmtProductionPlan(planId)
    setDeleting(false)

    if (!result.ok) {
      setStatusMessage(result.detail)
      return
    }

    setModal({ open: false })
    await reload(weekStart)
  }

  if (!initialResult.ok && !data) {
    return <SmtPlanFetchError result={initialResult} />
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-sm font-bold text-slate-900">{formatWeekRangeLabel(weekStart)}</p>
          <p className="text-xs text-slate-500">주간 SMT 생산계획 — 라인 1~7</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => changeWeek(addDaysYmd(weekStart, -7))}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            이전 주
          </button>
          <button
            type="button"
            onClick={() => changeWeek(getWeekStartMondayYmd())}
            disabled={loading}
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
          >
            이번 주
          </button>
          <button
            type="button"
            onClick={() => changeWeek(addDaysYmd(weekStart, 7))}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            다음 주
          </button>
        </div>
      </div>

      {error ? <SmtPlanFetchError result={{ ok: false, reason: 'query', detail: error }} /> : null}
      {statusMessage ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {statusMessage}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md lg:flex-row">
        <SmtPlanUnassignedSidebar
          orders={data?.unassignedOrders ?? []}
          onDragOrder={() => setStatusMessage('')}
        />
        <div className="min-h-[480px] min-w-0 flex-1 p-3">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">불러오는 중…</div>
          ) : (
            <SmtPlanCalendar
              weekDates={data?.weekDates ?? []}
              lineNos={data?.lineNos ?? []}
              plans={data?.plans ?? []}
              activeDropCell={null}
              onDrop={handleDrop}
              onPlanClick={openEditModal}
              onDragPlan={() => setStatusMessage('')}
            />
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        미배정 주문을 캘린더로 드래그해 배치하세요. 블록을 클릭하면 수량·일정을 수정할 수 있습니다.
      </p>

      <SmtPlanFormModal
        open={modal.open}
        title={
          modal.open
            ? modal.mode === 'edit'
              ? '생산계획 수정'
              : modal.mode === 'move'
                ? '생산계획 이동'
                : '생산계획 등록'
            : ''
        }
        order={modal.open ? modal.order : null}
        initialValues={
          modal.open
            ? modal.initialValues
            : { orderId: '', plannedDate: '', lineNo: 1, plannedQuantity: 1, note: '' }
        }
        maxQuantity={modal.open ? modal.maxQuantity : undefined}
        saving={saving}
        deleting={deleting}
        onClose={() => setModal({ open: false })}
        onSubmit={handleSubmit}
        onDelete={
          modal.open && modal.mode !== 'create' && modal.initialValues.id
            ? () => handleDelete(modal.initialValues.id!)
            : undefined
        }
      />
    </div>
  )
}
