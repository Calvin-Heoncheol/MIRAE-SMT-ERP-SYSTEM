'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { InboundFetchError } from '@/components/materials/inbound/inbound-fetch-error'
import { InboundListTable } from '@/components/materials/inbound/inbound-list-table'
import { InboundModal } from '@/components/materials/inbound/inbound-modal'
import { MaterialPurchaseOrderFetchError } from '@/components/materials/purchase-orders/material-purchase-order-fetch-error'
import { MaterialPurchaseOrderListTable } from '@/components/materials/purchase-orders/material-purchase-order-list-table'
import { MaterialPurchaseOrderModal } from '@/components/materials/purchase-orders/material-purchase-order-modal'
import { OutboundFetchError } from '@/components/materials/outbound/outbound-fetch-error'
import { OutboundListTable } from '@/components/materials/outbound/outbound-list-table'
import { OutboundModal } from '@/components/materials/outbound/outbound-modal'
import { FilterChipBar } from '@/components/ui/filter-chip'
import { DateRangeFilter } from '@/components/ui/date-range-filter'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { type MaterialHistoryCategory } from '@/lib/materials/history/category'
import { getInboundTypeLabel } from '@/lib/materials/inbound/utils'
import type { FetchMaterialInboundPageResult } from '@/lib/materials/inbound/repository'
import type { MaterialInboundListGroup } from '@/lib/materials/inbound/types'
import { getOutboundTypeLabel } from '@/lib/materials/outbound/utils'
import type { FetchMaterialOutboundPageResult } from '@/lib/materials/outbound/repository'
import type { MaterialOutboundListGroup } from '@/lib/materials/outbound/types'
import type { FetchMaterialPurchaseHistoryResult } from '@/lib/materials/purchase-orders/repository'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import { hasDateRangeFilter, matchesDateRange } from '@/lib/ui/date-range'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type MaterialHistoryWorkspaceProps = {
  purchaseResult: FetchMaterialPurchaseHistoryResult
  inboundResult: FetchMaterialInboundPageResult
  outboundResult: FetchMaterialOutboundPageResult
  initialCategory: MaterialHistoryCategory
}

type PurchaseModalState =
  | { open: false }
  | { open: true; order: MaterialPurchaseOrderListGroup }

type InboundModalState =
  | { open: false }
  | { open: true; inbound: MaterialInboundListGroup }

type OutboundModalState =
  | { open: false }
  | { open: true; outbound: MaterialOutboundListGroup }

function matchesPurchaseOrder(order: MaterialPurchaseOrderListGroup, query: string) {
  if (!query) return true
  const haystack = [
    order.orderNumber,
    order.supplier,
    order.sourceOrderId || '',
    ...order.items.flatMap((item) => [item.materialName, item.materialCode, item.mpn, item.specification]),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function matchesInbound(inbound: MaterialInboundListGroup, query: string) {
  if (!query) return true
  const haystack = [
    inbound.inboundNumber,
    inbound.purchaseOrderNumber || '',
    inbound.note,
    getInboundTypeLabel(inbound.inboundType),
    ...inbound.items.flatMap((item) => [item.materialCode, item.materialName, item.mpn]),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function matchesOutbound(outbound: MaterialOutboundListGroup, query: string) {
  if (!query) return true
  const haystack = [
    outbound.outboundNumber,
    outbound.orderNumber || '',
    outbound.customer,
    outbound.note,
    getOutboundTypeLabel(outbound.outboundType),
    ...outbound.items.flatMap((item) => [item.materialCode, item.materialName, item.mpn]),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

function searchPlaceholderFor(category: MaterialHistoryCategory) {
  if (category === 'purchase') return '발주번호, 주문서, 공급사, 자재명, MPN 검색…'
  if (category === 'inbound') return '입고번호, 발주번호, 자재명, 자재코드 검색…'
  if (category === 'outbound') return '불출번호, 주문번호, 자재명, 자재코드 검색…'
  return '발주·입고·불출 번호, 자재명, 공급사, 고객사 검색…'
}

export function MaterialHistoryWorkspace({
  purchaseResult,
  inboundResult,
  outboundResult,
  initialCategory,
}: MaterialHistoryWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [category, setCategory] = useState<MaterialHistoryCategory>(initialCategory)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [purchaseModal, setPurchaseModal] = useState<PurchaseModalState>({ open: false })
  const [inboundModal, setInboundModal] = useState<InboundModalState>({ open: false })
  const [outboundModal, setOutboundModal] = useState<OutboundModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  useEffect(() => {
    setCategory(initialCategory)
  }, [initialCategory])

  const purchaseOrders = purchaseResult.ok ? purchaseResult.orders : []
  const inbounds = inboundResult.ok ? inboundResult.inbounds : []
  const outbounds = outboundResult.ok ? outboundResult.outbounds : []
  const query = search.trim().toLowerCase()
  const dateRange = useMemo(() => ({ startDate, endDate }), [startDate, endDate])

  const filteredPurchaseOrders = useMemo(
    () =>
      purchaseOrders.filter(
        (order) =>
          matchesDateRange(order.orderDate, dateRange) && matchesPurchaseOrder(order, query),
      ),
    [purchaseOrders, query, dateRange],
  )
  const filteredInbounds = useMemo(
    () =>
      inbounds.filter(
        (inbound) =>
          matchesDateRange(inbound.inboundDate, dateRange) && matchesInbound(inbound, query),
      ),
    [inbounds, query, dateRange],
  )
  const filteredOutbounds = useMemo(
    () =>
      outbounds.filter(
        (outbound) =>
          matchesDateRange(outbound.outboundDate, dateRange) && matchesOutbound(outbound, query),
      ),
    [outbounds, query, dateRange],
  )

  const stacked = category === 'all'

  const categoryChips = useMemo(
    () => [
      {
        value: 'all' as const,
        label: '전체',
        count:
          filteredPurchaseOrders.length + filteredInbounds.length + filteredOutbounds.length,
      },
      { value: 'purchase' as const, label: '발주', count: filteredPurchaseOrders.length },
      { value: 'inbound' as const, label: '입고', count: filteredInbounds.length },
      { value: 'outbound' as const, label: '불출', count: filteredOutbounds.length },
    ],
    [filteredPurchaseOrders.length, filteredInbounds.length, filteredOutbounds.length],
  )

  function changeCategory(next: MaterialHistoryCategory) {
    setCategory(next)
    const params = new URLSearchParams()
    if (next !== 'all') params.set('category', next)
    const queryString = params.toString()
    window.history.replaceState(
      window.history.state,
      '',
      queryString ? `${pathname}?${queryString}` : pathname,
    )
  }

  const hasActiveFilter = Boolean(query) || hasDateRangeFilter(dateRange)

  function refresh() {
    router.refresh()
  }

  function openPurchase(order: MaterialPurchaseOrderListGroup) {
    setModalSession((value) => value + 1)
    setPurchaseModal({ open: true, order })
  }

  function openInbound(inbound: MaterialInboundListGroup) {
    setModalSession((value) => value + 1)
    setInboundModal({ open: true, inbound })
  }

  function openOutbound(outbound: MaterialOutboundListGroup) {
    setModalSession((value) => value + 1)
    setOutboundModal({ open: true, outbound })
  }

  const showPurchase = category === 'all' || category === 'purchase'
  const showInbound = category === 'all' || category === 'inbound'
  const showOutbound = category === 'all' || category === 'outbound'

  const purchaseSection = showPurchase ? (
    <section
      className={
        stacked
          ? 'space-y-3'
          : 'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden'
      }
    >
      {stacked ? (
        <h3 className="text-sm font-bold text-slate-900">
          발주이력{' '}
          <span className="tabular-nums font-semibold text-slate-600">
            {filteredPurchaseOrders.length.toLocaleString('ko-KR')}
          </span>
        </h3>
      ) : null}

      {!purchaseResult.ok ? (
        <MaterialPurchaseOrderFetchError result={purchaseResult} />
      ) : (
        <>
          <MaterialPurchaseOrderListTable
            orders={filteredPurchaseOrders}
            emptyMessage={formatEmptyListMessage({
              hasQuery: hasActiveFilter,
              emptyLabel: '등록된 자재 발주가 없습니다',
              actionHint: '발주 메뉴의 「새 자재 발주」에서 등록하세요',
            })}
            onSelectOrder={openPurchase}
          />
        </>
      )}
    </section>
  ) : null

  const inboundSection = showInbound ? (
    <section
      className={
        stacked
          ? 'space-y-3'
          : 'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden'
      }
    >
      {stacked ? (
        <h3 className="text-sm font-bold text-slate-900">
          입고이력{' '}
          <span className="tabular-nums font-semibold text-slate-600">
            {filteredInbounds.length.toLocaleString('ko-KR')}
          </span>
        </h3>
      ) : null}

      {!inboundResult.ok ? (
        <InboundFetchError result={inboundResult} />
      ) : (
        <>
          <InboundListTable
            inbounds={filteredInbounds}
            emptyMessage={formatEmptyListMessage({
              hasQuery: hasActiveFilter,
              emptyLabel: '등록된 입고 내역이 없습니다',
              actionHint: '입고 메뉴에서 등록하세요',
            })}
            onSelectInbound={openInbound}
          />
        </>
      )}
    </section>
  ) : null

  const outboundSection = showOutbound ? (
    <section
      className={
        stacked
          ? 'space-y-3'
          : 'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden'
      }
    >
      {stacked ? (
        <h3 className="text-sm font-bold text-slate-900">
          불출이력{' '}
          <span className="tabular-nums font-semibold text-slate-600">
            {filteredOutbounds.length.toLocaleString('ko-KR')}
          </span>
        </h3>
      ) : null}

      {!outboundResult.ok ? (
        <OutboundFetchError result={outboundResult} />
      ) : (
        <>
          <OutboundListTable
            outbounds={filteredOutbounds}
            emptyMessage={formatEmptyListMessage({
              hasQuery: hasActiveFilter,
              emptyLabel: '등록된 불출 내역이 없습니다',
              actionHint: '불출 메뉴에서 등록하세요',
            })}
            onSelectOutbound={openOutbound}
          />
        </>
      )}
    </section>
  ) : null

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={searchPlaceholderFor(category)}
          accent="slate"
          inlineFilters={
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              label="기준일"
            />
          }
          filters={
            <FilterChipBar options={categoryChips} value={category} onChange={changeCategory} />
          }
        />

        <div
          className={
            stacked
              ? 'min-h-0 flex-1 space-y-8 overflow-y-auto pr-1'
              : 'flex min-h-0 flex-1 flex-col gap-4 overflow-hidden'
          }
        >
          {purchaseSection}
          {inboundSection}
          {outboundSection}
        </div>
      </PageShell>

      {purchaseModal.open ? (
        <MaterialPurchaseOrderModal
          key={`purchase-${purchaseModal.order.orderNumber}-${modalSession}`}
          open
          mode="edit"
          order={purchaseModal.order}
          onClose={() => setPurchaseModal({ open: false })}
          onSaved={() => {
            setPurchaseModal({ open: false })
            refresh()
          }}
          onDeleted={() => {
            setPurchaseModal({ open: false })
            refresh()
          }}
        />
      ) : null}

      {inboundModal.open && inboundResult.ok ? (
        <InboundModal
          key={`inbound-${inboundModal.inbound.inboundId}-${modalSession}`}
          open
          mode="edit"
          inbound={inboundModal.inbound}
          materials={inboundResult.materials}
          purchaseOrders={inboundResult.purchaseOrders}
          onClose={() => setInboundModal({ open: false })}
          onSaved={() => {
            setInboundModal({ open: false })
            refresh()
          }}
          onDeleted={() => {
            setInboundModal({ open: false })
            refresh()
          }}
          onMaterialsChanged={refresh}
        />
      ) : null}

      {outboundModal.open && outboundResult.ok ? (
        <OutboundModal
          key={`outbound-${outboundModal.outbound.outboundId}-${modalSession}`}
          open
          mode="edit"
          outbound={outboundModal.outbound}
          materials={outboundResult.materials}
          orders={outboundResult.orders}
          onClose={() => setOutboundModal({ open: false })}
          onSaved={() => {
            setOutboundModal({ open: false })
            refresh()
          }}
          onDeleted={() => {
            setOutboundModal({ open: false })
            refresh()
          }}
        />
      ) : null}
    </>
  )
}
