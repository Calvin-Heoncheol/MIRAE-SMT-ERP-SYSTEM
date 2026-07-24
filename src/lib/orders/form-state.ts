export type OrderItemForm = {
  productId: string
  productCode: string
  productName: string
  quantity: string | number
  unitPrice: string | number
  /** 제품(라인)별 납기일 YYYY-MM-DD */
  deliveryDate: string
}

export type OrderFormState = {
  orderCode: string
  orderDate: string
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
  }))
}
