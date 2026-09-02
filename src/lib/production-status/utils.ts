import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import { computeAssemblySmtSets } from '@/lib/delivery/utils'
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
import type {
  ProductionStatusLine,
  ProductionStatusProductLine,
  ProductionStatusSmtChild,
} from './types'

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

function buildSmtChildFromLine(
  smtLine: ProductionOrderLine,
  smtCounts: ProductionCounts,
  smtDefectCounts: ProductionCounts,
): ProductionStatusSmtChild {
  const smtTarget = Math.max(0, Math.floor(smtLine.quantity))
  const smtProduced = resolveProductionCount(smtLine, smtCounts)
  const smtDefected = resolveProductionDefectCount(smtLine, smtDefectCounts)
  const smtStack = getStackedProgressWidths(smtProduced, smtDefected, smtTarget)

  return {
    key: `smt:${smtLine.orderLineId}`,
    productName: smtLine.productName.trim() || '—',
    productCode: smtLine.productCode.trim(),
    version: (smtLine.productVersion || '').trim(),
    quantity: smtTarget,
    smtTarget,
    smtProduced,
    smtDefected,
    smtPercent: smtStack.goodPercent,
    smtDefectPercent: smtStack.defectPercent,
    smtOrderLineIds: [smtLine.orderLineId],
  }
}

function aggregateSmtChildren(children: ProductionStatusSmtChild[]) {
  let smtTarget = 0
  let smtProduced = 0
  let smtDefected = 0
  const smtOrderLineIds: string[] = []

  for (const child of children) {
    smtTarget += child.smtTarget
    smtProduced += child.smtProduced
    smtDefected += child.smtDefected
    smtOrderLineIds.push(...child.smtOrderLineIds)
  }

  const smtStack = getStackedProgressWidths(smtProduced, smtDefected, smtTarget)
  return {
    smtTarget,
    smtProduced,
    smtDefected,
    smtPercent: smtStack.goodPercent,
    smtDefectPercent: smtStack.defectPercent,
    smtOrderLineIds,
  }
}

/** 조립제품 SMT: 발주수량(세트) 대비 min(구성 반제품) */
function resolveAssemblySmtProgress(
  assembly: OrderAssemblyGroup,
  children: ProductionStatusSmtChild[],
  smtCounts: ProductionCounts,
  productById: Record<string, Product>,
) {
  const smtTarget = Math.max(0, Math.floor(assembly.targetQuantity))
  const smtProduced = Math.min(
    smtTarget,
    computeAssemblySmtSets(assembly, smtCounts, productById),
  )
  const smtStack = getStackedProgressWidths(smtProduced, 0, smtTarget)
  const smtOrderLineIds = children.flatMap((child) => child.smtOrderLineIds)

  return {
    smtTarget,
    smtProduced,
    smtDefected: 0,
    smtPercent: smtStack.goodPercent,
    smtDefectPercent: smtStack.defectPercent,
    smtOrderLineIds,
  }
}

/**
 * 주문 라인(실제 제품) 단위로 펼침 행을 만든다.
 * 조립제품은 구성 반제품 SMT를 자식으로 중첩하고, 반제품 단독 주문은 기존처럼 한 줄로 둔다.
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
  const nestedSmtLineIds = new Set<string>()

  for (const item of order.items) {
    // 임시 품목(금액 전용)은 생산현황 행으로 펼치지 않음
    if (isBillingOnlyOrderItem(item)) continue
    // BOM 전개 반제품은 조립제품 행의 구성 SMT로만 표시
    if (String(item.derivedFromLineId || '').trim()) continue

    const lineId = item.lineId?.trim() || ''
    const productId = resolveItemProductId(item)
    const smtLine = lineId ? smtByLineId.get(lineId) : undefined

    const parentAssembly = productId ? assemblyByParentProductId.get(productId) : undefined
    const childAssembly = lineId ? assemblyByChildLineId.get(lineId) : undefined
    const assembly = parentAssembly ?? childAssembly
    const master = productId ? productById[productId] : undefined

    const smtChildren: ProductionStatusSmtChild[] = []
    if (parentAssembly) {
      for (const assemblyLine of parentAssembly.lines) {
        const childLineId = String(assemblyLine.orderLineId || '').trim()
        if (!childLineId || childLineId === lineId) continue
        const childSmt = smtByLineId.get(childLineId)
        if (!childSmt) continue
        if (nestedSmtLineIds.has(childLineId)) continue
        nestedSmtLineIds.add(childLineId)
        smtChildren.push(buildSmtChildFromLine(childSmt, smtCounts, smtDefectCounts))
      }
    }

    let smtTarget = 0
    let smtProduced = 0
    let smtDefected = 0
    let smtPercent = 0
    let smtDefectPercent = 0
    let smtOrderLineIds: string[] = []

    if (smtChildren.length > 0 && parentAssembly) {
      // 조립제품: A+B+C 합산이 아니라 발주수량 대비 세트(min)
      const aggregated = resolveAssemblySmtProgress(
        parentAssembly,
        smtChildren,
        smtCounts,
        productById,
      )
      smtTarget = aggregated.smtTarget
      smtProduced = aggregated.smtProduced
      smtDefected = aggregated.smtDefected
      smtPercent = aggregated.smtPercent
      smtDefectPercent = aggregated.smtDefectPercent
      smtOrderLineIds = aggregated.smtOrderLineIds
    } else if (smtLine) {
      smtTarget = Math.max(0, Math.floor(smtLine.quantity))
      smtProduced = resolveProductionCount(smtLine, smtCounts)
      smtDefected = resolveProductionDefectCount(smtLine, smtDefectCounts)
      const smtStack = getStackedProgressWidths(smtProduced, smtDefected, smtTarget)
      smtPercent = smtStack.goodPercent
      smtDefectPercent = smtStack.defectPercent
      smtOrderLineIds = [smtLine.orderLineId]
    } else if (smtChildren.length > 0) {
      const aggregated = aggregateSmtChildren(smtChildren)
      smtTarget = aggregated.smtTarget
      smtProduced = aggregated.smtProduced
      smtDefected = aggregated.smtDefected
      smtPercent = aggregated.smtPercent
      smtDefectPercent = aggregated.smtDefectPercent
      smtOrderLineIds = aggregated.smtOrderLineIds
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
    const postStack = getStackedProgressWidths(postProduced, postDefected, postTarget)

    products.push({
      key: `item:${lineId || productId || item.productName}`,
      productName:
        (smtLine?.productName || master?.productName || item.productName).trim() || '—',
      productCode: (smtLine?.productCode || master?.productCode || item.productCode).trim(),
      version: (smtLine?.productVersion || master?.version || '').trim(),
      quantity,
      smtTarget,
      smtProduced,
      smtDefected,
      smtPercent,
      smtDefectPercent,
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
      smtChildren,
    })
  }

  // 주문 라인·조립 자식에 묶이지 않은 SMT 라인만 단독 행으로 유지
  for (const smtLine of orderSmtLines) {
    if (nestedSmtLineIds.has(smtLine.orderLineId)) continue
    if (products.some((product) => product.smtOrderLineIds.includes(smtLine.orderLineId))) continue

    const child = buildSmtChildFromLine(smtLine, smtCounts, smtDefectCounts)
    products.push({
      key: child.key,
      productName: child.productName,
      productCode: child.productCode,
      version: child.version,
      quantity: child.quantity,
      smtTarget: child.smtTarget,
      smtProduced: child.smtProduced,
      smtDefected: child.smtDefected,
      smtPercent: child.smtPercent,
      smtDefectPercent: child.smtDefectPercent,
      postTarget: 0,
      postProduced: 0,
      postDefected: 0,
      postPercent: 0,
      postDefectPercent: 0,
      deliveryTarget: 0,
      deliveryProduced: 0,
      deliveryPercent: 0,
      smtOrderLineIds: child.smtOrderLineIds,
      assemblyGroupIds: [],
      smtChildren: [],
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
      customerPoNumber: order.customerPoNumber || '',
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
  const productNames = line.products
    .flatMap((product) => [product.productName, ...product.smtChildren.map((child) => child.productName)])
    .join(' ')
  const productCodes = line.products
    .flatMap((product) => [product.productCode, ...product.smtChildren.map((child) => child.productCode)])
    .join(' ')
  const versions = line.products
    .flatMap((product) => [product.version, ...product.smtChildren.map((child) => child.version)])
    .join(' ')
  return [line.orderNumber, line.customerPoNumber, line.customer, line.productName, productNames, productCodes, versions]
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

/** 생산현황 출하 컬럼 → 출하 등록 화면 uiKey */
export function resolveProductionStatusDeliveryUiKey(
  line: ProductionStatusLine,
  deliveryOrders: ProductionOrderLine[],
  product?: ProductionStatusProductLine,
): string {
  const candidates = deliveryOrders.filter((order) => {
    if (order.orderId !== line.orderId) return false
    if (!product) return true
    const groupId = order.assemblyGroupId || order.orderLineId
    return product.assemblyGroupIds.includes(groupId)
  })
  return candidates[0]?.uiKey || ''
}
