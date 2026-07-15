'use client'

import { InboundForm } from '@/components/materials/inbound/inbound-form'
import { ErpModal } from '@/components/ui/erp-modal'
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
  if (!open) return null
  if (mode === 'edit' && !inbound) return null

  return (
    <ErpModal
      open
      size="lg"
      title={mode === 'edit' ? '입고 수정' : '입고 등록'}
      onClose={onClose}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
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
    </ErpModal>
  )
}
