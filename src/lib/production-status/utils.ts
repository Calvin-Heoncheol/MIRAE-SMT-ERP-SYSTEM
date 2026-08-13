import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import { matchesDateRange, type DateRangeFilterValue } from '@/lib/ui/date-range'
import type { OrderListGroup } from '@/lib/orders/types'
import { formatProductSummary, isBillingOnlyOrderItem } from '@/lib/orders/utils'
import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'
import {
  assemblyGroupIncludesPostProcess,
  getProgressPercent,
  getStackedProgressWidths,
  resolveProductionCount,
  resolveProductionDefectCount,
} from '@/lib/production-input/utils'
import type { Product } from '@/lib/products/types'
import type { QuoteListItem } from '@/lib/quotes/types'
import type { ProductionStatusLine, ProductionStatusProductLine } from './types'

function groupSmtLinesByOrderNumber(smtLines: ProductionOrderLine[]) {
  const map = new Map<string, ProductionOrderLine[]>()

  for (const line of smtLines) {
    const existing = map.get(line.orderNumber) ?? []
    existing.push(line)
    map.set(line.orderNumber, existing)
  }

  return map
}

function groupAssemblyGroupsByOrderId(assemblyGroups: OrderAssemblyGroup[]) {
  const map = new Map<string, OrderAssemblyGroup[]>()

  for (const group of assemblyGroups) {
    const existing = map.get(group.orderId) ?? []
    existing.push(group)
    map.set(group.orderId, existing)
  }

  return map
}

function resolveItemProductId(item: OrderListGroup['items'][number]) {
  return String(item.productId || '').trim()
}

/**
 * 주문 라인(실제 제품) 단위로 펼침 행을 만든다.
 * 조립제품 조립 그룹 부모명으로 반제품 A·B를 합치지 않는다.
 */
function buildProductLinesForOrder(
  order: OrderListGroup,
  orderSmtLines: ProductionOrderLine[],
  orderAssemblies: OrderAssemblyGroup[],
  smtCounts: ProductionCounts,
  smtDefectCounts: ProductionCounts,
  postCounts: ProductionCounts,
  postDefectCounts: ProductionCounts,
  deliveryCounts: ProductionCounts,
  productById: Record<string, Product> = {},
  quotes: QuoteListItem[] = [],
): ProductionStatusProductLine[] {
  const smtByLineId = new Map(orderSmtLines.map((line) => [line.orderLineId, line]))
  const assemblyByChildLineId = new Map<string, OrderAssemblyGroup>()
  const assemblyByParentProductId = new Map<string, OrderAssemblyGroup>()

  for (const assembly of orderAssemblies) {
    assemblyByParentProductId.set(assembly.parentProductId, assembly)
    for (const line of assembly.lines) {
      assemblyByChildLineId.set(line.orderLineId, assembly)
    }
  }

  const products: ProductionStatusProductLine[] = []
  const coveredSmtLineIds = new Set<string>()

  for (const item of order.items) {
    // 임시 품목(금액 전용)은 생산현황 행으로 펼치지 않음
    if (isBillingOnlyOrderItem(item)) continue

    const lineId = item.lineId?.trim() || ''
    const productId = resolveItemProductId(item)
    const smtLine = lineId ? smtByLineId.get(lineId) : undefined
    if (smtLine) coveredSmtLineIds.add(lineId)

    const parentAssembly = productId ? assemblyByParentProductId.get(productId) : undefined
    const childAssembly = lineId ? assemblyByChildLineId.get(lineId) : undefined
    const assembly = parentAssembly ?? childAssembly

    let smtTarget = 0
    let smtProduced = 0
    let smtDefected = 0
    const smtOrderLineIds: string[] = []

    if (smtLine) {
      smtTarget = Math.max(0, Math.floor(smtLine.quantity))
      smtProduced = resolveProductionCount(smtLine, smtCounts)
      smtDefected = resolveProductionDefectCount(smtLine, smtDefectCounts)
      smtOrderLineIds.push(smtLine.orderLineId)
    }

    let postTarget = 0
    let postProduced = 0
    let postDefected = 0
    let deliveryTarget = 0
    let deliveryProduced = 0
    const assemblyGroupIds: string[] = []

    if (assembly) {
      const assemblyTarget = Math.max(0, Math.floor(assembly.targetQuantity))
      deliveryTarget = assemblyTarget
      deliveryProduced = Math.max(0, Math.floor(Number(deliveryCounts[assembly.id]) || 0))
      assemblyGroupIds.push(assembly.id)

      if (assemblyGroupIncludesPostProcess(assembly, productById, quotes, order)) {
        postTarget = assemblyTarget
        postProduced = Math.max(0, Math.floor(Number(postCounts[assembly.id]) || 0))
        postDefected = Math.max(0, Math.floor(Number(postDefectCounts[assembly.id]) || 0))
      }
    }

    const quantity = Math.max(0, Math.floor(item.quantity))
    const smtStack = getStackedProgressWidths(smtProduced, smtDefected, smtTarget)
    const postStack = getStackedProgressWidths(postProduced, postDefected, postTarget)

    const master = productId ? productById[productId] : undefined
    products.push({
      key: `item:${lineId || productId || item.productName}`,
      productName:
        (smtLine?.productName || master?.productName || item.productName).trim() || '—',
      productCode: (smtLine?.productCode || master?.productCode || item.productCode).trim(),
      quantity,
      smtTarget,
      smtProduced,
      smtDefected,
      smtPercent: smtStack.goodPercent,
      smtDefectPercent: smtStack.defectPercent,
      postTarget,
      postProduced,
      postDefected,
      postPercent: postStack.goodPercent,
      postDefectPercent: postStack.defectPercent,
      deliveryTarget,
      deliveryProduced,
      deliveryPercent: getProgressPercent(deliveryProduced, deliveryTarget),
      smtOrderLineIds,
      assemblyGroupIds,
    })
  }

  // 조립제품 주문에서 BOM 전개된 반제품 SMT 라인 — 주문 라인과 별도로 표시
  for (const smtLine of orderSmtLines) {
    if (coveredSmtLineIds.has(smtLine.orderLineId)) continue

    const smtTarget = Math.max(0, Math.floor(smtLine.quantity))
    const smtProduced = resolveProductionCount(smtLine, smtCounts)
    const smtDefected = resolveProductionDefectCount(smtLine, smtDefectCounts)
    const smtStack = getStackedProgressWidths(smtProduced, smtDefected, smtTarget)

    products.push({
      key: `smt:${smtLine.orderLineId}`,
      productName: smtLine.productName.trim() || '—',
      productCode: smtLine.productCode.trim(),
      quantity: smtTarget,
      smtTarget,
      smtProduced,
      smtDefected,
      smtPercent: smtStack.goodPercent,
      smtDefectPercent: smtStack.defectPercent,
      postTarget: 0,
      postProduced: 0,
      postDefected: 0,
      postPercent: 0,
      postDefectPercent: 0,
      deliveryTarget: 0,
      deliveryProduced: 0,
      deliveryPercent: 0,
      smtOrderLineIds: [smtLine.orderLineId],
      assemblyGroupIds: [],
    })
  }

  return products
}

export function buildProductionStatusLines(
  orders: OrderListGroup[],
  smtLines: ProductionOrderLine[],
  assemblyGroups: OrderAssemblyGroup[],
  smtCounts: ProductionCounts,
  postCounts: ProductionCounts,
  deliveryCounts: ProductionCounts = {},
  smtDefectCounts: ProductionCounts = {},
  postDefectCounts: ProductionCounts = {},
  productById: Record<string, Product> = {},
  quotes: QuoteListItem[] = [],
): ProductionStatusLine[] {
  const smtLinesByOrderNumber = groupSmtLinesByOrderNumber(smtLines)
  const assembliesByOrderId = groupAssemblyGroupsByOrderId(assemblyGroups)

  return orders.map((order) => {
    const orderSmtLines = smtLinesByOrderNumber.get(order.orderNumber) ?? []
    let smtTarget = 0
    let smtProduced = 0
    let smtDefected = 0

    for (const smtLine of orderSmtLines) {
      const lineTarget = Math.max(0, Math.floor(smtLine.quantity))
      smtTarget += lineTarget
      smtProduced += resolveProductionCount(smtLine, smtCounts)
      smtDefected += resolveProductionDefectCount(smtLine, smtDefectCounts)
    }

    const orderAssemblies = (assembliesByOrderId.get(order.orderId) ?? []).filter((assembly) =>
      Boolean(productById[assembly.parentProductId]),
    )
    let postTarget = 0
    let postProduced = 0
    let postDefected = 0
    let deliveryTarget = 0
    let deliveryProduced = 0

    for (const assembly of orderAssemblies) {
      const assemblyTarget = Math.max(0, Math.floor(assembly.targetQuantity))
      deliveryTarget += assemblyTarget
      deliveryProduced += Math.max(0, Math.floor(Number(deliveryCounts[assembly.id]) || 0))
      if (!assemblyGroupIncludesPostProcess(assembly, productById, quotes, order)) continue
      postTarget += assemblyTarget
      postProduced += Math.max(0, Math.floor(Number(postCounts[assembly.id]) || 0))
      postDefected += Math.max(0, Math.floor(Number(postDefectCounts[assembly.id]) || 0))
    }

    const products = buildProductLinesForOrder(
      order,
      orderSmtLines,
      orderAssemblies,
      smtCounts,
      smtDefectCounts,
      postCounts,
      postDefectCounts,
      deliveryCounts,
      productById,
      quotes,
    )

    const productName =
      products.length === 0
        ? formatProductSummary(order)
        : products.length === 1
          ? products[0]!.productName
          : `${products[0]!.productName} 외 ${products.length - 1}건`

    const smtStack = getStackedProgressWidths(smtProduced, smtDefected, smtTarget)
    const postStack = getStackedProgressWidths(postProduced, postDefected, postTarget)

    return {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      customer: order.customer,
      productName,
      productCount: products.length,
      deliveryDate: order.deliveryDate,
      quantity: Math.max(0, Math.floor(order.totalQuantity)),
      smtTarget,
      smtProduced,
      smtDefected,
      smtPercent: smtStack.goodPercent,
      smtDefectPercent: smtStack.defectPercent,
      postTarget,
      postProduced,
      postDefected,
      postPercent: postStack.goodPercent,
      postDefectPercent: postStack.defectPercent,
      deliveryTarget,
      deliveryProduced,
      deliveryPercent: getProgressPercent(deliveryProduced, deliveryTarget),
      products,
    }
  })
}

export function matchesProductionStatusSearch(line: ProductionStatusLine, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const productNames = line.products.map((product) => product.productName).join(' ')
  const productCodes = line.products.map((product) => product.productCode).join(' ')
  return [line.orderNumber, line.customer, line.productName, productNames, productCodes]
    .join(' ')
    .toLowerCase()
    .includes(q)
}

export function filterProductionStatusLinesByDate(
  lines: ProductionStatusLine[],
  range: DateRangeFilterValue,
) {
  return lines.filter((line) => matchesDateRange(line.deliveryDate, range))
}
