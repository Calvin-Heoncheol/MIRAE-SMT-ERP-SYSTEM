export type MaterialPurchaseOrderItemForm = {
  materialId: string
  materialCode: string
  materialName: string
  specification: string
  mpn: string
  quantity: string | number
  unitPrice: string | number
  /** YYYY-MM-DD — 자재별 납기 */
  deliveryDate: string
}

export type MaterialPurchaseOrderFormState = {
  orderDate: string
  /** 헤더 기본 납기 — 라인 납기 비어 있을 때 기본값 */
  deliveryDate: string
  supplier: string
}

export function defaultMaterialPurchaseOrderItemForm(
  deliveryDate = '',
): MaterialPurchaseOrderItemForm {
  return {
    materialId: '',
    materialCode: '',
    materialName: '',
    specification: '',
    mpn: '',
    quantity: '0',
    unitPrice: '0',
    deliveryDate,
  }
}

export function materialPurchaseOrderItemsFromDetail(
  items: {
    materialId?: string | null
    materialCode: string
    materialName: string
    specification: string
    mpn: string
    quantity: number
    unitPrice: number
    deliveryDate?: string
  }[],
) {
  if (!items.length) return [defaultMaterialPurchaseOrderItemForm()]
  return items.map((item) => ({
    materialId: item.materialId || '',
    materialCode: item.materialCode || '',
    materialName: item.materialName || '',
    specification: item.specification || '',
    mpn: item.mpn || '',
    quantity: String(item.quantity || 0),
    unitPrice: String(item.unitPrice || 0),
    deliveryDate: String(item.deliveryDate || '').slice(0, 10),
  }))
}
