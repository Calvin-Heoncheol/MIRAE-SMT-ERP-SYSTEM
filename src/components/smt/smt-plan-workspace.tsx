'use client'

import { useCallback, useMemo, useState } from 'react'
import { SmtPlanCalendar } from '@/components/smt/smt-plan-calendar'
import { SmtPlanFetchError } from '@/components/smt/smt-plan-fetch-error'
import { SmtPlanFormModal, type SmtPlanFormValues } from '@/components/smt/smt-plan-form-modal'
import {
  filterSmtPlanOrderCandidates,
  SmtPlanOrderSidebar,
} from '@/components/smt/smt-plan-order-sidebar'
import { addDaysYmd } from '@/lib/orders/utils'
import {
  deleteSmtProductionPlan,
  fetchSmtPlanPageData,
  upsertSmtProductionPlan,
  type FetchSmtPlanPageResult,
} from '@/lib/smt/plan/repository'
import type { SmtPlanBlock, SmtPlanOrderCandidate, SmtPlanPageData } from '@/lib/smt/plan/types'
import {
  defaultPcbSideForCandidate,
  formatWeekRangeLabel,
  getUnplannedRemainingForSide,
  getWeekStartMondayYmd,
} from '@/lib/smt/plan/utils'

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
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedKey, setSelectedKey] = useState('')

  const candidateByLineId = useMemo(() => {
    const map = new Map<string, SmtPlanOrderCandidate>()
    for (const candidate of data?.planCandidates ?? []) {
      map.set(candidate.orderLineId, candidate)
    }
    for (const plan of data?.plans ?? []) {
      if (!plan.orderLineId || map.has(plan.orderLineId)) continue
      map.set(plan.orderLineId, {
        orderId: plan.orderId,
        orderLineId: plan.orderLineId,
        orderNumber: plan.orderNumber,
        customer: plan.customer,
        productSummary: plan.productSummary,
        deliveryDate: plan.deliveryDate,
        splitPcbSides: plan.splitPcbSides,
        smtTarget: 0,
        smtProduced: 0,
        smtRemaining: 0,
        plannedTotal: 0,
        unplannedRemaining: 0,
        unplannedBySide: {},
        daysUntilDelivery: null,
      })
    }
    return map
  }, [data])

  const filteredCandidates = useMemo(() => {
    const unplanned = (data?.planCandidates ?? []).filter(
      (candidate) => candidate.unplannedRemaining > 0,
    )
    return filterSmtPlanOrderCandidates(unplanned, search)
  }, [data?.planCandidates, search])

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
    if (order.unplannedRemaining <= 0) {
      setStatusMessage('이 주문 라인은 미배정 잔량이 없어 계획에 추가할 수 없습니다.')
      return
    }
    const pcbSide = defaultPcbSideForCandidate(order)
    const maxQuantity = getUnplannedRemainingForSide(order, pcbSide)
    setModal({
      open: true,
      mode: 'create',
      order,
      maxQuantity,
      initialValues: {
        orderId: order.orderId,
        orderLineId: order.orderLineId,
        plannedDate,
        lineNo,
        pcbSide,
        plannedQuantity: Math.max(1, maxQuantity),
        note: '',
      },
    })
  }

  function openEditModal(plan: SmtPlanBlock) {
    const candidate = candidateByLineId.get(plan.orderLineId)
    const maxQuantity = candidate
      ? getUnplannedRemainingForSide(candidate, plan.pcbSide) + plan.plannedQuantity
      : undefined
    setModal({
      open: true,
      mode: 'edit',
      order: candidate ?? plan,
      maxQuantity,
      initialValues: {
        id: plan.id,
        orderId: plan.orderId,
        orderLineId: plan.orderLineId,
        plannedDate: plan.plannedDate,
        lineNo: plan.lineNo,
        pcbSide: plan.pcbSide,
        plannedQuantity: plan.plannedQuantity,
        note: plan.note,
      },
    })
  }

  function openMoveModal(plan: SmtPlanBlock, plannedDate: string, lineNo: number) {
    const candidate = candidateByLineId.get(plan.orderLineId)
    setModal({
      open: true,
      mode: 'move',
      order: candidate ?? plan,
      initialValues: {
        id: plan.id,
        orderId: plan.orderId,
        orderLineId: plan.orderLineId,
        plannedDate,
        lineNo,
        pcbSide: plan.pcbSide,
        plannedQuantity: plan.plannedQuantity,
        note: plan.note,
      },
    })
  }

  async function handleDrop(
    payload:
      | { kind: 'order'; orderId: string; orderLineId: string }
      | { kind: 'plan'; planId: string },
    target: { plannedDate: string; lineNo: number },
  ) {
    if (payload.kind === 'order') {
      const order = candidateByLineId.get(payload.orderLineId)
      if (!order) {
        setStatusMessage('주문 라인 정보를 찾을 수 없습니다.')
        return
      }
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
        item.orderLineId === plan.orderLineId &&
        item.pcbSide === plan.pcbSide &&
        item.plannedDate === target.plannedDate &&
        item.lineNo === target.lineNo,
    )
    if (occupied) {
      setStatusMessage('해당 일·라인·면에 이미 같은 주문 라인 계획이 있습니다.')
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

  function handleSelectOrder(orderLineId: string) {
    setSelectedKey(orderLineId)
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  if (!initialResult.ok && !data) {
    return <SmtPlanFetchError result={initialResult} />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {error ? <SmtPlanFetchError result={{ ok: false, reason: 'query', detail: error }} /> : null}
      {statusMessage ? (
        <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {statusMessage}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md lg:flex-row">
        <SmtPlanOrderSidebar
          candidates={filteredCandidates}
          selectedOrderLineId={selectedKey}
          search={search}
          page={page}
          onSearchChange={handleSearchChange}
          onSelect={handleSelectOrder}
          onPageChange={setPage}
          onDragCandidate={() => setStatusMessage('')}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-sm font-bold text-sky-800">생산1팀</span>
              <span className="text-sm font-semibold text-slate-700">
                {formatWeekRangeLabel(weekStart)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="mr-1 flex flex-wrap gap-1 text-[10px] font-semibold text-slate-500">
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-700 ring-1 ring-sky-200">
                  예정
                </span>
                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-800 ring-1 ring-amber-100">
                  진행
                </span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800 ring-1 ring-emerald-100">
                  완료 · 재배정
                </span>
              </div>
              <button
                type="button"
                onClick={() => changeWeek(addDaysYmd(weekStart, -7))}
                disabled={loading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                이전 주
              </button>
              <button
                type="button"
                onClick={() => changeWeek(getWeekStartMondayYmd())}
                disabled={loading}
                className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
              >
                이번 주
              </button>
              <button
                type="button"
                onClick={() => changeWeek(addDaysYmd(weekStart, 7))}
                disabled={loading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                다음 주
              </button>
            </div>
          </div>
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">불러오는 중…</div>
          ) : (
            <SmtPlanCalendar
              weekDates={data?.weekDates ?? []}
              lineNos={data?.lineNos ?? []}
              plans={data?.plans ?? []}
              planProgress={data?.planProgress ?? {}}
              activeDropCell={null}
              onDrop={handleDrop}
              onPlanClick={openEditModal}
              onDragPlan={() => setStatusMessage('')}
            />
          )}
        </div>
      </div>

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
            : {
                orderId: '',
                orderLineId: '',
                plannedDate: '',
                lineNo: 1,
                pcbSide: 'SINGLE',
                plannedQuantity: 1,
                note: '',
              }
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
