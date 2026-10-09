'use client'

import { useEffect, useMemo, useState } from 'react'
import { MaterialManualFetchError } from '@/components/materials/manual/material-manual-fetch-error'
import { MaterialManualModal } from '@/components/materials/manual/material-manual-modal'
import { MaterialManualTable } from '@/components/materials/manual/material-manual-table'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import type { MaterialManualSaveInput } from '@/components/materials/manual/material-manual-input-panel'
import type {
  FetchMaterialManualPageResult,
  MaterialManualHistoryKind,
} from '@/lib/materials/manual/types'
import {
  fetchMaterialManualPageData,
  MATERIAL_EXPECTED_INBOUND_SQL_HINT,
  saveMaterialExpectedInboundDate,
  saveMaterialManualInbound,
  saveMaterialManualOutbound,
} from '@/lib/materials/manual/repository'
import {
  countMaterialInboundStates,
  filterOrdersByMaterialInbound,
  type MaterialInboundFilter,
} from '@/lib/materials/manual/utils'
import { filterProductionOrders } from '@/lib/production-input/utils'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type MaterialManualWorkspaceProps = {
  initialResult: FetchMaterialManualPageResult
  initialUiKey?: string
}

export function MaterialManualWorkspace({
  initialResult,
  initialUiKey = '',
}: MaterialManualWorkspaceProps) {
  const { notifyAuthOrFailure } = useWriteFailureToast()
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState(initialUiKey)
  const [inputOpen, setInputOpen] = useState(false)
  const [inputKind, setInputKind] = useState<MaterialManualHistoryKind>('inbound')
  const [statusFilter, setStatusFilter] = useState<MaterialInboundFilter>('all')
  const [orders, setOrders] = useState<ProductionOrderLine[]>(
    initialResult.ok ? initialResult.data.orders : [],
  )
  const [metricsByLineId, setMetricsByLineId] = useState(
    initialResult.ok ? initialResult.data.metricsByLineId : {},
  )
  const [error, setError] = useState(initialResult.ok ? '' : initialResult.detail)
  const [refreshing, setRefreshing] = useState(false)
  const [expectedInboundByLineId, setExpectedInboundByLineId] = useState<Record<string, string>>(
    initialResult.ok ? initialResult.data.expectedInboundByLineId : {},
  )
  const [expectedTableMissing, setExpectedTableMissing] = useState(
    initialResult.ok ? Boolean(initialResult.data.expectedInboundTableMissing) : false,
  )
  const [savingExpectedLineIds, setSavingExpectedLineIds] = useState<Set<string>>(
    () => new Set(),
  )

  useEffect(() => {
    setSelectedKey(initialUiKey)
    if (initialUiKey) setInputOpen(true)
  }, [initialUiKey])

  const inboundByLineId = useMemo(() => {
    const map: Record<string, number> = {}
    for (const [lineId, metrics] of Object.entries(metricsByLineId)) {
      map[lineId] = metrics.inboundSets
    }
    return map
  }, [metricsByLineId])

  const searched = useMemo(
    () => filterProductionOrders(orders, search),
    [orders, search],
  )

  const statusCounts = useMemo(
    () => countMaterialInboundStates(searched, inboundByLineId),
    [searched, inboundByLineId],
  )

  const filtered = useMemo(
    () => filterOrdersByMaterialInbound(searched, statusFilter, inboundByLineId),
    [searched, statusFilter, inboundByLineId],
  )

  const selectedOrder = useMemo(
    () =>
      filtered.find((order) => order.uiKey === selectedKey) ??
      orders.find((order) => order.uiKey === selectedKey) ??
      null,
    [filtered, orders, selectedKey],
  )

  const selectedMetrics = selectedOrder
    ? metricsByLineId[selectedOrder.orderLineId] ?? { inboundSets: 0, outboundSets: 0 }
    : { inboundSets: 0, outboundSets: 0 }

  async function reload() {
    setRefreshing(true)
    setError('')
    const result = await fetchMaterialManualPageData()
    setRefreshing(false)
    if (!result.ok) {
      setError(result.detail)
      return
    }
    setOrders(result.data.orders)
    setMetricsByLineId(result.data.metricsByLineId)
    setExpectedInboundByLineId(result.data.expectedInboundByLineId)
    setExpectedTableMissing(Boolean(result.data.expectedInboundTableMissing))
  }

  async function handleExpectedInboundChange(order: ProductionOrderLine, expectedDate: string) {
    const lineId = order.orderLineId
    const previous = expectedInboundByLineId[lineId] ?? ''
    if (previous === expectedDate) return

    setExpectedInboundByLineId((current) => {
      const next = { ...current }
      if (expectedDate) next[lineId] = expectedDate
      else delete next[lineId]
      return next
    })
    setSavingExpectedLineIds((current) => new Set(current).add(lineId))

    const result = await saveMaterialExpectedInboundDate({
      orderId: order.orderId,
      orderLineId: lineId,
      expectedDate,
    })

    setSavingExpectedLineIds((current) => {
      const next = new Set(current)
      next.delete(lineId)
      return next
    })
    if (!result.ok) {
      setExpectedInboundByLineId((current) => {
        const next = { ...current }
        if (previous) next[lineId] = previous
        else delete next[lineId]
        return next
      })
      notifyAuthOrFailure(result, { toastAllFailures: true, title: '예상입고일 저장 실패' })
      setError(result.detail)
      return
    }
    setError('')
  }

  async function handleSave(input: MaterialManualSaveInput) {
    if (!selectedOrder) return false

    const isInbound = input.kind === 'inbound'
    const kindLabel = isInbound ? '입고' : '불출'
    const quantity = Math.floor(Number(input.quantity) || 0)
    if (quantity < 1) {
      setError(`${kindLabel} 수량을 입력하세요.`)
      return false
    }
    if (!isInbound) {
      const available = Math.max(0, selectedMetrics.inboundSets - selectedMetrics.outboundSets)
      if (quantity > available) {
        setError(
          `불출 가능 수량(${available.toLocaleString('ko-KR')})보다 많이 불출할 수 없습니다. 먼저 입고를 등록하세요.`,
        )
        return false
      }
    }

    const payload = {
      orderId: selectedOrder.orderId,
      orderLineId: selectedOrder.orderLineId,
      recordDate: input.recordDate,
      quantity,
    }
    const saveResult = isInbound
      ? await saveMaterialManualInbound(payload)
      : await saveMaterialManualOutbound(payload)
    if (!saveResult.ok) {
      notifyAuthOrFailure(saveResult, { toastAllFailures: true, title: `${kindLabel} 저장 실패` })
      setError(saveResult.detail)
      return false
    }

    setError('')
    await reload()
    return true
  }

  function handleOrderClick(order: ProductionOrderLine, kind: MaterialManualHistoryKind) {
    setSelectedKey(order.uiKey)
    setInputKind(kind)
    setError('')
    setInputOpen(true)
  }

  function closeInputModal() {
    setInputOpen(false)
  }

  if (!initialResult.ok && !orders.length) {
    return <MaterialManualFetchError result={initialResult} />
  }

  const statusChips = [
    { value: 'all' as const, label: '전체', count: statusCounts.all },
    {
      value: 'none' as const,
      label: '미입고',
      count: statusCounts.none,
      tone: STATUS_FILTER_TONES.waiting,
    },
    {
      value: 'partial' as const,
      label: '일부입고',
      count: statusCounts.partial,
      tone: STATUS_FILTER_TONES.progress,
    },
    {
      value: 'full' as const,
      label: '입고완료',
      count: statusCounts.full,
      tone: STATUS_FILTER_TONES.done,
    },
  ]

  return (
    <>
      {error ? (
        <div className="mb-3 shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      {expectedTableMissing ? (
        <div className="mb-3 shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          예상입고일 테이블이 아직 없습니다. {MATERIAL_EXPECTED_INBOUND_SQL_HINT}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="발주번호, 품목코드, 품목명, 고객사 검색…"
          accent="orange"
          filters={
            <FilterChipBar
              options={statusChips}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          }
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MaterialManualTable
            orders={filtered}
            metricsByLineId={metricsByLineId}
            onOrderClick={handleOrderClick}
            expectedInboundByLineId={expectedInboundByLineId}
            savingExpectedLineIds={savingExpectedLineIds}
            onExpectedInboundChange={
              expectedTableMissing ? undefined : (order, date) => void handleExpectedInboundChange(order, date)
            }
            emptyMessage={formatEmptyListMessage({
              hasQuery: Boolean(search.trim()) || statusFilter !== 'all',
              emptyLabel: '표시할 발주가 없습니다',
              actionHint: '입고 또는 불출 셀을 클릭하면 등록 모달이 열립니다',
            })}
          />
        </div>
      </div>

      <MaterialManualModal
        open={inputOpen}
        order={selectedOrder}
        metrics={selectedMetrics}
        kind={inputKind}
        onKindChange={setInputKind}
        refreshing={refreshing}
        onClose={closeInputModal}
        onSave={handleSave}
        onHistoryChanged={() => void reload()}
      />
    </>
  )
}
