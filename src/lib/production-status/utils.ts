import type { OrderAssemblyGroup } from '@/lib/assembly/types'
import type { OrderListGroup } from '@/lib/orders/types'
import { formatProductSummary } from '@/lib/orders/utils'
import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'
import {
  getProgressPercent,
  resolveProductionCount,
} from '@/lib/production-input/utils'
import type { ProductionStatusLine } from './types'

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

export function buildProductionStatusLines(
  orders: OrderListGroup[],
  smtLines: ProductionOrderLine[],
  assemblyGroups: OrderAssemblyGroup[],
  smtCounts: ProductionCounts,
  postCounts: ProductionCounts,
  deliveryCounts: ProductionCounts = {},
): ProductionStatusLine[] {
  const smtLinesByOrderNumber = groupSmtLinesByOrderNumber(smtLines)
  const assembliesByOrderId = groupAssemblyGroupsByOrderId(assemblyGroups)

  return orders.map((order) => {
    const orderSmtLines = smtLinesByOrderNumber.get(order.orderNumber) ?? []
    let smtTarget = 0
    let smtProduced = 0

    for (const smtLine of orderSmtLines) {
      const lineTarget = Math.max(0, Math.floor(smtLine.quantity))
      smtTarget += lineTarget
      smtProduced += resolveProductionCount(smtLine, smtCounts)
    }

    const orderAssemblies = assembliesByOrderId.get(order.orderId) ?? []
    let postTarget = 0
    let postProduced = 0
    let deliveryTarget = 0
    let deliveryProduced = 0

    for (const assembly of orderAssemblies) {
      const assemblyTarget = Math.max(0, Math.floor(assembly.targetQuantity))
      postTarget += assemblyTarget
      postProduced += Math.max(0, Math.floor(Number(postCounts[assembly.id]) || 0))
      deliveryTarget += assemblyTarget
      deliveryProduced += Math.max(0, Math.floor(Number(deliveryCounts[assembly.id]) || 0))
    }

    return {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      customer: order.customer,
      productName: formatProductSummary(order),
      deliveryDate: order.deliveryDate,
      quantity: Math.max(0, Math.floor(order.totalQuantity)),
      smtTarget,
      smtProduced,
      smtPercent: getProgressPercent(smtProduced, smtTarget),
      postTarget,
      postProduced,
      postPercent: getProgressPercent(postProduced, postTarget),
      deliveryTarget,
      deliveryProduced,
      deliveryPercent: getProgressPercent(deliveryProduced, deliveryTarget),
    }
  })
}
