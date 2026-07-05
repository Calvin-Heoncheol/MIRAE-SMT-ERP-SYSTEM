import type { OrderLineRecord } from '@/lib/orders/types'
import type { Product } from '@/lib/products/types'
import type {
  ComputedAssemblyGroup,
  FinishedProductBomRow,
  OrderAssemblyGroup,
  OrderAssemblyGroupRecord,
} from './types'

export function resolveLineProductId(line: Pick<OrderLineRecord, 'product_id' | 'product_code'>) {
  return (line.product_id || line.product_code || '').trim()
}

export function isUserOrderLine(line: Pick<OrderLineRecord, 'derived_from_line_id'>) {
  return !line.derived_from_line_id
}

export function groupFinishedProductBom(rows: FinishedProductBomRow[]) {
  const byParent = new Map<string, FinishedProductBomRow[]>()

  for (const row of rows) {
    const list = byParent.get(row.parentProductId) ?? []
    list.push(row)
    byParent.set(row.parentProductId, list)
  }

  return byParent
}

function findChildOrderLine(
  orderLines: OrderLineRecord[],
  childProductId: string,
  parentLineId?: string,
) {
  const explicit = orderLines.find(
    (line) => isUserOrderLine(line) && resolveLineProductId(line) === childProductId,
  )
  if (explicit) return explicit

  if (!parentLineId) return undefined

  return orderLines.find(
    (line) =>
      line.derived_from_line_id === parentLineId &&
      resolveLineProductId(line) === childProductId,
  )
}

function tryMatchChildrenOnlyGroup(
  parentProductId: string,
  children: FinishedProductBomRow[],
  orderLines: OrderLineRecord[],
): ComputedAssemblyGroup | null {
  const userLines = orderLines.filter(isUserOrderLine)
  const links: ComputedAssemblyGroup['lines'] = []
  let minSets = Number.POSITIVE_INFINITY

  for (const child of children) {
    const line = userLines.find((item) => resolveLineProductId(item) === child.childProductId)
    if (!line?.id) {
      return null
    }

    const quantityPer = Math.max(Number(child.quantityPer) || 1, 1)
    const sets = Math.floor(Math.max(0, Number(line.quantity) || 0) / quantityPer)
    if (sets <= 0) {
      return null
    }

    minSets = Math.min(minSets, sets)
    links.push({
      orderLineId: line.id,
      childProductId: child.childProductId,
      quantityPer,
    })
  }

  if (!Number.isFinite(minSets) || minSets <= 0 || links.length !== children.length) {
    return null
  }

  const parentOnOrder = userLines.some((line) => resolveLineProductId(line) === parentProductId)
  if (parentOnOrder) {
    return null
  }

  return {
    parentProductId,
    targetQuantity: minSets,
    lines: links,
  }
}

function tryMatchAssemblyParentGroup(
  parentProductId: string,
  children: FinishedProductBomRow[],
  orderLines: OrderLineRecord[],
): ComputedAssemblyGroup | null {
  const parentLine = orderLines.find(
    (line) => isUserOrderLine(line) && resolveLineProductId(line) === parentProductId,
  )
  if (!parentLine?.id) return null

  const targetQuantity = Math.max(0, Math.floor(Number(parentLine.quantity) || 0))
  if (targetQuantity <= 0) return null

  const links: ComputedAssemblyGroup['lines'] = []

  for (const child of children) {
    const line = findChildOrderLine(orderLines, child.childProductId, parentLine.id)
    if (!line?.id) return null

    links.push({
      orderLineId: line.id,
      childProductId: child.childProductId,
      quantityPer: Math.max(Number(child.quantityPer) || 1, 1),
    })
  }

  if (links.length !== children.length) return null

  return {
    parentProductId,
    targetQuantity,
    lines: links,
  }
}

export function computeAssemblyGroupsForOrder(
  orderLines: OrderLineRecord[],
  bomRows: FinishedProductBomRow[],
): ComputedAssemblyGroup[] {
  const groups: ComputedAssemblyGroup[] = []
  const byParent = groupFinishedProductBom(bomRows)

  for (const [parentProductId, children] of byParent) {
    const childOnlyGroup = tryMatchChildrenOnlyGroup(parentProductId, children, orderLines)
    if (childOnlyGroup) {
      groups.push(childOnlyGroup)
      continue
    }

    const parentGroup = tryMatchAssemblyParentGroup(parentProductId, children, orderLines)
    if (parentGroup) {
      groups.push(parentGroup)
    }
  }

  return groups.sort((a, b) => a.parentProductId.localeCompare(b.parentProductId))
}

export type DerivedOrderLineSpec = {
  parentLineId: string
  childProductId: string
  productName: string
  quantity: number
  quantityPer: number
  lineSeq: number
}

export function computeDerivedOrderLineSpecs(
  orderLines: OrderLineRecord[],
  bomRows: FinishedProductBomRow[],
  productById: Record<string, Product>,
): DerivedOrderLineSpec[] {
  const specs: DerivedOrderLineSpec[] = []
  const byParent = groupFinishedProductBom(bomRows)
  const userLines = orderLines.filter(isUserOrderLine)
  const explicitProductIds = new Set(
    userLines.map((line) => resolveLineProductId(line)).filter(Boolean),
  )

  for (const parentLine of userLines) {
    const parentProductId = resolveLineProductId(parentLine)
    const children = byParent.get(parentProductId)
    if (!children?.length || !parentLine.id) continue

    const allChildrenExplicit = children.every((child) =>
      explicitProductIds.has(child.childProductId),
    )
    if (allChildrenExplicit) continue

    const parentQty = Math.max(0, Math.floor(Number(parentLine.quantity) || 0))
    if (parentQty <= 0) continue

    children.forEach((child, index) => {
      const quantityPer = Math.max(Number(child.quantityPer) || 1, 1)
      const product = productById[child.childProductId]
      specs.push({
        parentLineId: parentLine.id,
        childProductId: child.childProductId,
        productName: product?.productName || child.childProductId,
        quantity: parentQty * quantityPer,
        quantityPer,
        lineSeq: 9000 + index,
      })
    })
  }

  return specs
}

export function mapAssemblyGroupRecord(
  record: OrderAssemblyGroupRecord,
  productById: Record<string, Product>,
): OrderAssemblyGroup {
  const parent = productById[record.parent_product_id]

  return {
    id: record.id,
    orderId: record.order_id,
    parentProductId: record.parent_product_id,
    parentProductName: parent?.productName || record.parent_product_id,
    parentProductCode: parent?.productCode || record.parent_product_id,
    targetQuantity: Math.max(0, Math.floor(Number(record.target_quantity) || 0)),
    groupSeq: record.group_seq,
    lines: [],
  }
}

export function isMissingAssemblyTable(detail: string) {
  return (
    detail.includes('order_assembly_groups') ||
    detail.includes('order_assembly_group_lines') ||
    detail.includes('finished_product_bom_items') ||
    detail.includes('schema cache')
  )
}
