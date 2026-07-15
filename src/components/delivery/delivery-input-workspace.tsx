'use client'

import { useMemo, useState } from 'react'
import { DeliveryInputShipModal } from '@/components/delivery/delivery-input-ship-modal'
import { DeliveryInputTable } from '@/components/delivery/delivery-input-table'
import { ProductionFetchError } from '@/components/production-input/production-fetch-error'
import type { FetchDeliveryInputPageResult } from '@/lib/delivery/repository'
import { DELIVERY_INPUT_CONFIG } from '@/lib/delivery/config'
import type { DeliveryAvailability, DeliveryInputFilter } from '@/lib/delivery/utils'
import { filterDeliveryOrders, filterDeliveryOrdersByStatus } from '@/lib/delivery/utils'

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
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="주문번호, 고객사, 완제품명 검색…"
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-slate-100 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2"
        />
        <div className="ml-auto flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => {
            const active = filter === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-sm font-medium text-slate-600">
        {filtered.length.toLocaleString('ko-KR')}건
        {query || filter !== 'all' ? (
          <span className="text-slate-400"> / {orders.length.toLocaleString('ko-KR')}건</span>
        ) : null}
        <span className="ml-2 text-xs font-normal text-slate-400">행을 클릭하면 출하 등록 창이 열립니다</span>
      </p>

      <DeliveryInputTable
        orders={filtered}
        availabilityByGroupId={availabilityByGroupId}
        selectedKey={modalOrderKey}
        emptyMessage={query || filter !== 'all' ? '검색·필터 결과가 없습니다' : '출하 대상 주문이 없습니다'}
        onSelect={handleOpenModal}
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
