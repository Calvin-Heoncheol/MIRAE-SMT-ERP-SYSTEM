export type OrderItemForm = {
  productId: string
  productCode: string
  productName: string
  quantity: string | number
  unitPrice: string | number
}

export type OrderFormState = {
  orderCode: string
  orderDate: string
  deliveryDate: string
  customer: string
  category: '양산' | '샘플' | '자재'
  note: string
}

export function defaultOrderItemForm(): OrderItemForm {
  return {
    productId: '',
    productCode: '',
    productName: '',
    quantity: '0',
    unitPrice: '0',
  }
}

export function orderItemsFromDetail(
  items: {
    productId?: string | null
    productCode: string
    productName: string
    quantity: number
    unitPrice: number
  }[],
) {
  if (!items.length) return [defaultOrderItemForm()]
  return items.map((item) => ({
    productId: item.productId || '',
    productCode: item.productCode || '',
    productName: item.productName || '',
    quantity: String(item.quantity || 0),
    unitPrice: String(item.unitPrice || 0),
  }))
}
