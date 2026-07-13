'use client'

import { useEffect } from 'react'
import { InboundForm } from '@/components/materials/inbound/inbound-form'
import type { MaterialInboundListGroup } from '@/lib/materials/inbound/types'
import type { Material } from '@/lib/materials/types'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'

type InboundModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  inbound?: MaterialInboundListGroup | null
  materials: Material[]
  purchaseOrders: MaterialPurchaseOrderListGroup[]
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
  onMaterialsChanged?: () => void
}

export function InboundModal({
  open,
  mode,
  inbound,
  materials,
  purchaseOrders,
  onClose,
  onSaved,
  onDeleted,
  onMaterialsChanged,
}: InboundModalProps) {
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

  if (!open) return null
  if (mode === 'edit' && !inbound) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbound-modal-title"
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 id="inbound-modal-title" className="text-lg font-bold text-slate-900">
            {mode === 'edit' ? '입고 수정' : '입고 등록'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <InboundForm
          mode={mode}
          variant="modal"
          inbound={inbound}
          materials={materials}
          purchaseOrders={purchaseOrders}
          onCancel={onClose}
          onSaved={onSaved}
          onDeleted={onDeleted}
          onMaterialsChanged={onMaterialsChanged}
        />
      </div>
    </div>
  )
}
