'use client'

import { useMemo, useState } from 'react'
import { DeliveryInputPanel } from '@/components/delivery/delivery-input-panel'
import { DeliveryOrderSidebar } from '@/components/delivery/delivery-order-sidebar'
import { ProductionFetchError } from '@/components/production-input/production-fetch-error'
import type { FetchDeliveryInputPageResult } from '@/lib/delivery/repository'
import { DELIVERY_INPUT_CONFIG } from '@/lib/delivery/config'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import { filterDeliveryOrders } from '@/lib/delivery/utils'

type DeliveryInputWorkspaceProps = {
  result: FetchDeliveryInputPageResult
}

export function DeliveryInputWorkspace({ result }: DeliveryInputWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedKey, setSelectedKey] = useState('')
  const [availabilityByGroupId, setAvailabilityByGroupId] = useState<Record<string, DeliveryAvailability>>(
    () => (result.ok ? result.data.availabilityByGroupId : {}),
  )

  const data = result.ok ? result.data : null
  const filtered = useMemo(
    () => filterDeliveryOrders(data?.orders ?? [], search),
    [data?.orders, search],
  )

  const selectedOrder = useMemo(
    () =>
      filtered.find((order) => order.uiKey === selectedKey) ??
      data?.orders.find((order) => order.uiKey === selectedKey) ??
      null,
    [data?.orders, filtered, selectedKey],
  )

  const selectedAvailability = selectedOrder
    ? availabilityByGroupId[selectedOrder.assemblyGroupId || selectedOrder.orderLineId] ?? null
    : null

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleShipped(assemblyGroupId: string, _cumulative: number, availability: DeliveryAvailability) {
    setAvailabilityByGroupId((current) => ({ ...current, [assemblyGroupId]: availability }))
  }

  if (!result.ok) {
    return <ProductionFetchError result={result} config={DELIVERY_INPUT_CONFIG} />
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md max-lg:flex-col lg:grid lg:grid-cols-[minmax(320px,480px)_minmax(0,1fr)] lg:min-h-[calc(100vh-200px)]">
      <DeliveryOrderSidebar
        orders={filtered}
        availabilityByGroupId={availabilityByGroupId}
        selectedKey={selectedKey}
        search={search}
        page={page}
        onSearchChange={handleSearchChange}
        onSelect={setSelectedKey}
        onPageChange={setPage}
      />
      <div className="min-h-[480px] min-w-0 lg:min-h-0">
        <DeliveryInputPanel
          order={selectedOrder}
          availability={selectedAvailability}
          onShipped={handleShipped}
        />
      </div>
    </div>
  )
}
