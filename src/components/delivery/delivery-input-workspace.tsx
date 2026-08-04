'use client'

import { useEffect, useMemo, useState } from 'react'
import { DeliveryInputShipPanel } from '@/components/delivery/delivery-input-ship-panel'
import { DeliveryOrderSidebar } from '@/components/delivery/delivery-order-sidebar'
import { ProductionFetchError } from '@/components/production-input/production-fetch-error'
import { ErpModal } from '@/components/ui/erp-modal'
import type { FetchDeliveryInputPageResult } from '@/lib/delivery/repository'
import { DELIVERY_INPUT_CONFIG } from '@/lib/delivery/config'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import {
  filterDeliveryOrders,
  resolveDeliveryAvailabilityForOrder,
} from '@/lib/delivery/utils'
import { formatProductionProductDisplay } from '@/lib/production-input/utils'

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
  const [inputModalOpen, setInputModalOpen] = useState(Boolean(initialUiKey))
  const [availabilityByGroupId, setAvailabilityByGroupId] = useState<
    Record<string, DeliveryAvailability>
  >(() => (result.ok ? result.data.availabilityByGroupId : {}))

  useEffect(() => {
    setSelectedKey(initialUiKey)
    if (initialUiKey) setInputModalOpen(true)
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
    setInputModalOpen(true)
  }

  function closeInputModal() {
    setInputModalOpen(false)
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
    'flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white'

  const modalProduct = selectedOrder
    ? formatProductionProductDisplay(selectedOrder)
    : null
  const modalDescription = selectedOrder
    ? [
        selectedOrder.orderNumber,
        selectedOrder.customer,
        selectedOrder.productCode,
        modalProduct?.name,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined

  return (
    <>
      <div className={flushShellClass}>
        <DeliveryOrderSidebar
          variant="board"
          orders={filtered}
          availabilityByGroupId={availabilityByGroupId}
          selectedKey={selectedKey}
          search={search}
          onSearchChange={handleSearchChange}
          onSelect={handleSelect}
        />
      </div>

      <ErpModal
        open={inputModalOpen && Boolean(selectedOrder)}
        title="출하 등록"
        description={modalDescription}
        size="lg"
        onClose={closeInputModal}
        contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      >
        <div className="flex min-h-[min(70dvh,640px)] min-w-0 flex-1 flex-col overflow-hidden bg-slate-100">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <DeliveryInputShipPanel
              order={selectedOrder}
              availability={selectedAvailability}
              embedded
              onShipped={handleShipped}
            />
          </div>
        </div>
      </ErpModal>
    </>
  )
}
