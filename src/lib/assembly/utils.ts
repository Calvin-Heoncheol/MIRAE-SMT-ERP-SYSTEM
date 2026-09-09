import type { OrderLineRecord } from '@/lib/orders/types'
import { isBillingOnlyOrderLine } from '@/lib/orders/utils'
import type { Product } from '@/lib/products/types'
import type {
  ComputedAssemblyGroup,
  BomRow,
  OrderAssemblyGroup,
  OrderAssemblyGroupRecord,
} from './types'

export function resolveLineProductId(line: Pick<OrderLineRecord, 'product_id' | 'product_code'>) {
  // 금액 전용(추가작업)은 product_id 없음 → 조립·생산 키에서 제외
  if (isBillingOnlyOrderLine(line)) return ''
  return String(line.product_id || '').trim()
}

export function isUserOrderLine(line: Pick<OrderLineRecord, 'derived_from_line_id'>) {
  return !line.derived_from_line_id
}

export function groupBomByParent(rows: BomRow[]) {
  const byParent = new Map<string, BomRow[]>()

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

function tryMatchAssemblyParentGroup(
  parentProductId: string,
  children: BomRow[],
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
  bomRows: BomRow[],
): ComputedAssemblyGroup[] {
  const groups: ComputedAssemblyGroup[] = []
  const byParent = groupBomByParent(bomRows)

  for (const [parentProductId, children] of byParent) {
    // 주문에 반제품만 있을 때 BOM 조립제품으로 합치지 않음 — 라인(반제품) 단위 유지
    const parentGroup = tryMatchAssemblyParentGroup(parentProductId, children, orderLines)
    if (parentGroup) {
      groups.push(parentGroup)
    }
  }

  return groups.sort((a, b) => a.parentProductId.localeCompare(b.parentProductId))
}

export function computeStandaloneFinishedProductGroups(
  orderLines: OrderLineRecord[],
  existingGroups: ComputedAssemblyGroup[],
  productById: Record<string, Product>,
): ComputedAssemblyGroup[] {
  const coveredParents = new Set(existingGroups.map((group) => group.parentProductId))
  const extras: ComputedAssemblyGroup[] = []

  for (const line of orderLines.filter(isUserOrderLine)) {
    const productId = resolveLineProductId(line)
    if (!productId || coveredParents.has(productId)) continue

    const product = productById[productId]
    if (product?.productKind !== 'assembly') continue

    const targetQuantity = Math.max(0, Math.floor(Number(line.quantity) || 0))
    if (targetQuantity <= 0 || !line.id) continue

    coveredParents.add(productId)
    extras.push({
      parentProductId: productId,
      targetQuantity,
      lines: [],
    })
  }

  return extras
}

/**
 * 반제품 단독 출하·생산 그룹.
 * 이미 조립제품 BOM 그룹에 들어간 주문 라인은 제외한다
 * (order_line_id 는 조립 그룹 라인에 한 번만 들어갈 수 있음).
 */
export function computeStandaloneSemiProductGroups(
  orderLines: OrderLineRecord[],
  existingGroups: ComputedAssemblyGroup[],
  productById: Record<string, Product>,
): ComputedAssemblyGroup[] {
  const parentIdsInGroups = new Set(existingGroups.map((group) => group.parentProductId))
  const coveredLineIds = new Set(
    existingGroups.flatMap((group) => group.lines.map((line) => line.orderLineId)),
  )
  const extras: ComputedAssemblyGroup[] = []

  for (const line of orderLines) {
    const productId = resolveLineProductId(line)
    if (!productId || !line.id) continue
    if (parentIdsInGroups.has(productId)) continue
    if (coveredLineIds.has(line.id)) continue

    const product = productById[productId]
    if (product?.productKind !== 'pcb') continue

    const targetQuantity = Math.max(0, Math.floor(Number(line.quantity) || 0))
    if (targetQuantity <= 0) continue

    parentIdsInGroups.add(productId)
    coveredLineIds.add(line.id)
    extras.push({
      parentProductId: productId,
      targetQuantity,
      lines: [
        {
          orderLineId: line.id,
          childProductId: productId,
          quantityPer: 1,
        },
      ],
    })
  }

  return extras
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
  bomRows: BomRow[],
  productById: Record<string, Product>,
): DerivedOrderLineSpec[] {
  const specs: DerivedOrderLineSpec[] = []
  const byParent = groupBomByParent(bomRows)
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

const ASSEMBLY_RELATED_TABLES = [
  'order_assembly_groups',
  'order_assembly_group_lines',
  'bom_items',
  'bom_detail',
] as const

/** 테이블/뷰가 실제로 없을 때만 true (FK·컬럼·권한 오류는 오탐하지 않음) */
export function isMissingAssemblyTable(detail: string) {
  return ASSEMBLY_RELATED_TABLES.some((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return (
      new RegExp(`could not find the table[^\\n]*${escaped}`, 'i').test(detail) ||
      new RegExp(`relation ["'\`]?(?:public\\.)?${escaped}["'\`]? does not exist`, 'i').test(detail)
    )
  })
}

/**
 * 주문에 없는 조립제품을 BOM으로 추정해 반제품 라인을 합친 조립 그룹인지.
 * (반제품 A·B만 주문했는데 조립제품 C 그룹이 생긴 경우)
 */
export function isChildrenOnlyAssemblyGroup(
  group: Pick<OrderAssemblyGroup, 'parentProductId' | 'lines'>,
  orderProductIds: Set<string>,
) {
  if (!group.lines.length) return false
  return !orderProductIds.has(group.parentProductId)
}
