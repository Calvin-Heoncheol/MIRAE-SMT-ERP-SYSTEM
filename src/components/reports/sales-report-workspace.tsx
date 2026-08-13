'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { CustomerFilterCombobox } from '@/components/reports/customer-filter-combobox'
import { LegacyStatementModal } from '@/components/reports/legacy-statement-modal'
import { SalesStatementEditModal } from '@/components/reports/sales-statement-edit-modal'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { ExcelDownloadButton } from '@/components/ui/excel-download-button'
import { KpiStatCard } from '@/components/ui/kpi-stat-card'
import { PageShell } from '@/components/ui/page-shell'
import { PdfDownloadButton } from '@/components/ui/pdf-download-button'
import {
  buildDeliveryStatementDataFromShipment,
  printDeliveryStatements,
} from '@/lib/delivery/print-delivery-statement'
import type { DeliveryStatementData } from '@/lib/delivery/types'
import { downloadExcelSheets, type ExcelColumn } from '@/lib/excel/export'
import type { FetchSalesReportResult, SalesReportShipmentRow } from '@/lib/reports/sales-report'
import {
  ERP_SECONDARY_BUTTON_CLASS,
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
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
  const [isPending, startTransition] = useTransition()
  const data = result.ok ? result.data : null
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [customerFilter, setCustomerFilter] = useState('')
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<SalesReportShipmentRow | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    setStartDate(initialStartDate)
    setEndDate(initialEndDate)
  }, [initialStartDate, initialEndDate])

  const selectedCustomer = customerFilter.trim()

  const customerOptions = useMemo(() => {
    const names = new Set<string>()
    for (const row of data?.shipments ?? []) {
      const name = row.customer.trim()
      if (name) names.add(name)
    }
    for (const row of data?.customers ?? []) {
      const name = row.customer.trim()
      if (name) names.add(name)
    }
    return [...names]
  }, [data?.customers, data?.shipments])

  const filteredShipments = useMemo(() => {
    const rows = data?.shipments ?? []
    const filtered = selectedCustomer
      ? rows.filter((row) => row.customer.trim() === selectedCustomer)
      : rows
    return [...filtered].sort((a, b) => {
      const byDate = b.recordDate.localeCompare(a.recordDate)
      if (byDate !== 0) return byDate
      return b.deliveryId.localeCompare(a.deliveryId)
    })
  }, [data?.shipments, selectedCustomer])

  const filteredOrderCount = useMemo(() => {
    if (!selectedCustomer) return data?.totalOrderCount ?? 0
    return (data?.customers ?? [])
      .filter((row) => row.customer === selectedCustomer)
      .reduce((sum, row) => sum + row.orderCount, 0)
  }, [data?.customers, data?.totalOrderCount, selectedCustomer])

  const filteredOrderAmount = useMemo(() => {
    if (!selectedCustomer) return data?.totalOrderAmount ?? 0
    return (data?.customers ?? [])
      .filter((row) => row.customer === selectedCustomer)
      .reduce((sum, row) => sum + row.orderAmount, 0)
  }, [data?.customers, data?.totalOrderAmount, selectedCustomer])

  const filteredShipQty = useMemo(
    () => filteredShipments.reduce((sum, row) => sum + row.quantity, 0),
    [filteredShipments],
  )
  const filteredShipAmount = useMemo(
    () => filteredShipments.reduce((sum, row) => sum + row.amount, 0),
    [filteredShipments],
  )

  function handleStartDateChange(value: string) {
    setStartDate(value)
    if (!value && !endDate) {
      startTransition(() => {
        router.push('/reports/sales')
      })
      return
    }
    if (value && endDate) {
      startTransition(() => {
        router.push(buildSalesHref(value, endDate))
      })
    }
  }

  function handleEndDateChange(value: string) {
    setEndDate(value)
    if (!startDate && !value) {
      startTransition(() => {
        router.push('/reports/sales')
      })
      return
    }
    if (startDate && value) {
      startTransition(() => {
        router.push(buildSalesHref(startDate, value))
      })
    }
  }

  async function handleExcelDownload() {
    if (!data) return

    const shipmentColumns: ExcelColumn<SalesReportShipmentRow>[] = [
      { header: '출하일', value: (row) => row.recordDate, width: 12 },
      { header: '출하번호', value: (row) => row.deliveryId, width: 16 },
      { header: '발주ID', value: (row) => row.orderNumber, width: 22 },
      { header: '고객사', value: (row) => row.customer, width: 18 },
      { header: '품목', value: (row) => row.productName, width: 26 },
      { header: '수량', value: (row) => row.quantity, width: 10 },
      { header: '단가(원)', value: (row) => row.unitPrice, width: 12 },
      { header: '금액(원)', value: (row) => row.amount, width: 14 },
    ]

    await downloadExcelSheets({
      fileName: `거래명세서_${data.startDate}_${data.endDate}`,
      sheets: [
        {
          sheetName: '거래명세서 내역',
          columns: shipmentColumns as ExcelColumn<unknown>[],
          rows: filteredShipments as unknown[],
        },
      ],
    })
  }

  async function handleStatementPrint() {
    if (!filteredShipments.length) {
      setPrintError('선택한 기간에 출력할 출하(거래명세서)가 없습니다.')
      return
    }

    setPrinting(true)
    setPrintError(null)

    try {
      const groups = new Map<string, SalesReportShipmentRow[]>()
      for (const row of filteredShipments) {
        const key = row.shipmentId || row.deliveryId
        if (!key) continue
        const list = groups.get(key) || []
        list.push(row)
        groups.set(key, list)
      }

      const statements: DeliveryStatementData[] = []
      const failures: string[] = []

      for (const [shipmentId, rows] of groups) {
        const first = rows[0]!
        if (!first.customer) {
          failures.push(`${shipmentId}`)
          continue
        }
        const built = await buildDeliveryStatementDataFromShipment({
          shipmentId,
          shipDate: first.recordDate,
          customer: first.customer,
          shippedLines: rows.map((row) => ({
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
      <div className="flex flex-wrap items-center gap-3">
        <CustomerFilterCombobox
          value={customerFilter}
          options={customerOptions}
          onChange={setCustomerFilter}
          placeholder="고객사 검색…"
        />
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
          label="출하일"
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLegacyOpen(true)}
            disabled={isPending}
            className={`${ERP_SECONDARY_BUTTON_CLASS} !px-3 !py-2 text-xs`}
          >
            과거 등록
          </button>
          <PdfDownloadButton
            onDownload={() => void handleStatementPrint()}
            disabled={!data || printing || isPending || !filteredShipments.length}
            label={printing ? '준비 중…' : '거래명세서'}
          />
          <ExcelDownloadButton onDownload={handleExcelDownload} disabled={!data || isPending} />
        </div>
      </div>

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
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          리포트 데이터를 불러오지 못했습니다: {result.detail}
        </div>
      ) : data ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiStatCard
              label="수주 건수"
              value={filteredOrderCount}
              unit="건"
              hint={selectedCustomer ? '선택 고객사 · 주문일 기준' : '주문일 기준'}
            />
            <KpiStatCard label="수주 금액" value={filteredOrderAmount} unit="원" />
            <KpiStatCard
              label="출하 수량"
              value={selectedCustomer ? filteredShipQty : data.totalShippedQuantity}
              unit="EA"
              hint={selectedCustomer ? '선택 고객사 · 출하일 기준' : '출하일 기준'}
            />
            <KpiStatCard
              label="출하 금액"
              value={selectedCustomer ? filteredShipAmount : data.totalShippedAmount}
              unit="원"
            />
          </div>

          <p className="shrink-0 text-xs text-slate-500">
            기간 {rangeLabel}
            {isPending ? ' · 불러오는 중…' : ''}
            {' · '}
            내역 {filteredShipments.length.toLocaleString('ko-KR')}건
            {selectedCustomer ? ` · 고객사 ${selectedCustomer}` : ''}
          </p>

          <div className={ERP_TABLE_WRAP_CLASS}>
            <div className="shrink-0 border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">거래명세서 내역</h2>
              <p className="mt-1 text-xs text-slate-500">행을 클릭하면 내역을 수정할 수 있습니다.</p>
            </div>
            {filteredShipments.length ? (
              <>
                <div className={ERP_TABLE_SCROLL_CLASS}>
                  <table className={`${ERP_TABLE_CLASS} min-w-[960px]`}>
                    <thead className={ERP_TABLE_HEAD_CLASS}>
                      <tr>
                        <th className={`${ERP_TABLE_TH_CLASS} text-left`}>출하일</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-left`}>출하번호</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-left`}>발주ID</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-left`}>고객사</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-left`}>품목</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-right`}>수량</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-right`}>단가</th>
                        <th className={`${ERP_TABLE_TH_CLASS} text-right`}>금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredShipments.map((row) => (
                        <tr
                          key={`${row.source}-${row.deliveryId}-${row.orderLineId}`}
                          className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/80"
                          onClick={() => setEditingRow(row)}
                        >
                          <td className={`${ERP_TABLE_TD_CLASS} whitespace-nowrap tabular-nums text-slate-700`}>
                            {row.recordDate || '—'}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} whitespace-nowrap font-mono text-xs font-semibold text-slate-800`}>
                            {row.deliveryId || '—'}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} whitespace-nowrap font-mono text-xs text-slate-700`}>
                            {row.orderNumber || '—'}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} font-semibold text-slate-900 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                            {row.customer || '—'}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} text-slate-800 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                            {row.productName || '—'}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums text-slate-700`}>
                            {formatCount(row.quantity)}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} text-right tabular-nums text-slate-700`}>
                            {formatCount(row.unitPrice)}
                          </td>
                          <td className={`${ERP_TABLE_TD_CLASS} text-right font-semibold tabular-nums text-slate-900`}>
                            {formatCount(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <EmptyListState message="기간 내 거래명세서 내역이 없습니다." />
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
        open={Boolean(editingRow)}
        row={editingRow}
        onClose={() => setEditingRow(null)}
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
