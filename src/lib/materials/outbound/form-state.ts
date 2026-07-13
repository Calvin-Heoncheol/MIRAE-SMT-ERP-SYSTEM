import type { MaterialOutboundListGroup, MaterialOutboundType } from './types'

export type OutboundLineForm = {
  materialId: string
  materialName: string
  specification: string
  mpn: string
  quantity: string
}

export type MaterialOutboundFormState = {
  outboundDate: string
  outboundType: MaterialOutboundType | ''
  orderId: string
  note: string
}

export function defaultOutboundLineForm(): OutboundLineForm {
  return {
    materialId: '',
    materialName: '',
    specification: '',
    mpn: '',
    quantity: '0',
  }
}

export function defaultMaterialOutboundFormState(outboundDate: string): MaterialOutboundFormState {
  return {
    outboundDate,
    outboundType: 'production',
    orderId: '',
    note: '',
  }
}

export function materialOutboundFormStateFromDetail(outbound: {
  outboundDate: string
  outboundType: MaterialOutboundType
  orderId: string | null
  note: string
}): MaterialOutboundFormState {
  return {
    outboundDate: outbound.outboundDate,
    outboundType: outbound.outboundType,
    orderId: outbound.orderId || '',
    note: outbound.note || '',
  }
}

export function outboundLinesFromDetail(
  items: MaterialOutboundListGroup['items'],
): OutboundLineForm[] {
  if (!items.length) return [defaultOutboundLineForm()]
  return items.map((item) => ({
    materialId: item.materialId,
    materialName: item.materialName,
    specification: item.specification,
    mpn: item.mpn,
    quantity: String(item.quantity),
  }))
}

export function outboundLinesFromNeedRows(
  rows: { materialId: string; materialName: string; remainingQuantity: number }[],
): OutboundLineForm[] {
  if (!rows.length) return [defaultOutboundLineForm()]
  return rows.map((row) => ({
    materialId: row.materialId,
    materialName: row.materialName,
    specification: '',
    mpn: '',
    quantity: String(row.remainingQuantity),
  }))
}
