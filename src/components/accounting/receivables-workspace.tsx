'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { ReceivablesPaymentModal } from '@/components/accounting/receivables-payment-modal'
import { ReceivablesTable } from '@/components/accounting/receivables-table'
import { useBusy } from '@/components/ui/busy-provider'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { ErpButton } from '@/components/ui/erp-button'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { FilterChipBar, STATUS_FILTER_TONES, type FilterChipTone } from '@/components/ui/filter-chip'
import { KpiStatCard } from '@/components/ui/kpi-stat-card'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import { createStatementPayment, type FetchReceivablesResult } from '@/lib/accounting/repository'
import type { ReceivableRow, ReceivableStatusFilter } from '@/lib/accounting/types'
import { RECEIVABLE_STATUS_LABELS } from '@/lib/accounting/types'
import { filterReceivableRows, summarizeReceivables } from '@/lib/accounting/utils'
import { downloadExcel } from '@/lib/excel/export'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { currentMonthRange } from '@/lib/reports/period'
import { DATE_RANGE_FILTER_LABEL } from '@/lib/ui/date-range'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type ReceivablesWorkspaceProps = {
  result: FetchReceivablesResult
  startDate: string
  endDate: string
  rangeLabel: string
}

type ModalState = { open: false } | { open: true; shipmentId: string }

const OVERDUE_TONE: FilterChipTone = {
  idleClassName: 'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
  activeClassName: 'bg-rose-600 text-white shadow-sm',
  activeCountClassName: 'text-rose-100',
}

const PARTIAL_TONE: FilterChipTone = {
  idleClassName: 'border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100',
  activeClassName: 'bg-sky-600 text-white shadow-sm',
  activeCountClassName: 'text-sky-100',
}

function buildReceivablesHref(startDate: string, endDate: string) {
  const params = new URLSearchParams()
  if (startDate) params.set('start', startDate)
  if (endDate) params.set('end', endDate)
  const query = params.toString()
  return query ? `/accounting/receivables?${query}` : '/accounting/receivables'
}

export function ReceivablesWorkspace({
  result,
  startDate: initialStartDate,
  endDate: initialEndDate,
  rangeLabel,
}: ReceivablesWorkspaceProps) {
  const router = useRouter()
  const { afterSave } = useSaveFeedback()
  const busyUi = useBusy()
  const { notifyAuthOrFailure, toast } = useWriteFailureToast()
  const [isPending, startTransition] = useTransition()
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReceivableStatusFilter>('open')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [markingPaid, setMarkingPaid] = useState(false)

  useEffect(() => {
    setStartDate(initialStartDate)
    setEndDate(initialEndDate)
  }, [initialStartDate, initialEndDate])

  const rows = result.ok ? result.rows : []
  const paymentsMissing = result.ok ? result.paymentsMissing : false

  const filtered = useMemo(
    () => filterReceivableRows(rows, search, statusFilter),
    [rows, search, statusFilter],
  )

  const searched = useMemo(
    () => filterReceivableRows(rows, search, 'all'),
    [rows, search],
  )

  const kpi = useMemo(() => summarizeReceivables(searched), [searched])

  const selectableRows = useMemo(
    () => filtered.filter((row) => row.remaining > 0),
    [filtered],
  )

  const selectedRows = useMemo(
    () => selectableRows.filter((row) => selectedIds.has(row.shipmentId)),
    [selectableRows, selectedIds],
  )
  const selectedCount = selectedRows.length
  const allSelectableSelected =
    selectableRows.length > 0 && selectableRows.every((row) => selectedIds.has(row.shipmentId))

  const statusOptions = useMemo(
    () => [
      {
        value: 'open' as const,
        label: '미수금',
        count: searched.filter((row) => row.status !== 'paid').length,
        tone: STATUS_FILTER_TONES.progress,
      },
      {
        value: 'overdue' as const,
        label: '연체',
        count: searched.filter((row) => row.status === 'overdue').length,
        tone: OVERDUE_TONE,
      },
      {
        value: 'partial' as const,
        label: '일부',
        count: searched.filter((row) => row.status === 'partial').length,
        tone: PARTIAL_TONE,
      },
      {
        value: 'paid' as const,
        label: '완료',
        count: searched.filter((row) => row.status === 'paid').length,
        tone: STATUS_FILTER_TONES.done,
      },
      {
        value: 'all' as const,
        label: '전체',
        count: searched.length,
      },
    ],
    [searched],
  )

  const activeRow = modal.open
    ? rows.find((row) => row.shipmentId === modal.shipmentId) ?? null
    : null

  const hasActiveFilter = Boolean(search.trim()) || statusFilter !== 'open'

  const monthRange = currentMonthRange()

  function applyDateRange(nextStart: string, nextEnd: string) {
    setStartDate(nextStart)
    setEndDate(nextEnd)
    setSelectedIds(new Set())
    startTransition(() => router.push(buildReceivablesHref(nextStart, nextEnd)))
  }

  function handleStartDateChange(value: string) {
    if (!value && !endDate) {
      applyDateRange(monthRange.startDate, monthRange.endDate)
      return
    }
    setStartDate(value)
    if (value && endDate) {
      setSelectedIds(new Set())
      startTransition(() => router.push(buildReceivablesHref(value, endDate)))
    }
  }

  function handleEndDateChange(value: string) {
    if (!startDate && !value) {
      applyDateRange(monthRange.startDate, monthRange.endDate)
      return
    }
    setEndDate(value)
    if (startDate && value) {
      setSelectedIds(new Set())
      startTransition(() => router.push(buildReceivablesHref(startDate, value)))
    }
  }

  function toggleSelectAll() {
    if (allSelectableSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const row of selectableRows) next.delete(row.shipmentId)
        return next
      })
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const row of selectableRows) next.add(row.shipmentId)
      return next
    })
  }

  function toggleSelectOne(shipmentId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(shipmentId)) next.delete(shipmentId)
      else next.add(shipmentId)
      return next
    })
  }

  async function handleMarkPaid() {
    if (markingPaid || selectedCount === 0 || paymentsMissing) return
    if (
      !window.confirm(
        `선택한 ${selectedCount}건을 잔액 전액 입금완료로 기록할까요?\n입금일은 오늘(${todayYmdSeoul()})로 저장됩니다.`,
      )
    ) {
      return
    }

    setMarkingPaid(true)
    const paidDate = todayYmdSeoul()

    const { successCount, lastError } = await busyUi.run(async () => {
      let successCount = 0
      let lastError: { ok: false; reason: string; detail: string } | null = null
      for (const row of selectedRows) {
        if (row.remaining <= 0) continue
        const result = await createStatementPayment({
          shipmentId: row.shipmentId,
          paidDate,
          amount: row.remaining,
        })
        if (!result.ok) {
          lastError = result
          break
        }
        successCount += 1
      }
      return { successCount, lastError }
    })

    setMarkingPaid(false)

    if (lastError) {
      if (!notifyAuthOrFailure(lastError)) {
        toast.error(
          successCount > 0 ? `${successCount}건 반영 후 오류` : '입금완료 실패',
          lastError.detail,
        )
      }
      if (successCount > 0) {
        setSelectedIds(new Set())
        afterSave(`${successCount}건을 입금완료로 기록했습니다.`, { refresh: true })
      }
      return
    }

    setSelectedIds(new Set())
    afterSave(`${successCount}건을 입금완료로 기록했습니다.`, { refresh: true })
  }

  async function handleExcelDownload() {
    await downloadExcel({
      fileName: `수금현황_${initialStartDate}_${initialEndDate}`,
      sheetName: '수금현황',
      columns: [
        { header: '출하번호', value: (row: ReceivableRow) => row.shipmentId, width: 16 },
        { header: '고객사', value: (row) => row.customer, width: 18 },
        { header: '품목', value: (row) => row.productName, width: 26 },
        { header: '발행일', value: (row) => row.issueDate, width: 12 },
        { header: '입금예정일', value: (row) => row.expectedDate || '', width: 12 },
        { header: '입금일', value: (row) => row.paidDate || '', width: 12 },
        { header: '공급가액', value: (row) => row.amount, width: 12 },
        { header: '입금액', value: (row) => row.paidAmount, width: 12 },
        { header: '잔액', value: (row) => row.remaining, width: 12 },
        { header: '발주번호', value: (row) => row.orderNumber, width: 22 },
        { header: '상태', value: (row) => RECEIVABLE_STATUS_LABELS[row.status], width: 10 },
      ],
      rows: filtered,
    })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleSaved(message: string) {
    afterSave(message, { refresh: true })
  }

  return (
    <>
      <PageShell>
        {!result.ok ? (
          <FetchErrorBanner title="수금 현황을 불러오지 못했습니다" detail={result.detail} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            {result.warning ? (
              <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {result.warning}
              </div>
            ) : null}

            <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
              <KpiStatCard label="명세서 금액" value={kpi.statementAmount} unit="원" />
              <KpiStatCard label="입금액" value={kpi.paidAmount} unit="원" tone="sky" />
              <KpiStatCard label="미수금" value={kpi.remainingAmount} unit="원" tone="amber" />
              <KpiStatCard label="연체" value={kpi.overdueAmount} unit="원" tone="rose" />
            </div>

            <WorkspaceHeader
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="출하번호 · 고객사 · 발주번호 · 품목 검색…"
              inlineFilters={
                <DateRangeFilter
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={handleStartDateChange}
                  onEndDateChange={handleEndDateChange}
                  label={DATE_RANGE_FILTER_LABEL.issue}
                  defaultStartDate={monthRange.startDate}
                  defaultEndDate={monthRange.endDate}
                  onClear={() => applyDateRange(monthRange.startDate, monthRange.endDate)}
                />
              }
              actions={
                <>
                  <p className="text-xs whitespace-nowrap text-slate-500">
                    기간 {rangeLabel}
                    {isPending ? ' · 불러오는 중…' : ''}
                    {' · '}
                    {filtered.length.toLocaleString('ko-KR')}건
                  </p>
                  <ErpButton
                    disabled={selectedCount === 0 || markingPaid || paymentsMissing || isPending}
                    loading={markingPaid}
                    onClick={() => void handleMarkPaid()}
                  >
                    {selectedCount > 0 ? `입금완료 (${selectedCount})` : '입금완료'}
                  </ErpButton>
                  <ExcelDownloadButton onDownload={handleExcelDownload} disabled={!result.ok || isPending} />
                </>
              }
              filters={
                <FilterChipBar
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value)
                    setSelectedIds(new Set())
                  }}
                />
              }
            />

            <ReceivablesTable
              rows={filtered}
              emptyMessage={formatEmptyListMessage({
                hasQuery: hasActiveFilter,
                emptyLabel: '기간 내 거래명세서가 없습니다',
                actionHint: '영업관리 거래명세서에서 출하 내역을 확인하세요.',
              })}
              onRowClick={(row) => setModal({ open: true, shipmentId: row.shipmentId })}
              selectedIds={selectedIds}
              onToggleSelectAll={toggleSelectAll}
              onToggleSelectOne={toggleSelectOne}
              selectionDisabled={markingPaid}
              allSelectableSelected={allSelectableSelected}
            />
          </div>
        )}
      </PageShell>

      <ReceivablesPaymentModal
        open={modal.open}
        row={activeRow}
        paymentsMissing={paymentsMissing}
        onClose={closeModal}
        onSaved={handleSaved}
      />
    </>
  )
}
