'use client'

import { InboundScanPanel } from '@/components/materials/inbound/inbound-scan-panel'
import { ErpModal } from '@/components/ui/erp-modal'
import type { MaterialPurchaseOrderListGroup } from '@/lib/materials/purchase-orders/types'
import type { Material } from '@/lib/materials/types'

type InboundRegisterModalProps = {
  open: boolean
  materials: Material[]
  purchaseOrders: MaterialPurchaseOrderListGroup[]
  onClose: () => void
  onSaved: () => void
  onMaterialsChanged: () => void
}

export function InboundRegisterModal({
  open,
  materials,
  purchaseOrders,
  onClose,
  onSaved,
  onMaterialsChanged,
}: InboundRegisterModalProps) {
  if (!open) return null

  return (
    <ErpModal
      open
      title="입고 등록"
      description="바코드를 스캔하고 수량을 입력한 뒤 입고 처리하세요."
      size="wide"
      onClose={onClose}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3 sm:px-4"
    >
      <div className="flex h-[min(80dvh,900px)] min-h-0 flex-1 flex-col overflow-hidden">
        <InboundScanPanel
          embedded
          materials={materials}
          purchaseOrders={purchaseOrders}
          onSaved={onSaved}
          onMaterialsChanged={onMaterialsChanged}
        />
      </div>
    </ErpModal>
  )
}
