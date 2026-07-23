'use client'

import { useMemo, useState } from 'react'
import { DeliveryInputShipModal } from '@/components/delivery/delivery-input-ship-modal'
import { DeliveryInputTable } from '@/components/delivery/delivery-input-table'
import { ProductionFetchError } from '@/components/production-input/production-fetch-error'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchDeliveryInputPageResult } from '@/lib/delivery/repository'
import { DELIVERY_INPUT_CONFIG } from '@/lib/delivery/config'
import type { DeliveryAvailability, DeliveryInputFilter } from '@/lib/delivery/utils'
import { filterDeliveryOrders, filterDeliveryOrdersByStatus } from '@/lib/delivery/utils'
import { useClientPagination } from '@/lib/ui/use-client-pagination'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type DeliveryInputWorkspaceProps = {
  result: FetchDeliveryInputPageResult
}

const FILTER_OPTIONS: { value: DeliveryInputFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'shippable', label: '출하가능' },
  { value: 'partial', label: '부분출하' },
  { value: 'complete', label: '완료' },
  { value: 'blocked', label: '불가' },
]

const DELIVERY_FILTER_TONES: Partial<
  Record<DeliveryInputFilter, (typeof STATUS_FILTER_TONES)[keyof typeof STATUS_FILTER_TONES] | {
    idleClassName: string
    activeClassName: string
    activeCountClassName: string
  }>
> = {
  shippable: STATUS_FILTER_TONES.progress,
  partial: {
    idleClassName: 'border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100',
    activeClassName: 'bg-sky-600 text-white shadow-sm',
    activeCountClassName: 'text-sky-100',
  },
  complete: STATUS_FILTER_TONES.done,
  blocked: {
    idleClassName: 'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
    activeClassName: 'bg-rose-700 text-white shadow-sm',
    activeCountClassName: 'text-rose-100',
  },
}

export function DeliveryInputWorkspace({ result }: DeliveryInputWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<DeliveryInputFilter>('all')
  const [modalOrderKey, setModalOrderKey] = useState('')
  const [availabilityByGroupId, setAvailabilityByGroupId] = useState<Record<string, DeliveryAvailability>>(
    () => (result.ok ? result.data.availabilityByGroupId : {}),
  )

  const orders = result.ok ? result.data.orders : []
  const query = search.trim()

  const searched = useMemo(() => filterDeliveryOrders(orders, query), [orders, query])
  const filtered = useMemo(
    () => filterDeliveryOrdersByStatus(searched, availabilityByGroupId, filter),
    [searched, availabilityByGroupId, filter],
  )
  const pagination = useClientPagination(filtered)

  const filterOptions = useMemo(
    () =>
      FILTER_OPTIONS.map((option) => ({
        ...option,
        count: filterDeliveryOrdersByStatus(searched, availabilityByGroupId, option.value).length,
        tone: DELIVERY_FILTER_TONES[option.value],
      })),
    [searched, availabilityByGroupId],
  )

  const modalOrder = useMemo(
    () =>
      orders.find((order) => order.uiKey === modalOrderKey) ??
      filtered.find((order) => order.uiKey === modalOrderKey) ??
      null,
    [filtered, modalOrderKey, orders],
  )

  const modalAvailability = modalOrder
    ? availabilityByGroupId[modalOrder.assemblyGroupId || modalOrder.orderLineId] ?? null
    : null

  function handleOpenModal(uiKey: string) {
    setModalOrderKey(uiKey)
  }

  function handleCloseModal() {
    setModalOrderKey('')
  }

  function handleShipped(assemblyGroupId: string, _cumulative: number, availability: DeliveryAvailability) {
    setAvailabilityByGroupId((current) => ({ ...current, [assemblyGroupId]: availability }))
  }

  if (!result.ok) {
    return <ProductionFetchError result={result} config={DELIVERY_INPUT_CONFIG} />
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
      <WorkspaceHeader
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="주문번호, 고객사, 완제품명 검색…"
        accent="slate"
        filters={
          <FilterChipBar options={filterOptions} value={filter} onChange={setFilter} />
        }
      />

      <p className="shrink-0 text-sm font-medium text-slate-600">
        {filtered.length.toLocaleString('ko-KR')}건
        {query || filter !== 'all' ? (
          <span className="text-slate-400"> / {orders.length.toLocaleString('ko-KR')}건</span>
        ) : null}
        <span className="ml-2 text-xs font-normal text-slate-400">
          행을 클릭하면 출하 등록 창이 열립니다
        </span>
      </p>

      <div className="min-h-0 flex-1 overflow-hidden">
        <DeliveryInputTable
          orders={pagination.pageItems}
          availabilityByGroupId={availabilityByGroupId}
          selectedKey={modalOrderKey}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query) || filter !== 'all',
            emptyLabel: '출하 대상 주문이 없습니다',
          })}
          onSelect={handleOpenModal}
        />
      </div>

      <ListPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={pagination.setPage}
        rangeStart={pagination.rangeStart}
        rangeEnd={pagination.rangeEnd}
        totalCount={pagination.totalCount}
      />

      <DeliveryInputShipModal
        open={Boolean(modalOrderKey)}
        order={modalOrder}
        availability={modalAvailability}
        onClose={handleCloseModal}
        onShipped={handleShipped}
      />
    </div>
  )
}
