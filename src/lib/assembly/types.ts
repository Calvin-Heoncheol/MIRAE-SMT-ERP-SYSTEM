export type FinishedProductBomRow = {
  parentProductId: string
  childProductId: string
  quantityPer: number
}

export type AssemblyGroupLineRecord = {
  id: string
  assembly_group_id: string
  order_line_id: string
  child_product_id: string
  quantity_per: number
}

export type OrderAssemblyGroupRecord = {
  id: string
  order_id: string
  parent_product_id: string
  target_quantity: number
  group_seq: number
  note: string
  created_at: string
  updated_at: string
}

export type AssemblyGroupLine = {
  id: string
  orderLineId: string
  childProductId: string
  quantityPer: number
}

export type OrderAssemblyGroup = {
  id: string
  orderId: string
  parentProductId: string
  parentProductName: string
  parentProductCode: string
  targetQuantity: number
  groupSeq: number
  lines: AssemblyGroupLine[]
}

export type ComputedAssemblyGroup = {
  parentProductId: string
  targetQuantity: number
  lines: {
    orderLineId: string
    childProductId: string
    quantityPer: number
  }[]
}
