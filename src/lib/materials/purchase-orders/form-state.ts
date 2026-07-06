export type MaterialPurchaseOrderItemForm = {
  materialId: string
  cpn: string
  materialName: string
  specification: string
  mpn: string
  quantity: string | number
  unitPrice: string | number
}

export type MaterialPurchaseOrderFormState = {
  orderDate: string
  deliveryDate: string
  supplier: string
}

export function defaultMaterialPurchaseOrderItemForm(): MaterialPurchaseOrderItemForm {
  return {
    materialId: '',
    cpn: '',
    materialName: '',
    specification: '',
    mpn: '',
    quantity: '0',
    unitPrice: '0',
  }
}

export function materialPurchaseOrderItemsFromDetail(
  items: {
    materialId?: string | null
    cpn: string
    materialName: string
    specification: string
    mpn: string
    quantity: number
    unitPrice: number
  }[],
) {
  if (!items.length) return [defaultMaterialPurchaseOrderItemForm()]
  return items.map((item) => ({
    materialId: item.materialId || '',
    cpn: item.cpn || '',
    materialName: item.materialName || '',
    specification: item.specification || '',
    mpn: item.mpn || '',
    quantity: String(item.quantity || 0),
    unitPrice: String(item.unitPrice || 0),
  }))
}
