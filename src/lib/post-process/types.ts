export type PostProcessOrderState = 'none' | 'progress' | 'full'

export type PostProcessProductKind = 'semi' | 'finished'

export type PostProcessOrderLine = {
  uiKey: string
  countKey: string
  orderNumber: string
  orderDate: string
  customer: string
  productCode: string
  productName: string
  productLabel: string
  quantity: number
  unitPrice: number
  lineSeq: number
  productKind: PostProcessProductKind
  productKindLabel: string
}

export type PostProcessCounts = Record<string, number>

export type PostProcessPageData = {
  orders: PostProcessOrderLine[]
  counts: PostProcessCounts
}
