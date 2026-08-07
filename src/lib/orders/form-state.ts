export type OrderItemForm = {
  productId: string
  productCode: string
  productName: string
  quantity: string | number
  unitPrice: string | number
  /** 제품(라인)별 납기일 YYYY-MM-DD */
  deliveryDate: string
  /** 품목마스터에 없는 일회성 행 (주문에만 존재) */
  isAdhoc?: boolean
}

export type OrderFormState = {
  orderCode: string
  orderDate: string
  /** 공통 납기일 — 제품 행에 일괄 반영용 */
  deliveryDate: string
  customer: string
  category: '양산' | '샘플' | '자재'
  note: string
}

export function defaultOrderItemForm(deliveryDate = ''): OrderItemForm {
  return {
    productId: '',
    productCode: '',
    productName: '',
    quantity: '0',
    unitPrice: '0',
    deliveryDate,
    isAdhoc: false,
  }
}

export function defaultAdhocOrderItemForm(deliveryDate = ''): OrderItemForm {
  return {
    productId: '',
    productCode: '',
    productName: '',
    quantity: '1',
    unitPrice: '0',
    deliveryDate,
    isAdhoc: true,
  }
}

export function orderItemsFromDetail(
  items: {
    productId?: string | null
    productCode: string
    productName: string
    quantity: number
    unitPrice: number
    deliveryDate?: string
  }[],
  fallbackDeliveryDate = '',
) {
  if (!items.length) return [defaultOrderItemForm(fallbackDeliveryDate)]
  return items.map((item) => ({
    productId: item.productId || '',
    productCode: item.productCode || '',
    productName: item.productName || '',
    quantity: String(item.quantity || 0),
    unitPrice: String(item.unitPrice || 0),
    deliveryDate: String(item.deliveryDate || fallbackDeliveryDate || '').trim(),
    // product_id 없으면 마스터 미연결 일회성 행으로 간주
    isAdhoc: !String(item.productId || '').trim(),
  }))
}
