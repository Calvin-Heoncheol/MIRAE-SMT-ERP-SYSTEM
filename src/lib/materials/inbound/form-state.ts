import type { MaterialInboundType } from './types'

export type DirectInboundItemForm = {
  materialId: string
  materialName: string
  specification: string
  mpn: string
  quantityPerReel: string
  reelCount: string
  quantity: string
}

export type PurchaseInboundItemForm = {
  purchaseOrderLineId: string
  materialId: string
  materialCode: string
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
  inboundType: MaterialInboundType | ''
  purchaseOrderId: string
  note: string
}

export function defaultDirectInboundItemForm(): DirectInboundItemForm {
  return {
    materialId: '',
    materialName: '',
    specification: '',
    mpn: '',
    quantityPerReel: '0',
    reelCount: '0',
    quantity: '0',
  }
}

export function computeDirectInboundQuantity(quantityPerReel: string, reelCount: string) {
  const perReel = Math.max(0, Number(quantityPerReel) || 0)
  const reels = Math.max(0, Number(reelCount) || 0)
  return String(perReel * reels)
}

export function defaultMaterialInboundFormState(inboundDate: string): MaterialInboundFormState {
  return {
    inboundDate,
    inboundType: '',
    purchaseOrderId: '',
    note: '',
  }
}

export function materialInboundFormStateFromDetail(inbound: {
  inboundDate: string
  inboundType: MaterialInboundType
  purchaseOrderId: string | null
  note: string
}): MaterialInboundFormState {
  return {
    inboundDate: inbound.inboundDate,
    inboundType: inbound.inboundType,
    purchaseOrderId: inbound.purchaseOrderId || '',
    note: inbound.note || '',
  }
}

export function directInboundItemsFromDetail(
  items: {
    materialId: string
    materialName: string
    specification: string
    mpn: string
    quantity: number
  }[],
): DirectInboundItemForm[] {
  if (!items.length) return [defaultDirectInboundItemForm()]

  return items.map((item) => ({
    materialId: item.materialId,
    materialName: item.materialName,
    specification: item.specification,
    mpn: item.mpn,
    quantityPerReel: String(item.quantity),
    reelCount: '1',
    quantity: String(item.quantity),
  }))
}
