'use client'

import { useEffect, useMemo, useState } from 'react'
import { DeliveryInputShipPanel } from '@/components/delivery/delivery-input-ship-panel'
import { DeliveryOrderSidebar } from '@/components/delivery/delivery-order-sidebar'
import { ProductionFetchError } from '@/components/production-input/production-fetch-error'
import type { FetchDeliveryInputPageResult } from '@/lib/delivery/repository'
import { DELIVERY_INPUT_CONFIG } from '@/lib/delivery/config'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import {
  filterDeliveryOrders,
  resolveDeliveryAvailabilityForOrder,
} from '@/lib/delivery/utils'

type DeliveryInputWorkspaceProps = {
  result: FetchDeliveryInputPageResult
  initialUiKey?: string
}

export function DeliveryInputWorkspace({
  result,
  initialUiKey = '',
}: DeliveryInputWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState(initialUiKey)
  const [availabilityByGroupId, setAvailabilityByGroupId] = useState<
    Record<string, DeliveryAvailability>
  >(() => (result.ok ? result.data.availabilityByGroupId : {}))

  useEffect(() => {
    setSelectedKey(initialUiKey)
  }, [initialUiKey])

  const orders = result.ok ? result.data.orders : []
  const filtered = useMemo(() => filterDeliveryOrders(orders, search), [orders, search])

  const selectedOrder = useMemo(() => {
    if (!selectedKey) return null
    return (
      filtered.find((order) => order.uiKey === selectedKey) ??
      orders.find((order) => order.uiKey === selectedKey) ??
      null
    )
  }, [filtered, orders, selectedKey])

  const selectedAvailability = selectedOrder
    ? resolveDeliveryAvailabilityForOrder(selectedOrder, availabilityByGroupId)
    : null

  function handleSearchChange(value: string) {
    setSearch(value)
  }

  function handleSelect(uiKey: string) {
    setSelectedKey(uiKey)
  }

  function handleShipped(
    assemblyGroupId: string,
    _cumulative: number,
    availability: DeliveryAvailability,
  ) {
    setAvailabilityByGroupId((current) => ({ ...current, [assemblyGroupId]: availability }))
  }

  if (!result.ok) {
    return <ProductionFetchError result={result} config={DELIVERY_INPUT_CONFIG} />
  }

  const flushShellClass =
    'flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:flex-row'

  return (
    <div className={flushShellClass}>
      <DeliveryOrderSidebar
        orders={filtered}
        availabilityByGroupId={availabilityByGroupId}
        selectedKey={selectedKey}
        search={search}
        onSearchChange={handleSearchChange}
        onSelect={handleSelect}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-slate-200 bg-slate-100 lg:border-t-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <DeliveryInputShipPanel
            order={selectedOrder}
            availability={selectedAvailability}
            onShipped={handleShipped}
          />
        </div>
      </div>
    </div>
  )
}
