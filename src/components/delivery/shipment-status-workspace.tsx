'use client'

import { Fragment, useMemo, useState } from 'react'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpTableHead, ErpTableShell, ErpTableTd, ErpTableTh } from '@/components/ui/erp-table'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { KpiStatCard } from '@/components/ui/kpi-stat-card'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import {
  classifyShipmentStatusRow,
  filterShipmentStatusRowsByDate,
  matchesShipmentStatusFilter,
  matchesShipmentStatusSearch,
  type ShipmentStatusFilter,
  type ShipmentStatusRow,
} from '@/lib/delivery/shipment-status'
import type { FetchShipmentStatusResult } from '@/lib/delivery/shipment-status-repository'
import { DATE_RANGE_FILTER_LABEL, hasDateRangeFilter } from '@/lib/ui/date-range'
import { ERP_MODULE_ACCENT, ERP_TABLE_ROW_CLASS, formatEmptyListMessage } from '@/lib/ui/tokens'

type ShipmentStatusWorkspaceProps = {
  result: FetchShipmentStatusResult
}

const SEGMENT_SHADES = {
  done: ['bg-emerald-600', 'bg-emerald-400'],
  open: ['bg-sky-600', 'bg-sky-400'],
} as const

type BarSegment = { key: string; width: number; className: string; title: string }

function buildBarSegments(row: ShipmentStatusRow, done: boolean): BarSegment[] {
  const total = row.orderQuantity > 0 ? row.orderQuantity : Math.max(1, row.shippedQuantity)
  const shades = done ? SEGMENT_SHADES.done : SEGMENT_SHADES.open
  const segments: BarSegment[] = []
  let used = 0

  row.shipments.forEach((shipment, index) => {
    const width = Math.min(100 - used, (shipment.quantity / total) * 100)
    if (width <= 0) return
    used += width
    segments.push({
      key: shipment.id,
      width,
      className: shades[index % shades.length]!,
      title: `${shipment.round}차 · ${shipment.recordDate} · ${shipment.quantity.toLocaleString('ko-KR')}개`,
    })
  })

  // 출하 기록과 누적 합계가 어긋나는 예전 데이터 — 남는 양은 한 칸으로
  const recordedQty = row.shipments.reduce((sum, shipment) => sum + shipment.quantity, 0)
  const missingQty = row.shippedQuantity - recordedQty
  if (missingQty > 0 && used < 100) {
    segments.push({
      key: 'unrecorded',
      width: Math.min(100 - used, (missingQty / total) * 100),
      className: 'bg-slate-400',
      title: `차수 미확인 · ${missingQty.toLocaleString('ko-KR')}개`,
    })
  }

  return segments
}

function ShipmentProgressBar({
  row,
  expanded,
  onToggle,
}: {
  row: ShipmentStatusRow
  expanded: boolean
  onToggle: () => void
}) {
  const done = classifyShipmentStatusRow(row) === 'done'
  const percent =
    row.orderQuantity > 0 ? Math.min(100, Math.round((row.shippedQuantity / row.orderQuantity) * 100)) : 0
  const segments = buildBarSegments(row, done)
  const roundCount = row.shipments.length

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={roundCount === 0}
      aria-expanded={expanded}
      className="w-full min-w-[220px] rounded-lg px-1 py-0.5 text-left transition enabled:hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-default"
    >
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs tabular-nums">
        <span className="font-semibold text-slate-800">
          {row.shippedQuantity.toLocaleString('ko-KR')}
          <span className="font-medium text-slate-400"> / {row.orderQuantity.toLocaleString('ko-KR')}</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          {roundCount > 0 ? (
            <span className="text-[11px] font-medium text-slate-500">
              {roundCount}차 {expanded ? '▲' : '▼'}
            </span>
          ) : null}
          <span className={done ? 'font-semibold text-emerald-700' : 'text-slate-500'}>{percent}%</span>
        </span>
      </div>
      <div className="flex h-2.5 gap-px overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => (
          <div
            key={segment.key}
            title={segment.title}
            className={`h-full shrink-0 ${segment.className}`}
            style={{ width: `${segment.width}%` }}
          />
        ))}
      </div>
    </button>
  )
}

function ShipmentRoundsDetail({ row }: { row: ShipmentStatusRow }) {
  const cumulativeByRound = row.shipments.reduce<number[]>(
    (acc, shipment) => [...acc, (acc.at(-1) ?? 0) + shipment.quantity],
    [],
  )
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <table className="w-full max-w-xl text-xs tabular-nums">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1 pr-4 font-medium">차수</th>
            <th className="py-1 pr-4 font-medium">출하일</th>
            <th className="py-1 pr-4 text-right font-medium">수량</th>
            <th className="py-1 pr-4 text-right font-medium">누적</th>
            <th className="py-1 font-medium">출하번호</th>
          </tr>
        </thead>
        <tbody>
          {row.shipments.map((shipment, index) => (
            <tr key={shipment.id} className="border-t border-slate-100 text-slate-700">
              <td className="py-1 pr-4 font-semibold">{shipment.round}차</td>
              <td className="py-1 pr-4">{shipment.recordDate}</td>
              <td className="py-1 pr-4 text-right font-semibold">
                {shipment.quantity.toLocaleString('ko-KR')}
              </td>
              <td className="py-1 pr-4 text-right text-slate-500">
                {(cumulativeByRound[index] ?? 0).toLocaleString('ko-KR')} /{' '}
                {row.orderQuantity.toLocaleString('ko-KR')}
              </td>
              <td className="py-1 text-slate-500">{shipment.shipmentId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ShipmentStatusWorkspace({ result }: ShipmentStatusWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ShipmentStatusFilter>('open')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set())

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const rows = useMemo(() => (result.ok ? result.rows : []), [result])
  const query = search.trim()
  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate])

  const searchedRows = useMemo(
    () =>
      filterShipmentStatusRowsByDate(rows, dateRange).filter((row) =>
        matchesShipmentStatusSearch(row, query),
      ),
    [rows, dateRange, query],
  )

  const filteredRows = useMemo(
    () => searchedRows.filter((row) => matchesShipmentStatusFilter(row, statusFilter)),
    [searchedRows, statusFilter],
  )

  const counts = useMemo(() => {
    const result = { pending: 0, partial: 0, done: 0, orderQty: 0, shippedQty: 0 }
    for (const row of searchedRows) {
      result[classifyShipmentStatusRow(row)] += 1
      result.orderQty += row.orderQuantity
      result.shippedQty += Math.min(row.shippedQuantity, row.orderQuantity || row.shippedQuantity)
    }
    return result
  }, [searchedRows])

  if (!result.ok) {
    return (
      <FetchErrorBanner reason={result.reason} title="출하현황을 불러오지 못했습니다" detail={result.detail} />
    )
  }

  const statusChips = [
    {
      value: 'open' as const,
      label: '출하 진행중',
      count: counts.pending + counts.partial,
      tone: STATUS_FILTER_TONES.progress,
    },
    { value: 'pending' as const, label: '미출하', count: counts.pending, tone: STATUS_FILTER_TONES.waiting },
    { value: 'partial' as const, label: '부분출하', count: counts.partial, tone: STATUS_FILTER_TONES.info },
    { value: 'done' as const, label: '출하완료', count: counts.done, tone: STATUS_FILTER_TONES.done },
    { value: 'all' as const, label: '전체', count: searchedRows.length },
  ]

  const overallPercent =
    counts.orderQty > 0 ? Math.round((counts.shippedQty / counts.orderQty) * 100) : 0
  const hasActiveFilter = Boolean(query) || hasDateRangeFilter(dateRange)

  return (
    <PageShell className="gap-4">
      <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiStatCard label="미출하" value={counts.pending} unit="건" tone="slate" />
        <KpiStatCard label="부분출하" value={counts.partial} unit="건" tone="sky" />
        <KpiStatCard label="출하완료" value={counts.done} unit="건" tone="emerald" />
        <KpiStatCard
          label="출하율 (수량)"
          value={`${overallPercent}%`}
          hint={`${counts.shippedQty.toLocaleString('ko-KR')} / ${counts.orderQty.toLocaleString('ko-KR')} EA`}
          tone="amber"
        />
      </div>

      <WorkspaceHeader
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="발주번호, 고객사, 제품명 검색…"
        accent={ERP_MODULE_ACCENT.delivery}
        inlineFilters={
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            label={DATE_RANGE_FILTER_LABEL.due}
          />
        }
        filters={<FilterChipBar options={statusChips} value={statusFilter} onChange={setStatusFilter} />}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {filteredRows.length === 0 ? (
          <EmptyListState
            message={formatEmptyListMessage({
              hasQuery: hasActiveFilter,
              emptyLabel: '표시할 출하 내역이 없습니다',
              actionHint: '발주서를 등록하면 출하현황이 여기에 표시됩니다',
            })}
          />
        ) : (
          <ErpTableShell tableClassName="min-w-[900px]">
            <ErpTableHead>
              <tr>
                <ErpTableTh>발주일</ErpTableTh>
                <ErpTableTh>납기일</ErpTableTh>
                <ErpTableTh>발주번호</ErpTableTh>
                <ErpTableTh>고객사</ErpTableTh>
                <ErpTableTh>제품</ErpTableTh>
                <ErpTableTh>출하수량 (출하 / 발주)</ErpTableTh>
              </tr>
            </ErpTableHead>
            <tbody>
              {filteredRows.map((row) => {
                const expanded = expandedKeys.has(row.key) && row.shipments.length > 0
                return (
                  <Fragment key={row.key}>
                    <tr className={ERP_TABLE_ROW_CLASS}>
                      <ErpTableTd className="tabular-nums">{row.orderDate || '—'}</ErpTableTd>
                      <ErpTableTd>
                        <DeliveryDueBadge
                          deliveryDate={row.deliveryDate}
                          done={classifyShipmentStatusRow(row) === 'done'}
                        />
                      </ErpTableTd>
                      <ErpTableTd title={row.orderId}>{row.poNumber}</ErpTableTd>
                      <ErpTableTd text="wrap">{row.customer || '—'}</ErpTableTd>
                      <ErpTableTd text="wrap">
                        <p className="font-medium text-slate-900">{row.productName || '—'}</p>
                        {row.productCode ? <p className="text-xs text-slate-500">{row.productCode}</p> : null}
                      </ErpTableTd>
                      <ErpTableTd>
                        <ShipmentProgressBar
                          row={row}
                          expanded={expanded}
                          onToggle={() => toggleExpanded(row.key)}
                        />
                      </ErpTableTd>
                    </tr>
                    {expanded ? (
                      <tr className="bg-slate-50/70">
                        <td colSpan={6} className="px-4 py-2">
                          <ShipmentRoundsDetail row={row} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </ErpTableShell>
        )}
      </div>
    </PageShell>
  )
}
