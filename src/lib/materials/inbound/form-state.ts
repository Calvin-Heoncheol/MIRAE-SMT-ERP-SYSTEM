import type { MaterialInboundType } from './types'

export type DirectInboundItemForm = {
  materialId: string
  cpn: string
  materialName: string
  specification: string
  mpn: string
  quantity: string
}

export type PurchaseInboundItemForm = {
  purchaseOrderLineId: string
  materialId: string
  cpn: string
  materialName: string
  specification: string
  mpn: string
  orderedQuantity: number
  receivedQuantity: number
  remainingQuantity: number
  quantity: string
}

export type MaterialInboundFormState = {
  inboundDate: string
  inboundType: MaterialInboundType
  purchaseOrderId: string
  note: string
}

export function defaultDirectInboundItemForm(): DirectInboundItemForm {
  return {
    materialId: '',
    cpn: '',
    materialName: '',
    specification: '',
    mpn: '',
    quantity: '0',
  }
}

export function defaultMaterialInboundFormState(inboundDate: string): MaterialInboundFormState {
  return {
    inboundDate,
    inboundType: 'opening',
    purchaseOrderId: '',
    note: '',
  }
}
