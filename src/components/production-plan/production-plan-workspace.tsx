'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ProductionPlanConfirmModal } from '@/components/production-plan/production-plan-confirm-modal'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpButton } from '@/components/ui/erp-button'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import {
  confirmProductionPlanItem,
  unconfirmProductionPlanItem,
} from '@/lib/production-plan/repository'
import type {
  ConfirmProductionPlanScheduleInput,
  FetchProductionPlanBoardResult,
  ProductionPlanBoardRow,
  ProductionPlanBoardStatus,
  ProductionPlanScope,
} from '@/lib/production-plan/types'
import {
  PRODUCTION_PLAN_SCOPE_LABELS,
  PRODUCTION_PLAN_STATUS_LABELS,
} from '@/lib/production-plan/types'
import {
  deliveryUrgencyClass,
  formatDeliveryCountdown,
} from '@/lib/production-plan/utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import {
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
  formatEmptyListMessage,
} from '@/lib/ui/tokens'

type ProductionPlanWorkspaceProps = {
  result: FetchProductionPlanBoardResult
}

type ScopeFilter = 'all' | ProductionPlanScope
type StatusFilter = 'all' | ProductionPlanBoardStatus | 'ready' | 'short'

function formatQty(value: number) {
  return value.toLocaleString('ko-KR')
}

export function ProductionPlanWorkspace({ result }: ProductionPlanWorkspaceProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [confirmRow, setConfirmRow] = useState<ProductionPlanBoardRow | null>(null)
  const [savingConfirm, setSavingConfirm] = useState(false)

  const rows = result.ok ? result.data.rows : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (scopeFilter !== 'all' && row.scope !== scopeFilter) return false
      if (statusFilter === 'waiting' && row.status !== 'waiting') return false
      if (statusFilter === 'confirmed' && row.status !== 'confirmed') return false
      if (statusFilter === 'ready' && (row.materialShort || row.materialUnknown)) return false
      if (statusFilter === 'short' && !row.materialShort) return false
      if (!query) return true
      const haystack = [
        row.orderNumber,
        row.customer,
        row.productName,
        row.productCode,
        row.productKindLabel,
        PRODUCTION_PLAN_SCOPE_LABELS[row.scope],
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [rows, scopeFilter, statusFilter, query])

  const pagination = useClientPagination(filtered)

  const scopeChips = useMemo(() => {
    const smt = rows.filter((row) => row.scope === 'smt').length
    const post = rows.filter((row) => row.scope === 'post').length
    return [
      { value: 'all' as const, label: '전체', count: rows.length },
      { value: 'smt' as const, label: 'SMT', count: smt },
      { value: 'post' as const, label: '후공정', count: post },
    ]
  }, [rows])

  const statusChips = useMemo(() => {
    const waiting = rows.filter((row) => row.status === 'waiting').length
    const confirmed = rows.filter((row) => row.status === 'confirmed').length
    const ready = rows.filter((row) => !row.materialShort && !row.materialUnknown).length
    const short = rows.filter((row) => row.materialShort).length
    return [
      { value: 'all' as const, label: '상태전체', count: rows.length },
      {
        value: 'waiting' as const,
        label: '대기',
        count: waiting,
        tone: STATUS_FILTER_TONES.waiting,
      },
      {
        value: 'confirmed' as const,
        label: '확정',
        count: confirmed,
        tone: STATUS_FILTER_TONES.done,
      },
      {
        value: 'ready' as const,
        label: '자재OK',
        count: ready,
        tone: STATUS_FILTER_TONES.done,
      },
      {
        value: 'short' as const,
        label: '자재부족',
        count: short,
        tone: STATUS_FILTER_TONES.progress,
      },
    ]
  }, [rows])

  async function handleUnconfirm(row: ProductionPlanBoardRow) {
    setActionError(null)
    setBusyKey(row.key)
    const result = await unconfirmProductionPlanItem({
      scope: row.scope,
      targetId: row.targetId,
    })
    setBusyKey(null)
    if (!result.ok) {
      setActionError(result.detail)
      return
    }
    startTransition(() => router.refresh())
  }

  async function handleConfirmSubmit(input: ConfirmProductionPlanScheduleInput) {
    if (!confirmRow) return
    setActionError(null)
    setSavingConfirm(true)
    const result = await confirmProductionPlanItem(input)
    setSavingConfirm(false)
    if (!result.ok) {
      setActionError(result.detail)
      return
    }
    setConfirmRow(null)
    startTransition(() => router.refresh())
  }

  if (!result.ok) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <p className="font-semibold">
          {result.reason === 'env' ? '환경변수 필요' : '생산계획을 불러오지 못했습니다'}
        </p>
        <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
      <WorkspaceHeader
        subtitle="자재 준비된 주문부터 확정하세요. 확정 시 계획일·라인(또는 팀)을 고릅니다."
        totalCount={rows.length}
        filteredCount={filtered.length}
        hasQuery={Boolean(query) || scopeFilter !== 'all' || statusFilter !== 'all'}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="주문번호, 고객사, 품목 검색…"
        accent="slate"
        filters={
          <div className="flex flex-col gap-2">
            <FilterChipBar options={scopeChips} value={scopeFilter} onChange={setScopeFilter} />
            <FilterChipBar options={statusChips} value={statusFilter} onChange={setStatusFilter} />
          </div>
        }
      />

      {actionError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {actionError}
        </p>
      ) : null}

      <ProductionPlanTable
        rows={pagination.pageItems}
        busyKey={busyKey}
        pending={pending || savingConfirm}
        onConfirm={(row) => setConfirmRow(row)}
        onUnconfirm={handleUnconfirm}
        emptyMessage={formatEmptyListMessage({
          hasQuery: Boolean(query) || scopeFilter !== 'all' || statusFilter !== 'all',
          emptyLabel: '남은 생산 대상이 없습니다',
          actionHint: '주문서와 생산실적을 확인하세요',
        })}
      />

      <ListPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={pagination.setPage}
        rangeStart={pagination.rangeStart}
        rangeEnd={pagination.rangeEnd}
        totalCount={pagination.totalCount}
      />

      <ProductionPlanConfirmModal
        open={Boolean(confirmRow)}
        row={confirmRow}
        saving={savingConfirm}
        onClose={() => {
          if (!savingConfirm) setConfirmRow(null)
        }}
        onSubmit={handleConfirmSubmit}
      />
    </div>
  )
}

function MaterialChip({ row }: { row: ProductionPlanBoardRow }) {
  if (row.materialUnknown) {
    return (
      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
        BOM없음
      </span>
    )
  }
  if (row.materialShort) {
    return (
      <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
        부족 · {formatQty(row.materialReadyQty)}대 가능
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
      자재OK · {formatQty(row.materialReadyQty)}대
    </span>
  )
}

function formatSchedule(row: ProductionPlanBoardRow) {
  if (row.status !== 'confirmed' || !row.plannedDate) return '—'
  const qty =
    row.plannedQuantity != null ? `${formatQty(row.plannedQuantity)}대` : ''
  if (row.scope === 'smt') {
    const line = row.lineNo != null ? `L${row.lineNo}` : ''
    const side =
      row.pcbSide === 'BOTH' ? '양면' : row.pcbSide === 'SINGLE' ? '' : row.pcbSide
    return [row.plannedDate, line, side, qty].filter(Boolean).join(' · ')
  }
  return [row.plannedDate, row.team || '', qty].filter(Boolean).join(' · ')
}

function ProductionPlanTable({
  rows,
  busyKey,
  pending,
  onConfirm,
  onUnconfirm,
  emptyMessage,
}: {
  rows: ProductionPlanBoardRow[]
  busyKey: string | null
  pending: boolean
  onConfirm: (row: ProductionPlanBoardRow) => void
  onUnconfirm: (row: ProductionPlanBoardRow) => void
  emptyMessage: string
}) {
  if (!rows.length) {
    return (
      <EmptyListState
        message={emptyMessage}
        hint="주문 잔량이 있고 출하 전인 품목이 여기에 모입니다."
      />
    )
  }

  return (
    <div className={`${ERP_TABLE_WRAP_CLASS} min-h-0 flex-1 overflow-hidden`}>
      <div className="min-h-0 flex-1 overflow-x-auto">
        <table className={`${ERP_TABLE_CLASS} min-w-[1080px]`}>
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>납기</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>주문</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>품목</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-center`}>구분</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-right`}>잔량</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>자재</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-left`}>배정</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-center`}>상태</th>
              <th className={`${ERP_TABLE_TH_CLASS} text-right`}>작업</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const busy = busyKey === row.key || pending
              return (
                <tr
                  key={row.key}
                  className={[
                    'border-t border-slate-100',
                    row.status === 'confirmed' ? 'bg-emerald-50/40' : 'hover:bg-slate-50/80',
                  ].join(' ')}
                >
                  <td className={`${ERP_TABLE_TD_CLASS}`}>
                    <div className={`text-sm tabular-nums ${deliveryUrgencyClass(row.daysUntilDelivery)}`}>
                      {formatDeliveryCountdown(row.daysUntilDelivery) || '—'}
                    </div>
                    <div className="text-[11px] text-slate-500">{row.deliveryDate || '—'}</div>
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS}`}>
                    <div className="font-semibold tabular-nums text-slate-900">{row.orderNumber}</div>
                    <div className="truncate text-xs text-slate-500">{row.customer || '—'}</div>
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS}`}>
                    <div className="font-medium text-slate-900">{row.productName || '—'}</div>
                    <div className="text-xs text-slate-500">
                      {row.productCode || '—'} · {row.productKindLabel}
                    </div>
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} text-center`}>
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {PRODUCTION_PLAN_SCOPE_LABELS[row.scope]}
                    </span>
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums`}>
                    <div className="font-semibold text-slate-900">{formatQty(row.remainingQty)}</div>
                    <div className="text-[11px] text-slate-500">
                      생산 {formatQty(row.producedQty)} / 주문 {formatQty(row.orderQty)}
                    </div>
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS}`}>
                    <MaterialChip row={row} />
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} text-xs text-slate-700`}>
                    {formatSchedule(row)}
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} text-center`}>
                    <span
                      className={[
                        'inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold',
                        row.status === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700',
                      ].join(' ')}
                    >
                      {PRODUCTION_PLAN_STATUS_LABELS[row.status]}
                    </span>
                  </td>
                  <td className={`${ERP_TABLE_TD_CLASS} text-right`}>
                    {row.status === 'confirmed' ? (
                      <div className="flex justify-end gap-1.5">
                        <ErpButton
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => onConfirm(row)}
                          className="!px-3 !py-1.5 text-xs"
                        >
                          변경
                        </ErpButton>
                        <ErpButton
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => onUnconfirm(row)}
                          className="!px-3 !py-1.5 text-xs"
                        >
                          대기로
                        </ErpButton>
                      </div>
                    ) : (
                      <ErpButton
                        type="button"
                        variant="primary"
                        disabled={busy}
                        onClick={() => onConfirm(row)}
                        className="!px-3 !py-1.5 text-xs"
                      >
                        확정
                      </ErpButton>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
