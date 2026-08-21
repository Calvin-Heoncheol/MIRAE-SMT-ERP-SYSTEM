'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { LegacyStatementModal } from '@/components/reports/legacy-statement-modal'
import { SalesStatementEditModal } from '@/components/reports/sales-statement-edit-modal'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpButton } from '@/components/ui/erp-button'
import { KpiStatCard } from '@/components/ui/kpi-stat-card'
import { PageShell } from '@/components/ui/page-shell'
import { PdfDownloadButton } from '@/components/ui/pdf-download-button'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import {
  buildDeliveryStatementDataFromShipment,
  printDeliveryStatements,
} from '@/lib/delivery/print-delivery-statement'
import type { DeliveryStatementData } from '@/lib/delivery/types'
import { currentMonthRange } from '@/lib/reports/period'
import {
  groupSalesReportShipments,
  type FetchSalesReportResult,
  type SalesReportStatementGroup,
} from '@/lib/reports/sales-report'
import { deleteStatementLines } from '@/lib/reports/statement-edit'
import { DATE_RANGE_FILTER_LABEL } from '@/lib/ui/date-range'
import {
  ERP_SECONDARY_BUTTON_CLASS,
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
  formatEmptyListMessage,
} from '@/lib/ui/tokens'

type SalesReportWorkspaceProps = {
  result: FetchSalesReportResult
  startDate: string
  endDate: string
  rangeLabel: string
}

function formatCount(value: number) {
  return value.toLocaleString('ko-KR')
}

function statementRowKey(row: Pick<SalesReportStatementGroup, 'source' | 'shipmentId'>) {
  return `${row.source}-${row.shipmentId}`
}

function buildSalesHref(startDate: string, endDate: string) {
  const params = new URLSearchParams()
  if (startDate) params.set('start', startDate)
  if (endDate) params.set('end', endDate)
  const query = params.toString()
  return query ? `/reports/sales?${query}` : '/reports/sales'
}

export function SalesReportWorkspace({
  result,
  startDate: initialStartDate,
  endDate: initialEndDate,
  rangeLabel,
}: SalesReportWorkspaceProps) {
  const router = useRouter()
  const canDelete = useCanDeleteRecords()
  const [isPending, startTransition] = useTransition()
  const data = result.ok ? result.data : null
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [search, setSearch] = useState('')
  const [printing, setPrinting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<SalesReportStatementGroup | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setStartDate(initialStartDate)
    setEndDate(initialEndDate)
  }, [initialStartDate, initialEndDate])

  const filteredShipments = useMemo(() => {
    const groups = groupSalesReportShipments(data?.shipments ?? [])
    const query = search.trim().toLowerCase()
    if (!query) return groups
    return groups.filter((row) =>
      [row.shipmentId, row.orderNumber, row.customer, row.productName, row.productCode, row.recordDate]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [data?.shipments, search])

  const selectedGroups = useMemo(
    () => filteredShipments.filter((row) => selectedIds.has(statementRowKey(row))),
    [filteredShipments, selectedIds],
  )
  const selectedCount = selectedGroups.length
  const allFilteredSelected =
    filteredShipments.length > 0 &&
    filteredShipments.every((row) => selectedIds.has(statementRowKey(row)))

  const filteredShipQty = useMemo(
    () => filteredShipments.reduce((sum, row) => sum + row.quantity, 0),
    [filteredShipments],
  )
  const filteredShipAmount = useMemo(
    () => filteredShipments.reduce((sum, row) => sum + row.amount, 0),
    [filteredShipments],
  )

  const monthRange = currentMonthRange()

  function applyDateRange(nextStart: string, nextEnd: string) {
    setStartDate(nextStart)
    setEndDate(nextEnd)
    setSelectedIds(new Set())
    startTransition(() => {
      router.push(buildSalesHref(nextStart, nextEnd))
    })
  }

  function handleStartDateChange(value: string) {
    if (!value && !endDate) {
      applyDateRange(monthRange.startDate, monthRange.endDate)
      return
    }
    setStartDate(value)
    if (value && endDate) {
      setSelectedIds(new Set())
      startTransition(() => {
        router.push(buildSalesHref(value, endDate))
      })
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
      startTransition(() => {
        router.push(buildSalesHref(startDate, value))
      })
    }
  }

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const row of filteredShipments) next.delete(statementRowKey(row))
        return next
      })
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const row of filteredShipments) next.add(statementRowKey(row))
      return next
    })
  }

  function toggleSelectOne(key: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleDeleteSelected() {
    if (deleting || selectedCount === 0) return
    if (
      !window.confirm(
        `선택한 거래명세서 ${selectedCount}건을 삭제할까요?\n삭제 후에는 복구할 수 없습니다.`,
      )
    ) {
      return
    }

    setDeleting(true)
    setPrintError(null)
    setSaveMessage(null)

    const lines = selectedGroups.flatMap((group) =>
      group.lines.map((line) => ({
        source: line.source,
        deliveryId: line.deliveryId,
        orderNumber: line.orderId || line.orderNumber,
        orderLineId: line.orderLineId,
        productCode: line.productCode,
      })),
    )
    const deleteResult = await deleteStatementLines(lines)
    setDeleting(false)

    if (!deleteResult.ok) {
      setPrintError(deleteResult.detail)
      return
    }

    setSelectedIds(new Set())
    setSaveMessage(`거래명세서 ${selectedCount}건을 삭제했습니다.`)
    startTransition(() => {
      router.refresh()
    })
  }

  async function handleStatementPrint() {
    if (!selectedGroups.length) {
      setPrintError('거래명세서를 출력할 항목을 체크박스로 선택해 주세요.')
      return
    }

    setPrinting(true)
    setPrintError(null)

    try {
      const statements: DeliveryStatementData[] = []
      const failures: string[] = []

      for (const group of selectedGroups) {
        const shipmentId = group.shipmentId
        if (!group.customer) {
          failures.push(`${shipmentId}`)
          continue
        }
        const built = await buildDeliveryStatementDataFromShipment({
          shipmentId,
          shipDate: group.recordDate,
          customer: group.customer,
          shippedLines: group.lines.map((row) => ({
            orderNumber: row.orderNumber,
            productCode: row.productCode,
            productName: row.productName,
            qty: row.quantity,
            unitPrice: row.unitPrice,
          })),
        })
        if (!built.ok) {
          failures.push(`${shipmentId}(${built.detail})`)
          continue
        }
        statements.push(built.data)
      }

      if (!statements.length) {
        setPrintError(
          failures.length
            ? `거래명세서를 만들 수 없습니다.\n${failures.slice(0, 5).join('\n')}`
            : '출력할 거래명세서가 없습니다.',
        )
        return
      }

      const ok = printDeliveryStatements(statements)
      if (!ok) {
        setPrintError('인쇄 창을 열 수 없습니다. 브라우저 팝업 차단을 해제한 뒤 다시 시도해 주세요.')
        return
      }

      if (failures.length) {
        setPrintError(
          `${statements.length}건 인쇄 · ${failures.length}건 실패\n${failures.slice(0, 3).join('\n')}`,
        )
      }
    } finally {
      setPrinting(false)
    }
  }

  return (
    <PageShell>
      {data ? (
        <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
          <KpiStatCard
            label="발주 건수"
            value={data.totalOrderCount}
            unit="건"
            hint="발주일 기준"
          />
          <KpiStatCard label="발주 금액" value={data.totalOrderAmount} unit="원" />
          <KpiStatCard
            label="출하 수량"
            value={search.trim() ? filteredShipQty : data.totalShippedQuantity}
            unit="EA"
            hint="출하일 기준"
          />
          <KpiStatCard
            label="출하 금액"
            value={search.trim() ? filteredShipAmount : data.totalShippedAmount}
            unit="원"
          />
        </div>
      ) : null}

      <WorkspaceHeader
        search={search}
        onSearchChange={(value) => {
          setSearch(value)
          setSelectedIds(new Set())
        }}
        searchPlaceholder="출하번호, 고객사, 발주번호, 품목 검색…"
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
              {data ? ` · ${filteredShipments.length.toLocaleString('ko-KR')}건` : ''}
            </p>
            <button
              type="button"
              onClick={() => setLegacyOpen(true)}
              disabled={isPending}
              className={`${ERP_SECONDARY_BUTTON_CLASS} !px-3 !py-2 text-xs`}
            >
              과거 등록
            </button>
            {canDelete ? (
              <ErpButton
                variant="danger"
                className="!px-3 !py-2 text-xs"
                disabled={selectedCount === 0 || isPending}
                loading={deleting}
                onClick={() => void handleDeleteSelected()}
              >
                {deleting
                  ? '삭제 중…'
                  : selectedCount > 0
                    ? `삭제 (${selectedCount})`
                    : '삭제'}
              </ErpButton>
            ) : null}
            <PdfDownloadButton
              onDownload={() => void handleStatementPrint()}
              disabled={!data || printing || isPending || selectedCount === 0}
              label={
                printing
                  ? '준비 중…'
                  : selectedCount > 0
                    ? `거래명세서 (${selectedCount})`
                    : '거래명세서'
              }
            />
          </>
        }
      />

      {saveMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-900">
          {saveMessage}
        </div>
      ) : null}

      {printError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm whitespace-pre-wrap text-amber-900">
          {printError}
        </div>
      ) : null}

      {!result.ok ? (
        <FetchErrorBanner title="리포트 데이터를 불러오지 못했습니다" detail={result.detail} />
      ) : data ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className={ERP_TABLE_WRAP_CLASS}>
            <div className="shrink-0 border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">거래명세서 내역</h2>
              <p className="mt-1 text-xs text-slate-500">
                같은 출하번호는 한 행으로 묶습니다. 체크박스로 선택 후 삭제·거래명세서 출력, 행을
                클릭하면 내역을 수정할 수 있습니다.
              </p>
            </div>
            {filteredShipments.length ? (
              <>
                <div className={ERP_TABLE_SCROLL_CLASS}>
                  <table className={`${ERP_TABLE_CLASS} min-w-[960px]`}>
                    <thead className={ERP_TABLE_HEAD_CLASS}>
                      <tr>
                        <th className={`${ERP_TABLE_TH_CLASS} w-10 text-center`}>
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            disabled={deleting || printing}
                            onChange={toggleSelectAll}
                            aria-label="전체 선택"
                            className="size-4 accent-slate-700"
                          />
                        </th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-left`}>발행일</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-left`}>출하번호</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-left`}>발주번호</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-left`}>고객사</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-left`}>품목</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-right`}>수량</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-right`}>단가</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-right`}>금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredShipments.map((row) => {
                        const key = statementRowKey(row)
                        const selected = selectedIds.has(key)
                        return (
                          <tr
                            key={key}
                            className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/80"
                            onClick={() => setEditingGroup(row)}
                          >
                            <td
                              className={`${ERP_TABLE_TD_CLASS} text-center`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                disabled={deleting || printing}
                                onChange={() => toggleSelectOne(key)}
                                aria-label={`${row.shipmentId || row.orderNumber} 선택`}
                                className="size-4 accent-slate-700"
                              />
                            </td>
                            <td
                              className={`${ERP_TABLE_TD_CLASS} whitespace-nowrap tabular-nums text-slate-700`}
                            >
                              {row.recordDate || '—'}
                            </td>
                            <td
                              className={`${ERP_TABLE_TD_CLASS} whitespace-nowrap font-mono text-xs font-semibold text-slate-800`}
                            >
                              {row.shipmentId || '—'}
                            </td>
                            <td
                              className={`${ERP_TABLE_TD_CLASS} whitespace-nowrap font-mono text-xs text-slate-700`}
                            >
                              {row.orderNumber || '—'}
                            </td>
                            <td
                              className={`${ERP_TABLE_TD_CLASS} font-semibold text-slate-900 ${ERP_TABLE_TD_WRAP_CLASS}`}
                            >
                              {row.customer || '—'}
                            </td>
                            <td
                              className={`${ERP_TABLE_TD_CLASS} text-slate-800 ${ERP_TABLE_TD_WRAP_CLASS}`}
                            >
                              {row.productName || '—'}
                            </td>
                            <td
                              className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums text-slate-700`}
                            >
                              {formatCount(row.quantity)}
                            </td>
                            <td
                              className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums text-slate-700`}
                            >
                              {row.unitPriceMixed ? '—' : formatCount(row.unitPrice)}
                            </td>
                            <td
                              className={`${ERP_TABLE_TD_CLASS} text-right font-semibold tabular-nums text-slate-900`}
                            >
                              {formatCount(row.amount)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <EmptyListState
                  message={formatEmptyListMessage({
                    hasQuery: Boolean(search.trim()),
                    emptyLabel: '기간 내 거래명세서 내역이 없습니다',
                  })}
                />
              </div>
            )}
          </div>
        </div>
      ) : null}

      <LegacyStatementModal
        open={legacyOpen}
        onClose={() => setLegacyOpen(false)}
        defaultShipDate={initialStartDate}
        onSaved={(message) => {
          setSaveMessage(message ?? '과거 거래명세서를 등록했습니다.')
          startTransition(() => {
            router.refresh()
          })
        }}
      />
      <SalesStatementEditModal
        open={Boolean(editingGroup)}
        group={editingGroup}
        onClose={() => setEditingGroup(null)}
        onSaved={(message) => {
          setSaveMessage(message ?? '거래명세서 내역을 수정했습니다.')
          startTransition(() => {
            router.refresh()
          })
        }}
      />
    </PageShell>
  )
}
