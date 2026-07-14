'use client'

import { useEffect } from 'react'
import { DeliveryInputShipPanel } from '@/components/delivery/delivery-input-ship-panel'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import { formatProductionProductName } from '@/lib/production-input/utils'
import type { ProductionOrderLine } from '@/lib/production-input/types'

type DeliveryInputShipModalProps = {
  open: boolean
  order: ProductionOrderLine | null
  availability: DeliveryAvailability | null
  onClose: () => void
  onShipped: (assemblyGroupId: string, cumulative: number, availability: DeliveryAvailability) => void
}

export function DeliveryInputShipModal({
  open,
  order,
  availability,
  onClose,
  onShipped,
}: DeliveryInputShipModalProps) {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open || !order || !availability) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-ship-modal-title"
        className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="delivery-ship-modal-title" className="text-lg font-bold text-slate-900">
              출하 등록
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {order.customer} · {order.orderNumber}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
              {formatProductionProductName(order)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <DeliveryInputShipPanel
            embedded
            order={order}
            availability={availability}
            onShipped={onShipped}
          />
        </div>
      </div>
    </div>
  )
}
