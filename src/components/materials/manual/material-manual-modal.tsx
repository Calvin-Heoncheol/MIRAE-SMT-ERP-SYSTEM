'use client'

import { useState } from 'react'
import { MaterialManualInputPanel } from '@/components/materials/manual/material-manual-input-panel'
import { MaterialManualOrderHistory } from '@/components/materials/manual/material-manual-order-history'
import { ErpModal } from '@/components/ui/erp-modal'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import type { MaterialManualOrderMetrics } from '@/lib/materials/manual/types'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductName } from '@/lib/production-input/utils'

type MaterialManualModalProps = {
  open: boolean
  order: ProductionOrderLine | null
  metrics: MaterialManualOrderMetrics
  refreshing?: boolean
  onClose: () => void
  onSave: (input: {
    recordDate: string
    inboundQty: number
    outboundQty: number
  }) => Promise<boolean>
}

export function MaterialManualModal({
  open,
  order,
  metrics,
  refreshing = false,
  onClose,
  onSave,
}: MaterialManualModalProps) {
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  const title = order ? formatProductionProductName(order) : '입고 및 불출'
  const description = order
    ? [
        order.customer || '—',
        displayOrderPoNumber(order.customerPoNumber, order.orderNumber) || '—',
        order.productCode || null,
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined

  async function handleSave(input: {
    recordDate: string
    inboundQty: number
    outboundQty: number
  }) {
    const ok = await onSave(input)
    if (ok) {
      setHistoryRefreshKey((current) => current + 1)
    }
    return ok
  }

  return (
    <ErpModal
      open={open}
      title={title}
      description={description}
      size="form"
      fitContent
      dialogClassName="!max-w-[min(920px,96vw)]"
      onClose={onClose}
      contentClassName="min-h-0 overflow-hidden p-0"
    >
      <div className="flex max-h-[calc(94dvh-5.5rem)] flex-col lg:flex-row lg:items-stretch">
        <div className="min-h-0 min-w-0 shrink-0 overflow-y-auto overscroll-contain lg:w-[min(480px,55%)]">
          <MaterialManualInputPanel
            order={order}
            metrics={metrics}
            refreshing={refreshing}
            embedded
            onSave={handleSave}
          />
        </div>

        <MaterialManualOrderHistory order={order} refreshKey={historyRefreshKey} />
      </div>
    </ErpModal>
  )
}
