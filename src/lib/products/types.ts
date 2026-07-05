export type ProductPcbSideMode = 'single' | 'dual'

export type ProductKind = 'pcb' | 'assembly'

export type Product = {
  id: string
  customer: string
  productCode: string
  productName: string
  defaultUnitPrice: number
  pcbSideMode: ProductPcbSideMode
  productKind: ProductKind
  isActive: boolean
}

export type ProductPayload = {
  customer: string
  productName: string
  defaultUnitPrice?: number
  pcbSideMode?: ProductPcbSideMode
  productKind?: 'pcb' | 'assembly'
  isActive?: boolean
}
